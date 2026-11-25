import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { assertProjectOwnership, getAuthenticatedClient } from '../_shared/supabaseClient.ts';

interface PageContent {
  pageNumber: number;
  text: string;
}

interface SectionChunk {
  startPage: number;
  endPage: number;
  text: string;
}

function chunkPages(pages: PageContent[], maxChars = 24000): SectionChunk[] {
  const chunks: SectionChunk[] = [];
  let currentText = '';
  let startPage = pages[0]?.pageNumber ?? 1;
  let endPage = startPage;

  for (const page of pages) {
    const formatted = `\n--- [Page ${page.pageNumber}] ---\n${page.text.trim()}\n`;
    if (currentText.length > 0 && currentText.length + formatted.length > maxChars) {
      chunks.push({ startPage, endPage, text: currentText });
      currentText = formatted;
      startPage = page.pageNumber;
      endPage = page.pageNumber;
    } else {
      if (currentText.length === 0) startPage = page.pageNumber;
      currentText += formatted;
      endPage = page.pageNumber;
    }
  }
  if (currentText.length > 0) {
    chunks.push({ startPage, endPage, text: currentText });
  }
  return chunks;
}

const ANALYSIS_SYSTEM_PROMPT = `You are a rigorous academic research paper analyzer for Paper2Prototype.
CRITICAL RULES:
1. Never invent, fabricate, or guess missing facts, metrics, dataset sizes, hyperparameters, or citations.
2. If information is missing from the paper text, explicitly state "Not specified in paper" or set boolean flags to false.
3. Clearly distinguish EXTRACTED FACTS (with exact page numbers like "p. 3") from AI-GENERATED SUGGESTIONS (put suggestions ONLY in "ai_suggestions").
4. Return strictly valid JSON matching the requested schema.`;

const FULL_SCHEMA_GUIDE = `{
  "research_title": "string (extracted title or 'Not specified in paper')",
  "abstract": "string (extracted abstract summary with page ref)",
  "research_problem": "string (extracted problem statement)",
  "research_objectives": ["string"],
  "research_gap": "string (gaps identified in prior work from paper)",
  "proposed_solution": "string (the paper's proposed approach)",
  "methodology": {
    "summary": "string",
    "pipeline_steps": [{"step_number": 1, "title": "string", "description": "string", "page_ref": "p. X"}],
    "architecture_details": "string",
    "hyperparameters": [{"name": "string", "value": "string", "page_ref": "p. X"}],
    "training_configuration": "string"
  },
  "algorithms_used": [{"name": "string", "purpose": "string", "page_ref": "p. X"}],
  "mathematical_models": [{"name": "string", "equation_or_formulation": "string", "explanation": "string", "page_ref": "p. X"}],
  "technologies_used": ["string"],
  "dataset_information": {
    "datasets": [{"name": "string", "description": "string", "size": "string", "split_info": "string", "page_ref": "p. X"}],
    "preprocessing_steps": ["string"]
  },
  "evaluation_metrics": [{"metric_name": "string", "reported_value": "string", "context": "string", "page_ref": "p. X"}],
  "limitations": ["string"],
  "future_scope": ["string"],
  "source_excerpts": [{"field": "string", "page_number": 1, "excerpt": "short verbatim quote <= 220 chars"}],
  "ai_suggestions": [{"category": "string", "suggestion": "string", "rationale": "string"}],
  "reproducibility_signals": {
    "has_dataset_info": true,
    "dataset_evidence": "string",
    "has_model_architecture": true,
    "architecture_evidence": "string",
    "has_hyperparameters": false,
    "hyperparameters_evidence": "string",
    "has_training_config": false,
    "training_evidence": "string",
    "has_evaluation_metrics": true,
    "metrics_evidence": "string",
    "has_software_dependencies": false,
    "dependencies_evidence": "string",
    "has_experimental_environment": false,
    "environment_evidence": "string",
    "challenges": ["string"],
    "recommendations": ["string"]
  }
}`;

function computeReproducibilityScore(signals: Record<string, unknown>) {
  const criteria = [
    { key: 'has_dataset_info', label: 'Dataset Information', weight: 15, evidenceKey: 'dataset_evidence' },
    { key: 'has_model_architecture', label: 'Model Architecture', weight: 15, evidenceKey: 'architecture_evidence' },
    { key: 'has_hyperparameters', label: 'Hyperparameters', weight: 15, evidenceKey: 'hyperparameters_evidence' },
    { key: 'has_training_config', label: 'Training Configuration', weight: 15, evidenceKey: 'training_evidence' },
    { key: 'has_evaluation_metrics', label: 'Evaluation Metrics', weight: 15, evidenceKey: 'metrics_evidence' },
    { key: 'has_software_dependencies', label: 'Software Dependencies', weight: 15, evidenceKey: 'dependencies_evidence' },
    { key: 'has_experimental_environment', label: 'Experimental Environment', weight: 10, evidenceKey: 'environment_evidence' },
  ];

  let score = 0;
  const available: Array<{ criterion: string; weight: number; evidence: string }> = [];
  const missing: Array<{ criterion: string; weight: number; reason: string }> = [];
  const breakdown: Array<{ criterion: string; weight: number; available: boolean; evidence: string }> = [];

  for (const c of criteria) {
    const rawVal = signals?.[c.key];
    const present = rawVal === true || rawVal === 'true';
    const evidence = String(signals?.[c.evidenceKey] || '');
    breakdown.push({
      criterion: c.label,
      weight: c.weight,
      available: present,
      evidence: evidence || 'Not specified in paper',
    });
    if (present) {
      score += c.weight;
      available.push({
        criterion: c.label,
        weight: c.weight,
        evidence: evidence || 'Documented in paper',
      });
    } else {
      missing.push({
        criterion: c.label,
        weight: c.weight,
        reason: evidence || 'Not specified in extracted paper text',
      });
    }
  }

  return {
    score,
    max_score: 100,
    disclaimer:
      'This score represents documentation completeness in the paper text, NOT guaranteed experimental reproducibility.',
    criteria_breakdown: breakdown,
    available_information: available,
    missing_information: missing,
    challenges: Array.isArray(signals?.challenges) ? signals.challenges : [],
    recommendations: Array.isArray(signals?.recommendations) ? signals.recommendations : [],
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    const body = await req.json();
    const { projectId, pages: providedPages } = body as {
      projectId?: string;
      pages?: PageContent[];
    };

    if (!projectId) {
      return errorResponse('projectId is required', 400);
    }

    await assertProjectOwnership(supabase, projectId, user.id);

    let pages: PageContent[] = Array.isArray(providedPages) ? providedPages : [];

    if (pages.length === 0) {
      const { data: paperRow, error: paperErr } = await supabase
        .from('uploaded_papers')
        .select('extracted_pages')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (paperErr || !paperRow) {
        return errorResponse('No extracted PDF pages found for this project. Upload a paper first.', 404);
      }
      pages = (paperRow.extracted_pages as PageContent[]) || [];
    }

    const readablePages = pages.filter((p) => p.text && p.text.trim().length > 0);
    if (readablePages.length === 0) {
      return errorResponse('Paper contains no readable text. Run OCR or upload a text-based PDF.', 400);
    }

    const chunks = chunkPages(readablePages, 24000);
    let finalAnalysis: Record<string, unknown>;
    let modelUsed = '';

    if (chunks.length === 1) {
      const prompt = `Analyze the following research paper text (total ${readablePages.length} pages).
Return ONLY valid JSON matching this schema:
${FULL_SCHEMA_GUIDE}

PAPER TEXT:
${chunks[0].text}`;

      const result = await callGeminiJSON<Record<string, unknown>>({
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        userPrompt: prompt,
        temperature: 0.15,
      });
      finalAnalysis = result.data;
      modelUsed = result.model;
    } else {
      // Multi-section analysis: extract facts from every chunk without truncation (bounded concurrency), then synthesize
      const sectionSummaries: unknown[] = new Array(chunks.length);
      const BATCH_SIZE = 3;
      for (let start = 0; start < chunks.length; start += BATCH_SIZE) {
        const batch = chunks.slice(start, start + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (chunk, offset) => {
            const idx = start + offset;
            const sectionPrompt = `You are reading section ${idx + 1} of ${chunks.length} (Pages ${chunk.startPage}–${chunk.endPage}) of a research paper.
Extract ALL factual details present in THIS section with exact page numbers (p. X). Do NOT omit equations, hyperparameters, dataset splits, metrics, or limitations found in this section.
Return JSON with keys:
{
  "section_pages": "${chunk.startPage}-${chunk.endPage}",
  "title_and_abstract": "string or null",
  "problem_objectives_gap": "string or null",
  "proposed_solution_and_methodology": "string or null",
  "algorithms_and_math": ["string"],
  "datasets_and_preprocessing": ["string"],
  "hyperparameters_and_training": ["string"],
  "technologies_and_environment": ["string"],
  "evaluation_metrics_and_results": ["string"],
  "limitations_and_future_scope": ["string"],
  "verbatim_excerpts": [{"field": "string", "page_number": 1, "excerpt": "string <= 200 chars"}]
}

SECTION TEXT:
${chunk.text}`;

            const sectionRes = await callGeminiJSON<Record<string, unknown>>({
              systemInstruction: ANALYSIS_SYSTEM_PROMPT,
              userPrompt: sectionPrompt,
              temperature: 0.1,
            });
            return { idx, data: sectionRes.data, model: sectionRes.model };
          })
        );

        for (const res of batchResults) {
          sectionSummaries[res.idx] = res.data;
          modelUsed = res.model;
        }
      }

      const synthesisPrompt = `Synthesize the following section-by-section extractions covering all ${readablePages.length} pages of the research paper into the final structured JSON analysis.
Preserve page references (e.g. "p. 4") and verbatim excerpts. Never invent facts not present in the extracted sections. Put any non-extracted recommendations strictly inside "ai_suggestions".
Return ONLY valid JSON matching this schema:
${FULL_SCHEMA_GUIDE}

EXTRACTED SECTIONS:
${JSON.stringify(sectionSummaries, null, 2)}`;

      const synthRes = await callGeminiJSON<Record<string, unknown>>({
        systemInstruction: ANALYSIS_SYSTEM_PROMPT,
        userPrompt: synthesisPrompt,
        temperature: 0.15,
      });
      finalAnalysis = synthRes.data;
      modelUsed = synthRes.model;
    }

    const reproducibilityAssessment = computeReproducibilityScore(
      (finalAnalysis.reproducibility_signals as Record<string, unknown>) || {}
    );

    const isPlainObj = (v: unknown): v is Record<string, unknown> =>
      typeof v === 'object' && v !== null && !Array.isArray(v);

    const record = {
      project_id: projectId,
      user_id: user.id,
      research_title: String(finalAnalysis.research_title || 'Untitled Research Paper'),
      abstract: String(finalAnalysis.abstract || 'Not specified in paper'),
      research_problem: String(finalAnalysis.research_problem || 'Not specified in paper'),
      research_objectives: Array.isArray(finalAnalysis.research_objectives) ? finalAnalysis.research_objectives : [],
      research_gap: String(finalAnalysis.research_gap || 'Not specified in paper'),
      proposed_solution: String(finalAnalysis.proposed_solution || 'Not specified in paper'),
      methodology: isPlainObj(finalAnalysis.methodology) ? finalAnalysis.methodology : {},
      algorithms_used: Array.isArray(finalAnalysis.algorithms_used) ? finalAnalysis.algorithms_used : [],
      mathematical_models: Array.isArray(finalAnalysis.mathematical_models) ? finalAnalysis.mathematical_models : [],
      technologies_used: Array.isArray(finalAnalysis.technologies_used) ? finalAnalysis.technologies_used : [],
      dataset_information: isPlainObj(finalAnalysis.dataset_information) ? finalAnalysis.dataset_information : {},
      evaluation_metrics: Array.isArray(finalAnalysis.evaluation_metrics) ? finalAnalysis.evaluation_metrics : [],
      limitations: Array.isArray(finalAnalysis.limitations) ? finalAnalysis.limitations : [],
      future_scope: Array.isArray(finalAnalysis.future_scope) ? finalAnalysis.future_scope : [],
      source_excerpts: Array.isArray(finalAnalysis.source_excerpts) ? finalAnalysis.source_excerpts : [],
      ai_suggestions: Array.isArray(finalAnalysis.ai_suggestions) ? finalAnalysis.ai_suggestions : [],
      reproducibility_assessment: reproducibilityAssessment,
      raw_model_name: modelUsed,
    };

    const { data: savedAnalysis, error: saveErr } = await supabase
      .from('paper_analyses')
      .upsert(record, { onConflict: 'project_id' })
      .select()
      .single();

    if (saveErr) {
      throw new Error(`Failed to save analysis: ${saveErr.message}`);
    }

    // Update project status & stage progress
    const { data: proj } = await supabase
      .from('research_projects')
      .select('stage_statuses')
      .eq('id', projectId)
      .single();

    const nextStages = {
      ...(proj?.stage_statuses || {}),
      '1': 'completed',
      '2': 'completed',
      '3': 'completed',
    };

    const extractedTitle = String(finalAnalysis.research_title || '').trim();
    const shouldUpdateTitle =
      extractedTitle.length > 0 &&
      extractedTitle.toLowerCase() !== 'not specified in paper' &&
      extractedTitle.toLowerCase() !== 'untitled research paper';

    await supabase
      .from('research_projects')
      .update({
        ...(shouldUpdateTitle ? { title: extractedTitle } : {}),
        status: 'analyzed',
        current_stage: 4,
        stage_statuses: nextStages,
      })
      .eq('id', projectId)
      .eq('user_id', user.id);

    return jsonResponse({ analysis: savedAnalysis, sectionsProcessed: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    const status = message.toLowerCase().includes('unauthorized') ? 401 : 500;
    return errorResponse(message, status);
  }
});
