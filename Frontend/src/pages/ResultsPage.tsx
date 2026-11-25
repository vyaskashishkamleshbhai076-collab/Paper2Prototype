import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3, CheckCircle2, Clock, AlertTriangle, ArrowRight, Play } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/common/EmptyState';

export function ResultsPage() {
  const { activeBundle } = useProject();
  const navigate = useNavigate();

  if (!activeBundle) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No Project Selected"
        description="Open a project or the Sample Demo Project to view execution results and paper metric comparisons."
        actionLabel="Go to Dashboard"
        onAction={() => navigate('/app/dashboard')}
      />
    );
  }

  const { project, analysis, runs, results } = activeBundle;
  const latestResult = results[0] || null;
  const latestRun = runs[0] || null;
  const paperMetrics = analysis?.evaluation_metrics || [];

  const numericMetrics = latestResult
    ? Object.entries(latestResult.metrics || {}).filter(([, v]) => typeof v === 'number')
    : [];

  const comparisonData: Array<{ metric: string; actual: number; paper_reported?: number }> =
    latestResult?.chart_series && latestResult.chart_series.length > 0
      ? latestResult.chart_series
      : numericMetrics.map(([metric, val]) => ({
          metric,
          actual: Number(val),
        }));

  const hasPaperComparisonValues = comparisonData.some((d) => typeof d.paper_reported === 'number');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Stage 8 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-white">Experiment Result Analysis</h1>
          <p className="mt-1 text-sm text-slate-400">
            Strictly separates actual measured execution metrics from paper-reported author benchmarks.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate('/app/reproducibility')}>
            Reproducibility Checker
          </Button>
          <Button onClick={() => navigate('/app/reports')}>
            Next: Final Report
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Actual Execution Section */}
      {!latestResult || !latestResult.is_actual_execution ? (
        <Alert variant="warning" className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold">No Actual Sandbox Execution Results Recorded Yet</p>
              <p className="mt-1 text-xs text-amber-100/90">
                Paper2Prototype never invents experimental accuracy or claims reproduction success without real execution evidence. Run the experiment in Stage 7 or locally first.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/app/execute')} className="shrink-0">
            <Play className="h-3.5 w-3.5" />
            Go to Run Experiment
          </Button>
        </Alert>
      ) : (
        <>
          {/* Actual Status & Timing */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center justify-between pt-5">
                <div>
                  <p className="text-xs text-slate-400">Execution Status</p>
                  <p className="mt-1 text-xl font-bold text-emerald-400">
                    {latestRun?.status.toUpperCase() || 'COMPLETED'}
                  </p>
                </div>
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between pt-5">
                <div>
                  <p className="text-xs text-slate-400">Execution Time</p>
                  <p className="mt-1 text-xl font-bold text-white">
                    {latestRun?.execution_time_ms !== null && latestRun?.execution_time_ms !== undefined
                      ? `${latestRun.execution_time_ms} ms`
                      : '—'}
                  </p>
                </div>
                <Clock className="h-6 w-6 text-violet-400" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center justify-between pt-5">
                <div>
                  <p className="text-xs text-slate-400">Evidence Provenance</p>
                  <p className="mt-1 text-sm font-semibold text-emerald-300">
                    Actual Measured Sandbox Run
                  </p>
                </div>
                <Badge variant="success">Verified Run</Badge>
              </CardContent>
            </Card>
          </div>

          {/* Measured Metrics Cards */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Actual Measured Metrics</CardTitle>
                <Badge variant="success">Measured Output</Badge>
              </div>
              <CardDescription>{latestResult.summary}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(latestResult.metrics || {}).map(([k, v]) => (
                <div key={k} className="rounded-xl border border-slate-800 bg-navy-950/70 p-4">
                  <p className="text-xs uppercase tracking-wider text-slate-400">{k}</p>
                  <p className="mt-1 text-2xl font-bold text-white">{String(v)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recharts Bar Graph (Actual Measured vs Paper-Reported when comparable) */}
          {comparisonData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {hasPaperComparisonValues
                    ? 'Actual Measured vs. Paper-Reported Reference Metrics'
                    : 'Measured Evaluation Metrics Chart'}
                </CardTitle>
                <CardDescription>
                  {hasPaperComparisonValues
                    ? 'Purple bars show actual measured sandbox outputs; sky-blue bars show author-reported values from the paper.'
                    : 'Values shown are actual outputs measured from isolated sandbox execution.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="metric" stroke="#94a3b8" fontSize={12} />
                      <YAxis stroke="#94a3b8" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0d122e',
                          borderColor: '#334155',
                          color: '#f8fafc',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="actual" name="Actual Measured Value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      {hasPaperComparisonValues && (
                        <Bar
                          dataKey="paper_reported"
                          name="Paper-Reported (Reference)"
                          fill="#38bdf8"
                          radius={[6, 6, 0, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Raw Output & Errors */}
          {latestRun && (
            <Card>
              <CardHeader>
                <CardTitle>Execution Console & Error Logs</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <pre className="max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                  {latestRun.stdout_log || '(No stdout)'}
                </pre>
                <pre className="max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-rose-200">
                  {latestRun.stderr_log || '(No stderr)'}
                </pre>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Paper-Reported Reference Comparison */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Paper-Reported Benchmark Reference</CardTitle>
            <Badge variant="info">Reported in Paper (Not Executed)</Badge>
          </div>
          <CardDescription>
            Reference metrics reported by the original authors. Compare against your actual measured results above once executed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {paperMetrics.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {paperMetrics.map((m, i) => (
                <div key={i} className="rounded-xl border border-slate-800 bg-navy-950/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-400">{m.metric_name}</span>
                    {m.page_ref && <Badge variant="secondary">{m.page_ref}</Badge>}
                  </div>
                  <p className="mt-1 text-2xl font-bold text-sky-300">{m.reported_value}</p>
                  <p className="mt-1 text-xs text-slate-400">{m.context}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No paper-reported benchmark metrics extracted.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
