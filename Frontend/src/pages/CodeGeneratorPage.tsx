import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import {
  Code2,
  Copy,
  Download,
  FolderArchive,
  RefreshCw,
  Sparkles,
  FileCode2,
  Save,
  ArrowRight,
  Info,
} from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { explainCodeApi, generateCodeApi } from '@/lib/api';
import { buildProjectZipBlob, triggerBlobDownload } from '@/lib/projectZip';
import { CodeFile } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';

type VirtualTab = { type: 'code'; index: number } | { type: 'requirements' } | { type: 'readme' };

export function CodeGeneratorPage() {
  const { activeBundle, refreshActiveBundle, saveGeneratedFiles } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [files, setFiles] = useState<CodeFile[]>([]);
  const [dirty, setDirty] = useState(false);
  const [selectedTab, setSelectedTab] = useState<VirtualTab>({ type: 'code', index: 0 });
  const [generating, setGenerating] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<{
    filePath: string;
    summary: string;
    key_components: Array<{ name: string; purpose: string; how_it_maps_to_paper: string }>;
    data_flow: string;
    potential_pitfalls: string[];
  } | null>(null);

  const generatedCode = activeBundle?.generatedCode || null;

  useEffect(() => {
    if (generatedCode?.files) {
      const deduped = generatedCode.files.filter((f) => {
        const lower = f.path.replace(/^\/+/, '').toLowerCase();
        return lower !== 'requirements.txt' && lower !== 'readme.md';
      });
      setFiles(deduped);
      setDirty(false);
      setSelectedTab({ type: 'code', index: 0 });
    } else {
      setFiles([]);
      setDirty(false);
    }
    setExplanation(null);
  }, [generatedCode]);

  if (!activeBundle) {
    return (
      <EmptyState
        icon={Code2}
        title="No Project Selected"
        description="Analyze a research paper and generate an experiment blueprint first."
        actionLabel="Go to Upload Paper"
        onAction={() => navigate('/app/upload')}
      />
    );
  }

  const { project, analysis } = activeBundle;

  if (!analysis) {
    return (
      <EmptyState
        icon={Code2}
        title="Paper Analysis Required"
        description="Complete Stage 2 Research Analysis before generating Python starter code."
        actionLabel="Go to Research Analysis"
        onAction={() => navigate('/app/analysis')}
      />
    );
  }

  const handleGenerateCode = async () => {
    if (project.is_demo) {
      notify('Demo starter code is already loaded.', { kind: 'info' });
      return;
    }
    setGenerating(true);
    setErrorMsg(null);
    try {
      const selectedBp = activeBundle.blueprints.find((b) => b.is_selected);
      await generateCodeApi(project.id, selectedBp?.implementation_level);
      await refreshActiveBundle(project.id);
      notify('Python Starter Project Generated', { kind: 'success' });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Code generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const getActiveContent = (): { name: string; language: string; content: string } => {
    if (!generatedCode) return { name: '', language: 'python', content: '' };
    if (selectedTab.type === 'requirements') {
      return { name: 'requirements.txt', language: 'plaintext', content: generatedCode.requirements_txt };
    }
    if (selectedTab.type === 'readme') {
      return { name: 'README.md', language: 'markdown', content: generatedCode.readme_md };
    }
    const f = files[selectedTab.index];
    return {
      name: f?.path || 'main.py',
      language: f?.language || 'python',
      content: f?.content || '',
    };
  };

  const activeFile = getActiveContent();

  const handleEditorChange = (val: string | undefined) => {
    if (selectedTab.type !== 'code' || val === undefined) return;
    setDirty(true);
    setFiles((prev) =>
      prev.map((f, idx) => (idx === selectedTab.index ? { ...f, content: val } : f))
    );
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(activeFile.content);
      notify(`Copied ${activeFile.name} to clipboard`, { kind: 'success' });
    } catch {
      notify('Clipboard copy unavailable', {
        description: 'Browser blocked clipboard access. Use Download File instead.',
        kind: 'warning',
      });
    }
  };

  const handleDownloadFile = () => {
    const blob = new Blob([activeFile.content], { type: 'text/plain;charset=utf-8' });
    triggerBlobDownload(blob, activeFile.name.split('/').pop() || 'code.py');
  };

  const handleDownloadProjectZip = async () => {
    if (!generatedCode) return;
    const blob = await buildProjectZipBlob({ ...generatedCode, files });
    triggerBlobDownload(blob, `${generatedCode.project_name || 'paper2prototype_project'}.zip`);
    notify('Downloaded complete project ZIP', { kind: 'success' });
  };

  const handleSaveFiles = async () => {
    if (!generatedCode) return;
    setSaving(true);
    try {
      await saveGeneratedFiles(generatedCode.id, files);
      setDirty(false);
      notify('Code edits saved', { kind: 'success' });
    } catch (err) {
      notify('Save failed', {
        description: err instanceof Error ? err.message : 'Could not save code',
        kind: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExplainCode = async () => {
    if (!generatedCode) return;
    if (project.is_demo) {
      setExplanation({
        filePath: activeFile.name,
        summary: generatedCode.code_explanation,
        key_components: [
          {
            name: 'PlantDiseaseMobileNetV2',
            purpose: 'Wraps pretrained MobileNetV2 with Dropout(0.3) and a 38-class classification head.',
            how_it_maps_to_paper: 'Directly implements the architecture described on page 4.',
          },
          {
            name: 'load_imagefolder_splits',
            purpose: 'Applies 224x224 resize, ImageNet normalization, flip/rotation, and 80/10/10 split.',
            how_it_maps_to_paper: 'Matches preprocessing & split configuration on page 3.',
          },
        ],
        data_flow: 'ImageFolder -> Train/Val/Test DataLoaders -> MobileNetV2 -> CrossEntropyLoss -> Macro P/R/F1.',
        potential_pitfalls: generatedCode.simplifications,
      });
      return;
    }

    setExplaining(true);
    try {
      const targetPath = activeFile.name;
      const res = await explainCodeApi(project.id, targetPath, activeFile.content);
      setExplanation({ filePath: targetPath, ...res.explanation });
    } catch (err) {
      notify('Explain Code failed', {
        description: err instanceof Error ? err.message : 'Unable to explain code',
        kind: 'error',
      });
    } finally {
      setExplaining(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Stage 6 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
            {generatedCode && (
              <Badge variant="info">{generatedCode.implementation_level.toUpperCase()} LEVEL</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold text-white">AI Python Code Generator</h1>
          <p className="mt-1 text-sm text-slate-400">
            Inspect, edit, explain, and export the modular starter repository aligned with your research methodology.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {generatedCode && (
            <>
              <Button variant="outline" onClick={handleDownloadProjectZip}>
                <FolderArchive className="h-4 w-4" />
                Download Complete Project
              </Button>
              {!project.is_demo && (
                <Button variant="outline" onClick={handleGenerateCode} disabled={generating}>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate Code
                </Button>
              )}
              <Button onClick={() => navigate('/app/execute')}>
                Next: Run Experiment
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={handleGenerateCode} />}

      {generating && (
        <LoadingSpinner
          title="Synthesizing Python Starter Project..."
          subtitle="Generating modular source files, requirements.txt, README.md, error handling, and documentation."
        />
      )}

      {!generating && !generatedCode && (
        <EmptyState
          icon={Code2}
          title="No Starter Code Generated Yet"
          description="Generate a complete, modular Python project with requirements.txt, README.md, and sample inputs based on your analysis and blueprint."
          actionLabel="Generate Python Starter Project"
          onAction={handleGenerateCode}
        />
      )}

      {!generating && generatedCode && (
        <>
          {generatedCode.simplifications.length > 0 && (
            <Alert variant="warning">
              <p className="font-semibold">Documented Simplifications vs. Full Research Paper</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs">
                {generatedCode.simplifications.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Monaco Workspace */}
          <div className="grid gap-4 lg:grid-cols-4">
            {/* File Tree */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{generatedCode.project_name}/</CardTitle>
                <CardDescription className="text-xs">Project Files</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {files.map((f, idx) => (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => setSelectedTab({ type: 'code', index: idx })}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-xs transition-colors',
                      selectedTab.type === 'code' && selectedTab.index === idx
                        ? 'bg-violet-600/25 text-white border border-violet-500/40'
                        : 'text-slate-400 hover:bg-navy-800 hover:text-slate-100'
                    )}
                  >
                    <FileCode2 className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                    <span className="truncate">{f.path}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setSelectedTab({ type: 'requirements' })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-xs transition-colors',
                    selectedTab.type === 'requirements'
                      ? 'bg-violet-600/25 text-white border border-violet-500/40'
                      : 'text-slate-400 hover:bg-navy-800 hover:text-slate-100'
                  )}
                >
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>requirements.txt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTab({ type: 'readme' })}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-xs transition-colors',
                    selectedTab.type === 'readme'
                      ? 'bg-violet-600/25 text-white border border-violet-500/40'
                      : 'text-slate-400 hover:bg-navy-800 hover:text-slate-100'
                  )}
                >
                  <FileCode2 className="h-3.5 w-3.5 shrink-0 text-sky-400" />
                  <span>README.md</span>
                </button>
              </CardContent>
            </Card>

            {/* Editor Panel */}
            <Card className="lg:col-span-3">
              <CardHeader className="flex flex-col gap-3 border-b border-slate-800/80 pb-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="font-mono text-sm">{activeFile.name}</CardTitle>
                  {dirty && <Badge variant="warning">Unsaved Edits</Badge>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={handleCopyCode}>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Code
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownloadFile}>
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleExplainCode} disabled={explaining}>
                    <Sparkles className="h-3.5 w-3.5 text-violet-400" />
                    {explaining ? 'Explaining...' : 'Explain Code'}
                  </Button>
                  {selectedTab.type === 'code' && (
                    <Button size="sm" onClick={handleSaveFiles} disabled={saving}>
                      <Save className="h-3.5 w-3.5" />
                      {saving ? 'Saving...' : 'Save Edits'}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[460px] w-full overflow-hidden rounded-b-xl">
                  <Editor
                    height="100%"
                    language={activeFile.language}
                    value={activeFile.content}
                    onChange={handleEditorChange}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      wordWrap: 'on',
                      scrollBeyondLastLine: false,
                      readOnly: selectedTab.type !== 'code',
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Code Explanation Panel */}
          {explanation && (
            <Card className="border-violet-500/40">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-violet-400" />
                  Code Explanation — {explanation.filePath}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-slate-200">{explanation.summary}</p>
                {explanation.key_components?.length > 0 && (
                  <div className="grid gap-3 md:grid-cols-2">
                    {explanation.key_components.map((c, i) => (
                      <div key={i} className="rounded-lg border border-slate-800 bg-navy-950/60 p-3">
                        <p className="font-mono text-xs font-semibold text-violet-300">{c.name}</p>
                        <p className="mt-1 text-xs text-slate-300">{c.purpose}</p>
                        <p className="mt-1 text-xs text-slate-400">Paper link: {c.how_it_maps_to_paper}</p>
                      </div>
                    ))}
                  </div>
                )}
                {explanation.data_flow && (
                  <p className="text-xs text-slate-400">
                    <strong className="text-slate-200">Data Flow:</strong> {explanation.data_flow}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Config, Sample Input & Expected Output */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Configuration Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs text-slate-300">
                  {generatedCode.configuration_instructions}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sample Input</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap rounded bg-navy-950 p-2.5 font-mono text-xs text-violet-300">
                  {generatedCode.sample_input}
                </pre>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Expected Output Format</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs text-slate-300">
                  {generatedCode.expected_output_format}
                </pre>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
