import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Microscope,
  Sparkles,
  BookOpen,
  Layers,
  Database,
  AlertCircle,
  Quote,
  ArrowRight,
  Cpu,
  FlaskConical,
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { analyzePaperApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export function ResearchAnalysisPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';
  const { activeBundle, refreshActiveBundle } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!activeBundle) {
    return (
      <EmptyState
        icon={Microscope}
        title="No Project Selected"
        description="Upload a research paper or load the Sample Demo Project to view structured AI analysis."
        actionLabel="Upload Paper"
        onAction={() => navigate('/app/upload')}
      />
    );
  }

  const { project, paper, analysis } = activeBundle;

  const handleRunAnalysis = async () => {
    if (project.is_demo) {
      notify('Demo project analysis is already pre-loaded.', { kind: 'info' });
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await analyzePaperApi(project.id, paper?.extracted_pages);
      await refreshActiveBundle(project.id);
      notify('Research Paper Analysis Complete', {
        description: `Processed ${res.sectionsProcessed} paper section(s) with page citations.`,
        kind: 'success',
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <LoadingSpinner
        title="Running Deep Research Analysis (Stages 2 & 3)..."
        subtitle="Processing all extracted pages with Google Gemini and verifying source excerpts."
      />
    );
  }

  if (!analysis) {
    return (
      <div className="space-y-4">
        {errorMsg && <ErrorBanner message={errorMsg} onRetry={handleRunAnalysis} />}
        <EmptyState
          icon={Microscope}
          title={paper ? 'Ready to Analyze Uploaded Paper' : 'Upload a Paper First'}
          description={
            paper
              ? `Paper "${paper.file_name}" (${paper.page_count} pages) is extracted and ready for Gemini analysis.`
              : 'Complete Stage 1 by uploading a PDF research paper before running AI analysis.'
          }
          actionLabel={paper ? 'Run AI Paper Analysis' : 'Go to Upload Paper'}
          onAction={paper ? handleRunAnalysis : () => navigate('/app/upload')}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge>Stages 2 & 3 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
            <Badge variant="success">Extracted from Paper</Badge>
          </div>
          <h1 className="text-2xl font-bold text-white">{analysis.research_title}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Structured facts extracted directly from the paper are clearly separated from AI-generated suggestions.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!project.is_demo && (
            <Button variant="outline" onClick={handleRunAnalysis}>
              <Sparkles className="h-4 w-4" />
              Re-Analyze Paper
            </Button>
          )}
          <Button onClick={() => navigate('/app/blueprint')}>
            Generate Experiment Blueprint
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={handleRunAnalysis} />}

      <Tabs
        value={activeTab}
        onValueChange={(val) => setSearchParams({ tab: val })}
      >
        <TabsList>
          <TabsTrigger value="overview">1. Overview & Problem</TabsTrigger>
          <TabsTrigger value="methodology">2. Methodology & Math (Stage 3)</TabsTrigger>
          <TabsTrigger value="data">3. Datasets & Metrics</TabsTrigger>
          <TabsTrigger value="limitations">4. Limitations & Scope</TabsTrigger>
          <TabsTrigger value="evidence">5. Page Citations vs AI Suggestions</TabsTrigger>
        </TabsList>

        {/* Tab 1: Overview, Abstract, Problem, Objectives, Gap, Proposed Solution */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-violet-400" />
                  Abstract
                </CardTitle>
                <Badge variant="success">Extracted Fact</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm leading-relaxed text-slate-300">{analysis.abstract}</CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Research Problem</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-slate-300">
                {analysis.research_problem}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Research Gap</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-slate-300">
                {analysis.research_gap}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Research Objectives</CardTitle>
              </CardHeader>
              <CardContent>
                {analysis.research_objectives.length > 0 ? (
                  <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                    {analysis.research_objectives.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400">Not explicitly enumerated in paper.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Proposed Solution</CardTitle>
              </CardHeader>
              <CardContent className="text-sm leading-relaxed text-slate-300">
                {analysis.proposed_solution}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Stage 3 Methodology, Algorithms, Math Models, Technologies */}
        <TabsContent value="methodology" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-violet-400" />
                  Extracted Methodology & Pipeline Steps
                </CardTitle>
                <Badge variant="info">Stage 3</Badge>
              </div>
              {analysis.methodology?.summary && (
                <CardDescription>{analysis.methodology.summary}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.methodology?.pipeline_steps?.length ? (
                <div className="space-y-3">
                  {analysis.methodology.pipeline_steps.map((step) => (
                    <div
                      key={step.step_number}
                      className="rounded-xl border border-slate-800 bg-navy-950/70 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-white">
                          Step {step.step_number}: {step.title}
                        </span>
                        {step.page_ref && <Badge variant="secondary">{step.page_ref}</Badge>}
                      </div>
                      <p className="mt-1.5 text-sm text-slate-300">{step.description}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No discrete pipeline steps extracted.</p>
              )}

              <div className="grid gap-4 pt-2 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-navy-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                    Architecture Details
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {analysis.methodology?.architecture_details || 'Not specified in paper'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-navy-950/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                    Training Configuration
                  </p>
                  <p className="mt-2 text-sm text-slate-300">
                    {analysis.methodology?.training_configuration || 'Not specified in paper'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  Algorithms Used
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.algorithms_used.length > 0 ? (
                  analysis.algorithms_used.map((alg, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-800 bg-navy-950/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{alg.name}</span>
                        {alg.page_ref && <Badge variant="secondary">{alg.page_ref}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{alg.purpose}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No explicit algorithms listed.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-violet-400" />
                  Mathematical Models & Formulations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.mathematical_models.length > 0 ? (
                  analysis.mathematical_models.map((m, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-800 bg-navy-950/60 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-white">{m.name}</span>
                        {m.page_ref && <Badge variant="secondary">{m.page_ref}</Badge>}
                      </div>
                      <pre className="mt-2 overflow-x-auto rounded bg-slate-950 px-2.5 py-1.5 font-mono text-xs text-violet-300">
                        {m.equation_or_formulation}
                      </pre>
                      <p className="mt-1.5 text-xs text-slate-400">{m.explanation}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No explicit mathematical equations extracted.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Technologies & Hyperparameters Mentioned</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {analysis.technologies_used.length > 0 ? (
                  analysis.technologies_used.map((t, i) => (
                    <Badge key={i} variant="default">
                      {t}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-slate-400">Not specified in paper</span>
                )}
              </div>
              {analysis.methodology?.hyperparameters?.length ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {analysis.methodology.hyperparameters.map((h, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-navy-950/60 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-200">{h.name}: </span>
                      <span className="text-violet-300">{h.value}</span>
                      {h.page_ref && <span className="ml-1.5 text-slate-500">({h.page_ref})</span>}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Dataset Information & Evaluation Metrics */}
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4 text-violet-400" />
                Dataset Information (Extracted from Paper)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.dataset_information?.datasets?.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {analysis.dataset_information.datasets.map((ds, i) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-navy-950/70 p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{ds.name}</span>
                        {ds.page_ref && <Badge variant="secondary">{ds.page_ref}</Badge>}
                      </div>
                      <p className="mt-1.5 text-sm text-slate-300">{ds.description}</p>
                      <p className="mt-2 text-xs text-slate-400">
                        Size: {ds.size || 'Not specified'} • Split: {ds.split_info || 'Not specified'}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No dataset details specified in paper.</p>
              )}

              {analysis.dataset_information?.preprocessing_steps?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Preprocessing Steps
                  </p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
                    {analysis.dataset_information.preprocessing_steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evaluation Metrics & Paper-Reported Values</CardTitle>
              <CardDescription>
                These numbers are reported by the paper authors—not measured by Paper2Prototype execution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.evaluation_metrics.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {analysis.evaluation_metrics.map((m, i) => (
                    <div key={i} className="rounded-xl border border-slate-800 bg-navy-950/70 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-400">{m.metric_name}</span>
                        {m.page_ref && <Badge variant="secondary">{m.page_ref}</Badge>}
                      </div>
                      <p className="mt-1 text-2xl font-bold text-violet-300">{m.reported_value}</p>
                      <p className="mt-1 text-xs text-slate-400">{m.context}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No evaluation metrics extracted.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Limitations & Future Scope */}
        <TabsContent value="limitations" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400" />
                Limitations
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.limitations.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                  {analysis.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No explicit limitations documented.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Future Scope</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis.future_scope.length > 0 ? (
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
                  {analysis.future_scope.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400">No future scope items documented.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Page Citations vs AI Suggestions */}
        <TabsContent value="evidence" className="space-y-4">
          <Alert variant="info">
            Factuality Policy: Direct quotations below come from extracted paper pages. Items under "AI-Generated Suggestions" are non-factual engineering recommendations added to help prototype implementation.
          </Alert>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Quote className="h-4 w-4 text-emerald-400" />
                    Verbatim Source Excerpts
                  </CardTitle>
                  <Badge variant="success">Extracted Fact</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.source_excerpts.length > 0 ? (
                  analysis.source_excerpts.map((ex, i) => (
                    <div key={i} className="rounded-lg border border-slate-800 bg-navy-950/60 p-3 text-xs">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-semibold text-emerald-300">{ex.field}</span>
                        <Badge variant="secondary">Page {ex.page_number}</Badge>
                      </div>
                      <p className="italic text-slate-300">"{ex.excerpt}"</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No verbatim excerpts recorded.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                    AI-Generated Suggestions
                  </CardTitle>
                  <Badge variant="warning">AI Suggestion (Not in Paper)</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysis.ai_suggestions.length > 0 ? (
                  analysis.ai_suggestions.map((sug, i) => (
                    <div key={i} className="rounded-lg border border-violet-500/25 bg-violet-950/20 p-3 text-xs">
                      <p className="font-semibold text-violet-300">{sug.category}</p>
                      <p className="mt-1 text-slate-200">{sug.suggestion}</p>
                      <p className="mt-1 text-slate-400">Rationale: {sug.rationale}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-400">No AI suggestions generated.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
