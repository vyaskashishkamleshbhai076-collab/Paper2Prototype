import { isSupabaseConfigured, supabase } from './supabase';
import { SandboxExecutionOutput } from './pyodideSandbox';
import { EvaluationMetricInfo, ExperimentResult, ExperimentRun } from '@/types';

export function extractMetricsFromStdout(stdout: string): Record<string, number | string> {
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

function parseNumericMetric(raw: string, actualVal: number): number | undefined {
  const match = String(raw || '').match(/(\d+(?:\.\d+)?)\s*(%)?/);
  if (!match) return undefined;
  let val = parseFloat(match[1]);
  if (Number.isNaN(val)) return undefined;
  if (match[2] === '%' && actualVal <= 1.0 && val > 1.0) {
    val = Number((val / 100).toFixed(4));
  } else if (!match[2] && val > 1.0 && val <= 100 && actualVal <= 1.0) {
    val = Number((val / 100).toFixed(4));
  }
  return val;
}

export function buildChartSeries(
  parsedMetrics: Record<string, unknown>,
  paperReported: EvaluationMetricInfo[]
): Array<{ metric: string; actual: number; paper_reported?: number }> {
  return Object.entries(parsedMetrics)
    .filter(([, v]) => typeof v === 'number')
    .map(([k, v]) => {
      const actual = Number(v);
      const normKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedPaper = paperReported.find((pm) => {
        const pNorm = (pm.metric_name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanPNorm = pNorm.replace('paperreported', '');
        if (!normKey || !cleanPNorm) return false;
        return pNorm.includes(normKey) || normKey.includes(cleanPNorm);
      });
      const paperVal = matchedPaper ? parseNumericMetric(matchedPaper.reported_value, actual) : undefined;
      return {
        metric: k,
        actual,
        ...(paperVal !== undefined ? { paper_reported: paperVal } : {}),
      };
    });
}

export async function saveClientExecutionResult(params: {
  projectId: string;
  userId: string;
  codeId: string;
  entryFile: string;
  sandboxProvider: string;
  output: SandboxExecutionOutput;
  paperMetrics: EvaluationMetricInfo[];
  currentStage: number;
  stageStatuses: Record<string, string>;
}): Promise<{ run: ExperimentRun; result: ExperimentResult | null }> {
  const {
    projectId,
    userId,
    codeId,
    entryFile,
    sandboxProvider,
    output,
    paperMetrics,
    currentStage,
    stageStatuses,
  } = params;

  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const now = new Date().toISOString();
  const { data: runRow, error: runErr } = await supabase
    .from('experiment_runs')
    .insert({
      project_id: projectId,
      code_id: codeId,
      user_id: userId,
      status: output.status,
      sandbox_provider: sandboxProvider,
      entry_file: entryFile,
      resource_limits: {
        cpu_cores: 1,
        memory_mb: 512,
        timeout_seconds: 60,
        network: sandboxProvider === 'browser-pyodide-wasm' ? 'browser-worker-isolated' : 'disabled',
      },
      stdout_log: output.stdout || '',
      stderr_log: output.stderr || '',
      exit_code: output.exit_code,
      execution_time_ms: output.execution_time_ms,
      generated_files: output.generated_files || [],
      started_at: now,
      completed_at: now,
    })
    .select()
    .single();

  if (runErr || !runRow) {
    throw new Error(`Failed to save run record: ${runErr?.message || 'Unknown error'}`);
  }

  let savedResult: ExperimentResult | null = null;
  if (output.status === 'completed') {
    const parsedMetrics: Record<string, number | string> = {
      ...extractMetricsFromStdout(output.stdout || ''),
      ...((output.metrics as Record<string, number | string>) || {}),
    };
    const chartSeries = buildChartSeries(parsedMetrics, paperMetrics);

    const { data: resRow, error: resErr } = await supabase
      .from('experiment_results')
      .insert({
        project_id: projectId,
        run_id: runRow.id,
        user_id: userId,
        is_actual_execution: true,
        metrics: parsedMetrics,
        chart_series: chartSeries,
        paper_comparison: paperMetrics,
        summary: `Executed ${entryFile} in ${sandboxProvider} (exit code ${output.exit_code}, ${output.execution_time_ms} ms).`,
        artifacts: output.generated_files || [],
      })
      .select()
      .single();

    if (resErr) {
      throw new Error(`Failed to save experiment results: ${resErr.message}`);
    }
    savedResult = resRow as ExperimentResult;

    await supabase
      .from('research_projects')
      .update({
        status: 'executed',
        current_stage: Math.max(currentStage || 1, 8),
        stage_statuses: {
          ...stageStatuses,
          '7': 'completed',
          '8': 'completed',
        },
      })
      .eq('id', projectId)
      .eq('user_id', userId);
  }

  return {
    run: runRow as ExperimentRun,
    result: savedResult,
  };
}
