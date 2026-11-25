import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Info } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { deriveReproducibilityFromAnalysis } from '@/lib/reproducibility';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/common/EmptyState';

export function ReproducibilityPage() {
  const { activeBundle } = useProject();
  const navigate = useNavigate();

  if (!activeBundle || !activeBundle.analysis) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Paper Analysis Required"
        description="Analyze a research paper (or open the Sample Demo Project) to compute its transparent Research Reproducibility Score."
        actionLabel="Go to Research Analysis"
        onAction={() => navigate('/app/analysis')}
      />
    );
  }

  const { project, analysis } = activeBundle;
  const assessment = deriveReproducibilityFromAnalysis(analysis);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Reproducibility Audit</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-white">Research Reproducibility Score</h1>
          <p className="mt-1 text-sm text-slate-400">
            Transparent 100-point documentation completeness audit for: {analysis.research_title}
          </p>
        </div>

        <Button onClick={() => navigate('/app/reports')}>Include in Final Report</Button>
      </div>

      {/* Mandatory Transparency Disclaimer */}
      <Alert variant="info" className="flex items-start gap-3">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-400" />
        <div>
          <p className="font-semibold">Documentation Completeness Disclaimer</p>
          <p className="mt-0.5 text-xs text-sky-100/90">{assessment.disclaimer}</p>
        </div>
      </Alert>

      {/* Score Overview Card */}
      <Card className="border-violet-500/40 bg-gradient-to-br from-navy-900 to-violet-950/30">
        <CardContent className="flex flex-col gap-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
              Overall Documentation Score
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-white">{assessment.score}</span>
              <span className="text-xl text-slate-400">/ {assessment.max_score}</span>
            </div>
            <p className="text-xs text-slate-400">
              {assessment.available_information.length} of {assessment.criteria_breakdown.length} core reproducibility criteria documented in paper
            </p>
          </div>
          <div className="w-full max-w-md space-y-2">
            <Progress value={assessment.score} className="h-3.5" />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 (Opaque)</span>
              <span>50 (Partial)</span>
              <span>100 (Well-Documented)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transparent Criteria Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Transparent Scoring Rubric (100 Points Total)</CardTitle>
          <CardDescription>Every criterion is weighted explicitly based on extracted evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assessment.criteria_breakdown.map((item) => (
            <div
              key={item.criterion}
              className="flex flex-col justify-between gap-2 rounded-xl border border-slate-800 bg-navy-950/60 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3">
                {item.available ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                ) : (
                  <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                )}
                <div>
                  <p className="text-sm font-semibold text-white">{item.criterion}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{item.evidence}</p>
                </div>
              </div>
              <Badge variant={item.available ? 'success' : 'destructive'} className="w-fit shrink-0">
                {item.available ? `+${item.weight}` : '0'} / {item.weight} pts
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Challenges & Recommendations */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Reproducibility Challenges
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assessment.challenges.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {assessment.challenges.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No major challenges flagged.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-violet-400" />
              Recommendations to Improve Reproducibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assessment.recommendations.length > 0 ? (
              <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                {assessment.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Documentation is comprehensive.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
