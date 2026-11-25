import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { assertProjectOwnership, getAuthenticatedClient } from '../_shared/supabaseClient.ts';

interface CodeFile {
  path: string;
  content: string;
}

const SANDBOX_LIMITS = {
  cpu_cores: 1,
  memory_mb: 512,
  timeout_seconds: 60,
  network: 'disabled',
};

function extractMetricsFromStdout(stdout: string): Record<string, number | string> {
  const matches = Array.from(stdout.matchAll(/METRICS_JSON:\s*(\{[^\n\r]*\})/g));
  for (let i = matches.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(matches[i][1]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // try earlier match
    }
  }
  return {};
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await getAuthenticatedClient(req);
    const { projectId, entryFile = 'main.py', customFiles } = (await req.json()) as {
      projectId?: string;
      entryFile?: string;
      customFiles?: CodeFile[];
    };

    if (!projectId) {
      return errorResponse('projectId is required', 400);
    }

    await assertProjectOwnership(supabase, projectId, user.id);

    const { data: codeRecord, error: codeErr } = await supabase
      .from('generated_code')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single();

    if (codeErr || !codeRecord) {
      return errorResponse('No generated code found for this project. Generate code in Stage 6 first.', 404);
    }

    const filesToRun: CodeFile[] =
      Array.isArray(customFiles) && customFiles.length > 0
        ? customFiles
        : (codeRecord.files as CodeFile[]) || [];

    const sandboxUrl = Deno.env.get('SANDBOX_API_URL');
    const sandboxApiKey = Deno.env.get('SANDBOX_API_KEY');
    const sandboxProvider = Deno.env.get('SANDBOX_PROVIDER_NAME') || 'isolated-docker-sandbox';

    // SECURITY REQUIREMENT: Never execute arbitrary AI-generated code directly inside the Edge Function.
    // If no external isolated sandbox service is configured, record and report honestly.
    if (!sandboxUrl) {
      const { data: runRow } = await supabase
        .from('experiment_runs')
        .insert({
          project_id: projectId,
          code_id: codeRecord.id,
          user_id: user.id,
          status: 'sandbox_not_configured',
          sandbox_provider: 'none',
          entry_file: entryFile,
          stdout_log: '',
          stderr_log:
            'SANDBOX_API_URL is not configured on the backend. Arbitrary code is never executed directly inside Supabase Edge Functions for security isolation.',
          resource_limits: SANDBOX_LIMITS,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        })
        .select()
        .single();

      return jsonResponse({
        configured: false,
        run: runRow,
        setupInstructions: {
          message:
            'External isolated code execution sandbox is not configured. Download the generated project ZIP and run locally, or deploy the included sandbox-runner container and set SANDBOX_API_URL.',
          envVars: ['SANDBOX_API_URL', 'SANDBOX_API_KEY'],
          limits: SANDBOX_LIMITS,
        },
      });
    }

    // Create initial running record
    const startedAt = new Date().toISOString();
    const { data: runRecord, error: insertErr } = await supabase
      .from('experiment_runs')
      .insert({
        project_id: projectId,
        code_id: codeRecord.id,
        user_id: user.id,
        status: 'running',
        sandbox_provider: sandboxProvider,
        entry_file: entryFile,
        resource_limits: SANDBOX_LIMITS,
        started_at: startedAt,
      })
      .select()
      .single();

    if (insertErr || !runRecord) {
      throw new Error(`Failed to create run record: ${insertErr?.message}`);
    }

    // Delegate execution strictly to isolated external sandbox container
    const startMs = Date.now();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sandboxApiKey) {
      headers['Authorization'] = `Bearer ${sandboxApiKey}`;
      headers['X-Sandbox-Key'] = sandboxApiKey;
    }

    let sandboxResult: {
      status?: string;
      stdout?: string;
      stderr?: string;
      exit_code?: number;
      execution_time_ms?: number;
      generated_files?: Array<{ name: string; size: number; content_base64?: string; text_preview?: string }>;
      metrics?: Record<string, unknown>;
    };

    try {
      const hasRequirements = filesToRun.some((f) => f.path.replace(/^\/+/, '') === 'requirements.txt');
      const payloadFiles = [
        ...filesToRun.map((f) => ({ path: f.path, content: f.content })),
        ...(hasRequirements ? [] : [{ path: 'requirements.txt', content: codeRecord.requirements_txt || '' }]),
      ];

      const execRes = await fetch(`${sandboxUrl.replace(/\/$/, '')}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          entry_file: entryFile,
          files: payloadFiles,
          limits: SANDBOX_LIMITS,
        }),
        signal: AbortSignal.timeout((SANDBOX_LIMITS.timeout_seconds + 50) * 1000),
      });

      if (!execRes.ok) {
        const errBody = await execRes.text();
        throw new Error(`Sandbox service returned HTTP ${execRes.status}: ${errBody.slice(0, 400)}`);
      }
      sandboxResult = await execRes.json();
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : 'Sandbox communication error';
      const elapsed = Date.now() - startMs;
      const isTimeout = msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort');

      const { data: failedRun } = await supabase
        .from('experiment_runs')
        .update({
          status: isTimeout ? 'timeout' : 'failed',
          stderr_log: msg,
          exit_code: -1,
          execution_time_ms: elapsed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', runRecord.id)
        .select()
        .single();

      return jsonResponse({ configured: true, run: failedRun });
    }

    const elapsed = sandboxResult.execution_time_ms ?? Date.now() - startMs;
    const exitCode = sandboxResult.exit_code ?? 0;
    const runStatus =
      sandboxResult.status === 'timeout'
        ? 'timeout'
        : exitCode === 0
        ? 'completed'
        : 'failed';

    const { data: completedRun } = await supabase
      .from('experiment_runs')
      .update({
        status: runStatus,
        stdout_log: sandboxResult.stdout || '',
        stderr_log: sandboxResult.stderr || '',
        exit_code: exitCode,
        execution_time_ms: elapsed,
        generated_files: sandboxResult.generated_files || [],
        completed_at: new Date().toISOString(),
      })
      .eq('id', runRecord.id)
      .select()
      .single();

    // Parse real metrics from sandbox response or stdout METRICS_JSON
    const parsedMetrics = {
      ...extractMetricsFromStdout(sandboxResult.stdout || ''),
      ...(sandboxResult.metrics || {}),
    };

    let savedResult = null;
    if (runStatus === 'completed') {
      const { data: analysis } = await supabase
        .from('paper_analyses')
        .select('evaluation_metrics')
        .eq('project_id', projectId)
        .maybeSingle();

      const paperReported = Array.isArray(analysis?.evaluation_metrics) ? analysis.evaluation_metrics : [];

      const parseNumericMetric = (raw: string, actualVal: number): number | undefined => {
        const match = String(raw || '').match(/(\d+(?:\.\d+)?)\s*(%)?/);
        if (!match) return undefined;
        let val = parseFloat(match[1]);
        if (Number.isNaN(val)) return undefined;
        // Align percentage (e.g. 97.4%) with 0-1 scale if actual is <= 1
        if (match[2] === '%' && actualVal <= 1.0 && val > 1.0) {
          val = Number((val / 100).toFixed(4));
        } else if (!match[2] && val > 1.0 && val <= 100 && actualVal <= 1.0) {
          val = Number((val / 100).toFixed(4));
        }
        return val;
      };

      const chartSeries = Object.entries(parsedMetrics)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => {
          const actual = Number(v);
          const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
          const matchedPaper = paperReported.find((pm: { metric_name?: string }) => {
            const pNorm = (pm.metric_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const cleanPNorm = pNorm.replace('paperreported', '');
            if (!normKey || !cleanPNorm) return false;
            return pNorm.includes(normKey) || normKey.includes(cleanPNorm);
          });
          const paperVal = matchedPaper
            ? parseNumericMetric(matchedPaper.reported_value, actual)
            : undefined;
          return {
            metric: k,
            actual,
            ...(paperVal !== undefined ? { paper_reported: paperVal } : {}),
          };
        });

      const { data: resultRow } = await supabase
        .from('experiment_results')
        .insert({
          project_id: projectId,
          run_id: runRecord.id,
          user_id: user.id,
          is_actual_execution: true,
          metrics: parsedMetrics,
          chart_series: chartSeries,
          paper_comparison: paperReported,
          summary: `Executed ${entryFile} in ${sandboxProvider} (exit code ${exitCode}, ${elapsed} ms).`,
          artifacts: sandboxResult.generated_files || [],
        })
        .select()
        .single();

      savedResult = resultRow;

      const { data: proj } = await supabase
        .from('research_projects')
        .select('stage_statuses, current_stage')
        .eq('id', projectId)
        .single();

      await supabase
        .from('research_projects')
        .update({
          status: 'executed',
          current_stage: Math.max(proj?.current_stage || 1, 8),
          stage_statuses: {
            ...(proj?.stage_statuses || {}),
            '7': 'completed',
            '8': 'completed',
          },
        })
        .eq('id', projectId)
        .eq('user_id', user.id);
    }

    return jsonResponse({ configured: true, run: completedRun, result: savedResult });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error';
    return errorResponse(message, message.toLowerCase().includes('unauthorized') ? 401 : 500);
  }
});
