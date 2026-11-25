import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { assertProjectOwnership, getAuthenticatedClient } from '../_shared/supabaseClient.ts';

type ImplementationLevel = 'beginner' | 'intermediate' | 'advanced';

const LEVEL_GUIDANCE: Record<ImplementationLevel, string> = {
  beginner:
    'Focus on a minimal, CPU-friendly, single-file or small modular baseline prototype using accessible subsets or synthetic sample data so students can verify the core concept quickly.',
  intermediate:
    'Focus on a clean modular Python experiment faithful to the core architecture, training loop, validation split, and standard evaluation metrics.',
  advanced:
    'Focus on a full-fidelity reproduction plan incorporating complete architectural modules, hyperparameter schedules, ablations, and GPU optimization.',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    const { projectId, level = 'intermediate' } = (await req.json()) as {
      projectId?: string;
      level?: ImplementationLevel;
    };

    if (!projectId) {
      return errorResponse('projectId is required', 400);
    }

    if (!['beginner', 'intermediate', 'advanced'].includes(level)) {
      return errorResponse('level must be beginner, intermediate, or advanced', 400);
    }

    await assertProjectOwnership(supabase, projectId, user.id);

    const { data: analysis, error: analysisErr } = await supabase
      .from('paper_analyses')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (analysisErr || !analysis) {
      return errorResponse('Paper analysis not found. Complete Stage 2 first.', 404);
    }

    const prompt = `Based on the extracted research paper analysis below, generate a detailed, practical Experiment Blueprint at the "${level.toUpperCase()}" implementation level.
Level Guidance: ${LEVEL_GUIDANCE[level]}

IMPORTANT:
- Do not fabricate paper-reported benchmark results. Clearly state what is expected vs what the paper actually reported.
- Return ONLY valid JSON matching this schema:
{
  "experiment_title": "string",
  "experiment_objective": "string",
  "required_software": ["string"],
  "hardware_requirements": {
    "cpu": "string",
    "ram": "string",
    "gpu": "string",
    "storage": "string"
  },
  "python_libraries": [{"name": "string", "version_hint": "string", "purpose": "string"}],
  "dataset_requirements": "string",
  "input_specifications": "string",
  "output_specifications": "string",
  "step_by_step_implementation": [
    {"step": 1, "title": "string", "details": "string", "estimated_minutes": 15}
  ],
  "algorithm_explanation": "string",
  "evaluation_methodology": "string",
  "expected_results": "string",
  "possible_challenges": ["string"],
  "estimated_complexity": "string"
}

PAPER ANALYSIS:
${JSON.stringify({
  research_title: analysis.research_title,
  research_problem: analysis.research_problem,
  proposed_solution: analysis.proposed_solution,
  methodology: analysis.methodology,
  algorithms_used: analysis.algorithms_used,
  mathematical_models: analysis.mathematical_models,
  dataset_information: analysis.dataset_information,
  evaluation_metrics: analysis.evaluation_metrics,
  limitations: analysis.limitations,
})}`;

    const { data: blueprint } = await callGeminiJSON<Record<string, unknown>>({
      systemInstruction:
        'You are a Principal ML Research Engineer designing reproducible experiment blueprints. Output strictly valid JSON.',
      userPrompt: prompt,
      temperature: 0.25,
    });

    // Deselect other levels for this project and upsert current level as selected
    await supabase
      .from('experiment_blueprints')
      .update({ is_selected: false })
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    const record = {
      project_id: projectId,
      user_id: user.id,
      implementation_level: level,
      experiment_title: String(blueprint.experiment_title || `${analysis.research_title} (${level})`),
      experiment_objective: String(blueprint.experiment_objective || ''),
      required_software: Array.isArray(blueprint.required_software) ? blueprint.required_software : [],
      hardware_requirements: blueprint.hardware_requirements || {},
      python_libraries: Array.isArray(blueprint.python_libraries) ? blueprint.python_libraries : [],
      dataset_requirements: String(blueprint.dataset_requirements || ''),
      input_specifications: String(blueprint.input_specifications || ''),
      output_specifications: String(blueprint.output_specifications || ''),
      step_by_step_implementation: Array.isArray(blueprint.step_by_step_implementation)
        ? blueprint.step_by_step_implementation
        : [],
      algorithm_explanation: String(blueprint.algorithm_explanation || ''),
      evaluation_methodology: String(blueprint.evaluation_methodology || ''),
      expected_results: String(blueprint.expected_results || ''),
      possible_challenges: Array.isArray(blueprint.possible_challenges) ? blueprint.possible_challenges : [],
      estimated_complexity: String(blueprint.estimated_complexity || level),
      is_selected: true,
    };

    const { data: saved, error: saveErr } = await supabase
      .from('experiment_blueprints')
      .upsert(record, { onConflict: 'project_id,implementation_level' })
      .select()
      .single();

    if (saveErr) {
      throw new Error(`Failed to save blueprint: ${saveErr.message}`);
    }

    const { data: proj } = await supabase
      .from('research_projects')
      .select('stage_statuses, current_stage')
      .eq('id', projectId)
      .single();

    await supabase
      .from('research_projects')
      .update({
        status: 'blueprint_ready',
        current_stage: Math.max(proj?.current_stage || 1, 5),
        stage_statuses: {
          ...(proj?.stage_statuses || {}),
          '4': 'completed',
        },
      })
      .eq('id', projectId)
      .eq('user_id', user.id);

    return jsonResponse({ blueprint: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return errorResponse(message, message.toLowerCase().includes('unauthorized') ? 401 : 500);
  }
});
