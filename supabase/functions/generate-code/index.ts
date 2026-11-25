import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { callGeminiJSON } from '../_shared/gemini.ts';
import { assertProjectOwnership, getAuthenticatedClient } from '../_shared/supabaseClient.ts';

interface GeneratedFileItem {
  path: string;
  language?: string;
  description?: string;
  content: string;
}

const TYPING_SYMBOLS = [
  'Any',
  'Dict',
  'List',
  'Optional',
  'Tuple',
  'Set',
  'Union',
  'Callable',
  'Sequence',
  'Iterable',
  'Mapping',
];

function ensureTypingImports(content: string): string {
  // Find typing symbols referenced as identifiers outside string/import lines
  const missing: string[] = [];
  const typingImportLine = content.match(/^\s*from\s+typing\s+import\s+([^\n#]+)/m);
  const alreadyImported = new Set(
    typingImportLine
      ? typingImportLine[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim())
      : []
  );

  for (const sym of TYPING_SYMBOLS) {
    if (alreadyImported.has(sym)) continue;
    // Match type-annotation usage like `: Any`, `-> Dict[`, `[Any`, `, Any]`
    const usageRegex = new RegExp(`(?::|\\[|,|->)\\s*${sym}\\b|\\b${sym}\\s*\\[`);
    if (usageRegex.test(content) && !new RegExp(`^\\s*(?:def|class)\\s+${sym}\\b`, 'm').test(content)) {
      missing.push(sym);
    }
  }

  if (missing.length === 0) return content;

  const importStmt = `from typing import ${missing.join(', ')}\n`;
  // Insert after __future__ import or module docstring if present, else at top
  const futureMatch = content.match(/^([^\n]*from\s+__future__\s+import[^\n]*\n)/m);
  if (futureMatch && futureMatch.index !== undefined) {
    const pos = futureMatch.index + futureMatch[0].length;
    return content.slice(0, pos) + importStmt + content.slice(pos);
  }
  const docMatch = content.match(/^(\s*(?:"""[\s\S]*?"""|'''[\s\S]*?''')\s*\n)/);
  if (docMatch) {
    return docMatch[0] + importStmt + content.slice(docMatch[0].length);
  }
  return importStmt + content;
}

function sanitizeGeneratedFiles(rawFiles: unknown): GeneratedFileItem[] {
  if (!Array.isArray(rawFiles)) return [];
  const files: GeneratedFileItem[] = rawFiles
    .filter((f): f is GeneratedFileItem => Boolean(f && typeof f === 'object' && typeof (f as GeneratedFileItem).path === 'string'))
    .map((f) => {
      const cleanPath = f.path.replace(/^\/+/, '');
      const content = cleanPath.endsWith('.py') ? ensureTypingImports(String(f.content || '')) : String(f.content || '');
      return {
        ...f,
        path: cleanPath,
        content,
      };
    });

  const hasSrcFiles = files.some((f) => f.path.startsWith('src/') && f.path.endsWith('.py'));
  const hasSrcInit = files.some((f) => f.path === 'src/__init__.py');
  if (hasSrcFiles && !hasSrcInit) {
    files.unshift({
      path: 'src/__init__.py',
      language: 'python',
      description: 'Package marker',
      content: '"""Generated experiment package."""\n',
    });
  }

  return files;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    const { projectId, level } = (await req.json()) as { projectId?: string; level?: string };

    if (!projectId) {
      return errorResponse('projectId is required', 400);
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

    let blueprintQuery = supabase
      .from('experiment_blueprints')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id);

    if (level) {
      blueprintQuery = blueprintQuery.eq('implementation_level', level);
    } else {
      blueprintQuery = blueprintQuery.eq('is_selected', true);
    }

    const { data: blueprint } = await blueprintQuery.limit(1).maybeSingle();

    const targetLevel = blueprint?.implementation_level || level || 'intermediate';

    const prompt = `Generate a complete, well-structured, runnable Python starter project for the following research paper and experiment blueprint at the "${targetLevel}" level.

REQUIREMENTS:
1. Create clean modular files (e.g. "src/__init__.py", "src/config.py", "src/dataset.py", "src/model.py", "src/evaluate.py", "main.py").
2. Include comprehensive docstrings, inline comments, type hints (ALWAYS import every symbol used from "typing" such as Any, Dict, List, Optional, Tuple at the top of each file), and robust try/except error handling.
3. Ensure "main.py" runs cleanly with ZERO command-line arguments ("python main.py"), never marks any argparse flag as required=True, defaults to synthetic validation data if no local dataset directory is provided, and prints "METRICS_JSON: {...}" with numeric float metrics at the end.
4. Include complete "requirements_txt", "readme_md", "configuration_instructions", "sample_input", "expected_output_format", and an explicit list of "simplifications" made relative to the full paper.
5. Prefer portable, headless scientific Python libraries ("numpy", "scipy", "scikit-learn", "pandas", "matplotlib" using matplotlib.use("Agg") and plt.savefig(...) instead of plt.show()) so the code runs cleanly in both browser WebAssembly (Pyodide) and headless Linux Docker sandboxes. Avoid hardware/GUI/OS-specific packages (like "pyttsx3", "pyaudio", "sounddevice", "tkinter", or "cv2.imshow") unless strictly wrapped in try/except ImportError with a clean headless fallback.
6. Double-check every Python file before outputting: zero undefined names, zero missing imports, zero syntax errors.
7. Return ONLY valid JSON matching:
{
  "project_name": "snake_case_project_name",
  "files": [
    {"path": "main.py", "language": "python", "description": "Entrypoint", "content": "string"}
  ],
  "requirements_txt": "string",
  "readme_md": "string",
  "configuration_instructions": "string",
  "sample_input": "string",
  "expected_output_format": "string",
  "simplifications": ["string"],
  "code_explanation": "string"
}

PAPER ANALYSIS:
${JSON.stringify({
  research_title: analysis.research_title,
  proposed_solution: analysis.proposed_solution,
  methodology: analysis.methodology,
  algorithms_used: analysis.algorithms_used,
  mathematical_models: analysis.mathematical_models,
  dataset_information: analysis.dataset_information,
  evaluation_metrics: analysis.evaluation_metrics,
})}

EXPERIMENT BLUEPRINT:
${JSON.stringify(blueprint || { note: 'No blueprint saved yet; align with methodology.' })}`;

    const { data: codePayload } = await callGeminiJSON<Record<string, unknown>>({
      systemInstruction:
        'You are a Senior Research Software Engineer. Produce clean, modular, well-documented Python code with zero placeholders or TODO stubs. Output strictly valid JSON.',
      userPrompt: prompt,
      temperature: 0.2,
      maxOutputTokens: 8192,
    });

    const record = {
      project_id: projectId,
      blueprint_id: blueprint?.id || null,
      user_id: user.id,
      project_name: String(codePayload.project_name || 'research_prototype'),
      implementation_level: targetLevel,
      files: sanitizeGeneratedFiles(codePayload.files),
      requirements_txt: String(codePayload.requirements_txt || ''),
      readme_md: String(codePayload.readme_md || ''),
      configuration_instructions: String(codePayload.configuration_instructions || ''),
      sample_input: String(codePayload.sample_input || ''),
      expected_output_format: String(codePayload.expected_output_format || ''),
      simplifications: Array.isArray(codePayload.simplifications) ? codePayload.simplifications : [],
      code_explanation: String(codePayload.code_explanation || ''),
    };

    const { data: saved, error: saveErr } = await supabase
      .from('generated_code')
      .upsert(record, { onConflict: 'project_id' })
      .select()
      .single();

    if (saveErr) {
      throw new Error(`Failed to save generated code: ${saveErr.message}`);
    }

    const { data: proj } = await supabase
      .from('research_projects')
      .select('stage_statuses, current_stage')
      .eq('id', projectId)
      .single();

    await supabase
      .from('research_projects')
      .update({
        status: 'code_ready',
        current_stage: Math.max(proj?.current_stage || 1, 7),
        stage_statuses: {
          ...(proj?.stage_statuses || {}),
          '6': 'completed',
        },
      })
      .eq('id', projectId)
      .eq('user_id', user.id);

    return jsonResponse({ generatedCode: saved });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return errorResponse(message, message.toLowerCase().includes('unauthorized') ? 401 : 500);
  }
});
