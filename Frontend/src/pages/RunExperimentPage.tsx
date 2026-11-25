import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Shield,
  Terminal,
  AlertTriangle,
  Download,
  FolderArchive,
  Clock,
  FileOutput,
  ArrowRight,
  Loader2,
  Cpu,
  Laptop,
  Cloud,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useToast } from '@/contexts/ToastContext';
import { executeExperimentApi } from '@/lib/api';
import { saveClientExecutionResult } from '@/lib/localExecution';
import {
  checkLocalSandboxHealth,
  runInBrowserPyodide,
  runInLocalCompanionSandbox,
} from '@/lib/pyodideSandbox';
import { buildProjectZipBlob, triggerBlobDownload } from '@/lib/projectZip';
import { formatBytes, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBanner } from '@/components/common/ErrorBanner';

type SandboxMode = 'browser' | 'local' | 'cloud';

export function RunExperimentPage() {
  const { user } = useAuth();
  const { activeBundle, refreshActiveBundle } = useProject();
  const { notify } = useToast();
  const navigate = useNavigate();

  const [entryFile, setEntryFile] = useState('main.py');
  const [sandboxMode, setSandboxMode] = useState<SandboxMode>('browser');
  const [localUrl, setLocalUrl] = useState('http://localhost:8080');
  const [localApiKey, setLocalApiKey] = useState('');
  const [localHealthy, setLocalHealthy] = useState<boolean | null>(null);
  const [checkingLocal, setCheckingLocal] = useState(false);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sandboxNotice, setSandboxNotice] = useState<string | null>(null);

  const generatedFilesList = activeBundle?.generatedCode?.files || [];
  useEffect(() => {
    const pyFiles = generatedFilesList.filter((f) => f.path.endsWith('.py'));
    if (pyFiles.length > 0 && !pyFiles.some((f) => f.path === entryFile)) {
      const preferred = pyFiles.find((f) => f.path === 'main.py' || f.path.endsWith('/main.py')) || pyFiles[0];
      setEntryFile(preferred.path);
    }
  }, [generatedFilesList, entryFile]);

  if (!activeBundle) {
    return (
      <EmptyState
        icon={Play}
        title="No Project Selected"
        description="Generate Python code in Stage 6 before running an experiment."
        actionLabel="Go to Dashboard"
        onAction={() => navigate('/app/dashboard')}
      />
    );
  }

  const { project, generatedCode, runs } = activeBundle;

  if (!generatedCode) {
    return (
      <EmptyState
        icon={Play}
        title="Generate Starter Code First"
        description="Complete Stage 6 (Python Code Generation) before executing the experiment."
        actionLabel="Go to Code Generator"
        onAction={() => navigate('/app/code')}
      />
    );
  }

  const latestRun = runs[0] || null;
  const pythonFiles = generatedCode.files.filter((f) => f.path.endsWith('.py'));

  const handleDownloadZip = async () => {
    const blob = await buildProjectZipBlob(generatedCode);
    triggerBlobDownload(blob, `${generatedCode.project_name || 'experiment'}.zip`);
    notify('Project ZIP downloaded for local execution', { kind: 'success' });
  };

  const handleCheckLocal = async () => {
    setCheckingLocal(true);
    const ok = await checkLocalSandboxHealth(localUrl);
    setLocalHealthy(ok);
    setCheckingLocal(false);
    if (ok) {
      notify('Local sandbox runner is online', { kind: 'success' });
    } else {
      notify('Local sandbox runner not reachable', {
        description: `Start sandbox-runner on ${localUrl} first.`,
        kind: 'warning',
      });
    }
  };

  const handleRunExperiment = async () => {
    if (project.is_demo) {
      setSandboxNotice(
        'DEMO DATA Mode: Paper2Prototype never fakes experiment execution. Download the starter project ZIP below to run locally, or create your own project and run it in the Browser Sandbox, Local Machine Sandbox, or Cloud Sandbox.'
      );
      return;
    }

    setRunning(true);
    setErrorMsg(null);
    setSandboxNotice(null);
    setProgressMsg(null);

    try {
      if (sandboxMode === 'browser') {
        if (!user) throw new Error('Please log in to save browser sandbox execution results.');
        const output = await runInBrowserPyodide(entryFile, generatedCode.files, {
          timeoutSeconds: 60,
          onProgress: (msg) => setProgressMsg(msg),
        });
        const { run } = await saveClientExecutionResult({
          projectId: project.id,
          userId: user.id,
          codeId: generatedCode.id,
          entryFile,
          sandboxProvider: 'browser-pyodide-wasm',
          output,
          paperMetrics: activeBundle.analysis?.evaluation_metrics || [],
          currentStage: project.current_stage,
          stageStatuses: project.stage_statuses,
        });
        await refreshActiveBundle(project.id);
        if (run.status === 'completed') {
          notify('Experiment executed in Browser Pyodide Sandbox', { kind: 'success' });
        } else {
          notify(`Browser execution finished with status: ${run.status}`, { kind: 'warning' });
        }
        return;
      }

      if (sandboxMode === 'local') {
        if (!user) throw new Error('Please log in to save local sandbox execution results.');
        setProgressMsg(`Sending code to local sandbox (${localUrl})...`);
        const output = await runInLocalCompanionSandbox(
          localUrl,
          entryFile,
          generatedCode.files,
          localApiKey
        );
        const { run } = await saveClientExecutionResult({
          projectId: project.id,
          userId: user.id,
          codeId: generatedCode.id,
          entryFile,
          sandboxProvider: 'local-companion-sandbox',
          output,
          paperMetrics: activeBundle.analysis?.evaluation_metrics || [],
          currentStage: project.current_stage,
          stageStatuses: project.stage_statuses,
        });
        await refreshActiveBundle(project.id);
        if (run.status === 'completed') {
          notify('Experiment executed on Local Machine Sandbox', { kind: 'success' });
        } else {
          notify(`Local execution finished with status: ${run.status}`, { kind: 'warning' });
        }
        return;
      }

      const res = await executeExperimentApi(project.id, entryFile, generatedCode.files);
      await refreshActiveBundle(project.id);

      if (!res.configured) {
        setSandboxNotice(
          res.setupInstructions?.message ||
            'External sandbox provider is not configured. Switch to Browser Sandbox or Local Machine Sandbox, or download the ZIP.'
        );
        notify('Cloud sandbox not configured', {
          description: 'Try Browser Sandbox (zero setup) or Local Machine Sandbox.',
          kind: 'warning',
        });
      } else if (res.run.status === 'completed') {
        notify('Experiment executed successfully in isolated cloud sandbox', { kind: 'success' });
      } else {
        notify(`Execution finished with status: ${res.run.status}`, { kind: 'warning' });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Execution request failed');
    } finally {
      setRunning(false);
      setProgressMsg(null);
    }
  };

  const handleDownloadRunLogs = () => {
    if (!latestRun) return;
    const text = `=== STATUS: ${latestRun.status} ===\n=== EXIT CODE: ${latestRun.exit_code ?? 'N/A'} ===\n\n--- STDOUT ---\n${latestRun.stdout_log}\n\n--- STDERR ---\n${latestRun.stderr_log}\n`;
    triggerBlobDownload(new Blob([text], { type: 'text/plain;charset=utf-8' }), `run_${latestRun.id}.log`);
  };

  const handleDownloadArtifact = (artifact: { name: string; content_base64?: string; text_preview?: string | null }) => {
    const downloadName = artifact.name.split('/').pop() || artifact.name;
    if (artifact.content_base64) {
      const bin = atob(artifact.content_base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      triggerBlobDownload(new Blob([bytes]), downloadName);
    } else if (artifact.text_preview) {
      triggerBlobDownload(new Blob([artifact.text_preview], { type: 'text/plain' }), downloadName);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge>Stage 7 of 9</Badge>
            {project.is_demo && <Badge variant="warning">DEMO DATA</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-white">Isolated Experiment Execution Engine</h1>
          <p className="mt-1 text-sm text-slate-400">
            Executes Python prototypes strictly inside an isolated external sandbox container—never inside the app server or Edge Function.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownloadZip}>
            <FolderArchive className="h-4 w-4" />
            Download Project ZIP
          </Button>
          <Button onClick={() => navigate('/app/results')}>
            Next: Result Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Security Isolation Spec */}
      <Card className="border-emerald-500/30 bg-emerald-950/15">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5 text-xs">
          <div className="flex items-center gap-2.5 text-emerald-200">
            <Shield className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="font-semibold">Sandbox Isolation Policy Enforced</p>
              <p className="text-emerald-200/80">
                1 vCPU • 512 MB RAM • 60s Timeout • Network Disabled • Ephemeral /tmp Storage • Zero Access to App Secrets
              </p>
            </div>
          </div>
          <Badge variant="success">No Server-Side Eval</Badge>
        </CardContent>
      </Card>

      {/* Run Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Launch Experiment Run</CardTitle>
          <CardDescription>
            Choose how to execute your prototype using your own machine resources or a cloud sandbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setSandboxMode('browser')}
              className={`rounded-xl border p-3 text-left transition ${
                sandboxMode === 'browser'
                  ? 'border-violet-500 bg-violet-500/15 text-white'
                  : 'border-slate-800 bg-navy-950/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  Browser Sandbox
                </span>
                <Badge variant="success">Zero Setup</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Runs Python in an isolated Pyodide WebAssembly worker (NumPy, SciPy, scikit-learn, Pandas, Matplotlib).
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSandboxMode('local')}
              className={`rounded-xl border p-3 text-left transition ${
                sandboxMode === 'local'
                  ? 'border-violet-500 bg-violet-500/15 text-white'
                  : 'border-slate-800 bg-navy-950/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Laptop className="h-4 w-4 text-sky-400" />
                  Local Machine
                </span>
                <Badge variant="secondary">Full Python</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Connects to your local <code className="text-sky-300">sandbox-runner</code> (Docker or Python) on localhost for PyTorch / GPU / full pip support.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setSandboxMode('cloud')}
              className={`rounded-xl border p-3 text-left transition ${
                sandboxMode === 'cloud'
                  ? 'border-violet-500 bg-violet-500/15 text-white'
                  : 'border-slate-800 bg-navy-950/60 text-slate-300 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Cloud className="h-4 w-4 text-emerald-400" />
                  Cloud Sandbox
                </span>
                <Badge variant="info">Edge API</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Delegates to remote <code className="text-emerald-300">SANDBOX_API_URL</code> configured in Supabase Edge Function secrets.
              </p>
            </button>
          </div>

          {sandboxMode === 'local' && (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-navy-950/60 p-4 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={localUrl}
                  onChange={(e) => {
                    setLocalUrl(e.target.value);
                    setLocalHealthy(null);
                  }}
                  placeholder="http://localhost:8080"
                  className="h-9 max-w-xs"
                  aria-label="Local sandbox URL"
                />
                <Input
                  type="password"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  placeholder="Optional SANDBOX_API_KEY"
                  className="h-9 max-w-xs"
                  aria-label="Local sandbox API key"
                />
                <Button type="button" size="sm" variant="outline" onClick={handleCheckLocal} disabled={checkingLocal}>
                  {checkingLocal ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Check Connection
                </Button>
                {localHealthy === true && (
                  <Badge variant="success">
                    <CheckCircle2 className="h-3 w-3" /> Online
                  </Badge>
                )}
                {localHealthy === false && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3" /> Offline
                  </Badge>
                )}
              </div>
              <div className="rounded-lg bg-slate-950 p-2.5 font-mono text-[11px] text-slate-300">
                <p className="text-violet-300"># Start local Docker sandbox on port 8080:</p>
                <p>docker build -t p2p-sandbox ./sandbox-runner && docker run -p 8080:8080 --network none --cpus=1.0 --memory=512m --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m p2p-sandbox</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={entryFile}
              onChange={(e) => setEntryFile(e.target.value)}
              aria-label="Entry Python file"
              className="h-10 rounded-lg border border-slate-700 bg-navy-950 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
            >
              {pythonFiles.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.path}
                </option>
              ))}
            </select>

            <Button onClick={handleRunExperiment} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {running
                ? progressMsg || 'Running in Isolated Sandbox...'
                : 'Run Experiment'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} onRetry={handleRunExperiment} />}

      {latestRun?.status === 'failed' &&
        latestRun.stderr_log &&
        !latestRun.stderr_log.includes('ModuleNotFoundError') && (
          <Alert variant="warning" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-amber-200">
                Python Runtime Error in Generated Code
              </p>
              <p className="text-amber-100/90">
                The sandbox caught an error in the generated script (such as a missing import or syntax issue). Regenerate the code in Stage 6 (now includes automatic typing/import validation) or fix the line directly in the Monaco editor.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/app/code')}
              className="shrink-0"
            >
              Open Code Generator (Stage 6)
            </Button>
          </Alert>
        )}

      {latestRun?.status === 'failed' &&
        latestRun.stderr_log?.includes('ModuleNotFoundError') &&
        latestRun.sandbox_provider === 'browser-pyodide-wasm' && (
          <Alert variant="warning" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-amber-200">
                Package Not Supported in Browser WebAssembly Sandbox
              </p>
              <p className="text-amber-100/90">
                This generated script imports a native/desktop Python package (such as <code className="text-amber-200">pyttsx3</code> or <code className="text-amber-200">torch</code>) that cannot run inside WebAssembly. Switch to <strong>Local Machine</strong> (or regenerate code in Stage 6 for portable scientific Python).
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSandboxMode('local');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="shrink-0"
            >
              <Laptop className="h-3.5 w-3.5" />
              Switch to Local Machine
            </Button>
          </Alert>
        )}

      {/* Step-by-Step User Guide for Browser & Local Machine Sandboxes */}
      <Card className="border-slate-800 bg-navy-950/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-4 w-4 text-violet-400" />
              How to Run Your Experiment (Step-by-Step Guide)
            </CardTitle>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowGuide((v) => !v)}
            >
              {showGuide ? (
                <>
                  Hide Guide <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show Guide <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
          <CardDescription>
            Both options use your own computer&apos;s CPU/RAM and automatically save real metrics &amp; charts to Stage 8 (Results) and Stage 9 (Final Report).
          </CardDescription>
        </CardHeader>

        {showGuide && (
          <CardContent className="grid gap-4 md:grid-cols-2">
            {/* Option 1: Browser Sandbox */}
            <div className="space-y-2.5 rounded-xl border border-violet-500/25 bg-violet-950/10 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-white">
                  <Cpu className="h-4 w-4 text-violet-400" />
                  Option 1: Browser Sandbox (Zero Setup)
                </span>
                <Badge variant="success">Recommended Start</Badge>
              </div>
              <p className="text-slate-300">
                Best for quick runs and papers using <code className="text-violet-300">numpy</code>,{' '}
                <code className="text-violet-300">scipy</code>,{' '}
                <code className="text-violet-300">scikit-learn</code>,{' '}
                <code className="text-violet-300">pandas</code>, or{' '}
                <code className="text-violet-300">matplotlib</code>.
              </p>
              <ol className="list-decimal space-y-1.5 pl-4 text-slate-300">
                <li>Select the <strong>Browser Sandbox</strong> card above.</li>
                <li>Pick your entry file (usually <code className="text-violet-300">main.py</code>).</li>
                <li>Click <strong>Run Experiment</strong> (first run downloads the ~20 MB WebAssembly runtime once).</li>
                <li>View real console logs, artifacts, and open <strong>Stage 8: Result Analysis</strong>.</li>
              </ol>
            </div>

            {/* Option 2: Local Machine Sandbox */}
            <div className="space-y-2.5 rounded-xl border border-sky-500/25 bg-sky-950/10 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-white">
                  <Laptop className="h-4 w-4 text-sky-400" />
                  Option 2: Local Machine Sandbox
                </span>
                <Badge variant="secondary">PyTorch / GPU</Badge>
              </div>
              <p className="text-slate-300">
                Best for heavy deep learning (<code className="text-sky-300">torch</code>,{' '}
                <code className="text-sky-300">tensorflow</code>, custom pip libraries) or GPU workloads.
              </p>
              <ol className="list-decimal space-y-1.5 pl-4 text-slate-300">
                <li>
                  Start the local runner on your PC (port <code className="text-sky-300">8080</code>):
                  <div className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-slate-950 p-2 font-mono text-[10px] text-slate-200">
                    <span className="truncate">
                      docker build -t p2p-sandbox ./sandbox-runner &amp;&amp; docker run -p 8080:8080 --network none --cpus=1.0 --memory=512m --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m p2p-sandbox
                    </span>
                    <button
                      type="button"
                      title="Copy Docker command"
                      onClick={() => {
                        navigator.clipboard?.writeText(
                          'docker build -t p2p-sandbox ./sandbox-runner && docker run -p 8080:8080 --network none --cpus=1.0 --memory=512m --read-only --tmpfs /tmp:rw,noexec,nosuid,size=256m p2p-sandbox'
                        );
                        notify('Docker command copied', { kind: 'success' });
                      }}
                      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Or without Docker: <code className="text-sky-300">cd sandbox-runner &amp;&amp; pip install -r requirements.txt &amp;&amp; uvicorn server:app --port 8080</code>
                  </p>
                </li>
                <li>Select <strong>Local Machine</strong> above and click <strong>Check Connection</strong> until it shows <strong>Online</strong>.</li>
                <li>Click <strong>Run Experiment</strong> — your PC runs the code and saves results automatically.</li>
              </ol>
            </div>
          </CardContent>
        )}
      </Card>

      {(sandboxNotice || latestRun?.status === 'sandbox_not_configured') && (
        <Alert variant="warning" className="space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="space-y-1.5">
              <p className="font-semibold">
                External Sandbox Not Configured — Run Locally or Connect <code className="text-amber-200">sandbox-runner/</code>
              </p>
              <p className="text-xs text-amber-100/90">
                {sandboxNotice ||
                  'SANDBOX_API_URL is not configured in Supabase Edge Function secrets. Paper2Prototype refuses to simulate fake execution outputs.'}
              </p>
              <div className="rounded-lg bg-navy-950/80 p-3 font-mono text-[11px] text-slate-200">
                <p className="text-violet-300"># Option 1: Run locally after downloading ZIP</p>
                <p>unzip {generatedCode.project_name}.zip && cd {generatedCode.project_name}</p>
                <p>pip install -r requirements.txt && python {entryFile} --demo-synthetic</p>
                <p className="mt-2 text-violet-300"># Option 2: Deploy included Docker sandbox-runner</p>
                <p>supabase secrets set SANDBOX_API_URL=https://your-sandbox-url SANDBOX_API_KEY=secret</p>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleDownloadZip}>
            <FolderArchive className="h-4 w-4" />
            Download Complete Project ZIP
          </Button>
        </Alert>
      )}

      {/* Latest Run Details */}
      {latestRun && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-4 w-4 text-violet-400" />
                  Latest Execution Status
                </CardTitle>
                <CardDescription>
                  Started: {formatDate(latestRun.started_at)} • Entry: {latestRun.entry_file}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    latestRun.status === 'completed'
                      ? 'success'
                      : latestRun.status === 'failed' || latestRun.status === 'timeout'
                      ? 'destructive'
                      : 'warning'
                  }
                >
                  {latestRun.status.toUpperCase()}
                </Badge>
                {latestRun.execution_time_ms !== null && (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3" />
                    {latestRun.execution_time_ms} ms
                  </Badge>
                )}
                <Button size="sm" variant="outline" onClick={handleDownloadRunLogs}>
                  <Download className="h-3.5 w-3.5" />
                  Download Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
                  Console Output (stdout)
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-200">
                  {latestRun.stdout_log || '(No stdout output)'}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-rose-300">
                  Error Logs (stderr)
                </p>
                <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-rose-200">
                  {latestRun.stderr_log || '(No errors)'}
                </pre>
              </div>
            </CardContent>
          </Card>

          {latestRun.generated_files?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileOutput className="h-4 w-4 text-violet-400" />
                  Generated Artifact Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {latestRun.generated_files.map((art, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-navy-950/60 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono text-white">{art.name}</span>
                      <span className="ml-2 text-slate-400">({formatBytes(art.size)})</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDownloadArtifact(art)}>
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
