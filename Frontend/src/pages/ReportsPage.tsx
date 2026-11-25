import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Download, FolderArchive, CheckCircle2 } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { generateFinalReportPdf } from '@/lib/reportGenerator';
import { deriveReproducibilityFromAnalysis } from '@/lib/reproducibility';
import { buildProjectZipBlob, triggerBlobDownload } from '@/lib/projectZip';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/common/EmptyState';

export function ReportsPage() {
  const { activeBundle, saveGeneratedReport } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);

  if (!activeBundle) {
    return (
      <EmptyState
        icon={FileText}
        title="No Project Selected"
        description="Select a research project or open the Sample Demo Project to generate a downloadable PDF technical report."
        actionLabel="Go to Dashboard"
        onAction={() => navigate('/app/dashboard')}
      />
    );
  }

  const { project, analysis, blueprints, generatedCode, runs, results, reports } = activeBundle;
  const selectedBlueprint = blueprints.find((b) => b.is_selected) || blueprints[0];
  const latestRun = runs[0];
  const latestResult = results[0];
  const repro = analysis ? deriveReproducibilityFromAnalysis(analysis) : null;

  const handleDownloadPdf = async () => {
    setExporting(true);
    try {
      const pdf = generateFinalReportPdf(activeBundle);
      const safeName = (project.title || 'paper2prototype_report')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_');
      pdf.save(`${safeName}_report.pdf`);

      await saveGeneratedReport({
        projectId: project.id,
        title: `${project.title} — Technical Report`,
        sections: {
          research_title: analysis?.research_title || project.title,
          has_blueprint: Boolean(selectedBlueprint),
          has_code: Boolean(generatedCode),
          has_actual_execution: Boolean(latestResult?.is_actual_execution),
        },
        reproducibilityScore: repro?.score ?? null,
        includesActualExecution: Boolean(latestResult?.is_actual_execution),
      });

      notify('PDF Technical Report generated & downloaded', { kind: 'success' });
    } catch (err) {
      notify('PDF generation failed', {
        description: err instanceof Error ? err.message : 'Unable to export PDF',
        kind: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadProjectZip = async () => {
    if (!generatedCode) {
      notify('Generate Python code in Stage 6 first', { kind: 'warning' });
      return;
    }
    const blob = await buildProjectZipBlob(generatedCode);
    triggerBlobDownload(blob, `${generatedCode.project_name || 'project'}.zip`);
    notify('Project ZIP downloaded', { kind: 'success' });
  };

  const sectionsPreview = [
    { num: 1, title: 'Research Paper Overview', ready: Boolean(analysis) },
    { num: 2, title: 'Extracted Research Problem & Gap', ready: Boolean(analysis?.research_problem) },
    { num: 3, title: 'Methodology & Formulations', ready: Boolean(analysis?.methodology) },
    { num: 4, title: 'Experiment Blueprint', ready: Boolean(selectedBlueprint) },
    { num: 5, title: 'Datasets & Resources', ready: Boolean(analysis?.dataset_recommendations?.length || analysis?.dataset_information?.datasets?.length) },
    { num: 6, title: 'Generated Python Code Summary', ready: Boolean(generatedCode) },
    { num: 7, title: 'Actual Execution Details', ready: Boolean(latestRun && latestRun.status !== 'sandbox_not_configured') },
    { num: 8, title: 'Actual Experimental Results', ready: Boolean(latestResult?.is_actual_execution) },
    { num: 9, title: 'Evaluation Metrics (Paper Reference)', ready: Boolean(analysis?.evaluation_metrics?.length) },
    { num: 10, title: 'Limitations', ready: Boolean(analysis?.limitations?.length) },
    { num: 11, title: 'Reproducibility Assessment', ready: Boolean(repro) },
    { num: 12, title: 'References & Source Links', ready: Boolean(analysis?.source_excerpts?.length) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Stage 9 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-white">Final Report Generator</h1>
          <p className="mt-1 text-sm text-slate-400">
            Compile all 12 research-to-prototype sections into a downloadable professional PDF report and complete code archive.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {generatedCode && (
            <Button variant="outline" onClick={handleDownloadProjectZip}>
              <FolderArchive className="h-4 w-4" />
              Download Project
            </Button>
          )}
          <Button onClick={handleDownloadPdf} disabled={exporting}>
            <Download className="h-4 w-4" />
            {exporting ? 'Generating PDF...' : 'Download PDF'}
          </Button>
        </div>
      </div>

      {/* Report 12-section Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Report Structure Preview (12 Sections)</CardTitle>
          <CardDescription>
            Sections without actual sandbox execution explicitly state &ldquo;Not executed yet&rdquo; instead of inventing results.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sectionsPreview.map((s) => (
            <div
              key={s.num}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-navy-950/60 px-3.5 py-3 text-xs"
            >
              <span className="font-medium text-slate-200">
                {s.num}. {s.title}
              </span>
              {s.ready ? (
                <Badge variant="success">
                  <CheckCircle2 className="h-3 w-3" />
                  Included
                </Badge>
              ) : (
                <Badge variant="secondary">Pending</Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Executive Summary Preview */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle>{analysis.research_title}</CardTitle>
            <CardDescription>
              Reproducibility Score: {repro?.score ?? '—'}/100 • Blueprint:{' '}
              {selectedBlueprint ? `${selectedBlueprint.experiment_title} (${selectedBlueprint.implementation_level})` : 'Not generated'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>
              <strong className="text-white">Problem:</strong> {analysis.research_problem}
            </p>
            <p>
              <strong className="text-white">Proposed Solution:</strong> {analysis.proposed_solution}
            </p>
            <p>
              <strong className="text-white">Execution Status:</strong>{' '}
              {latestResult?.is_actual_execution
                ? `Measured sandbox run completed (${latestRun?.execution_time_ms ?? 0} ms).`
                : 'Not executed in sandbox yet (paper-reported metrics only).'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Saved Report Export History */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Generated Report History ({reports.length})</CardTitle>
            <CardDescription>Previously exported technical reports recorded for this project.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-navy-950/60 px-3.5 py-2.5 text-xs"
              >
                <div>
                  <p className="font-medium text-white">{rep.report_title}</p>
                  <p className="text-slate-400">Exported {formatDate(rep.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {rep.reproducibility_score !== null && (
                    <Badge variant="info">Score {rep.reproducibility_score}/100</Badge>
                  )}
                  <Badge variant={rep.includes_actual_execution ? 'success' : 'secondary'}>
                    {rep.includes_actual_execution ? 'Includes Actual Execution' : 'Paper & Code Only'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
