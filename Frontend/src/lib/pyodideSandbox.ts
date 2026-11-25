import { CodeFile } from '@/types';

export interface SandboxExecutionOutput {
  status: 'completed' | 'failed' | 'timeout';
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
  generated_files: Array<{
    name: string;
    size: number;
    content_base64?: string;
    text_preview?: string | null;
  }>;
  metrics?: Record<string, unknown>;
}

/**
 * Executes Python files inside an isolated browser Web Worker powered by Pyodide (WebAssembly).
 * Enforces a hard timeout by terminating the worker if execution exceeds `timeoutSeconds`.
 */
export function runInBrowserPyodide(
  entryFile: string,
  files: CodeFile[],
  options?: {
    timeoutSeconds?: number;
    onProgress?: (msg: string) => void;
  }
): Promise<SandboxExecutionOutput> {
  const timeoutMs = (options?.timeoutSeconds ?? 60) * 1000;

  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('Web Workers are not supported in this browser environment.'));
      return;
    }

    const worker = new Worker('/pyodide-worker.js');
    const started = performance.now();
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      resolve({
        status: 'timeout',
        stdout: '',
        stderr: `Browser sandbox execution timed out after ${options?.timeoutSeconds ?? 60}s.`,
        exit_code: -1,
        execution_time_ms: Math.round(performance.now() - started),
        generated_files: [],
      });
    }, timeoutMs);

    worker.onmessage = (event) => {
      const msg = event.data;
      if (msg?.type === 'progress') {
        options?.onProgress?.(String(msg.message || ''));
        return;
      }
      if (msg?.type === 'result' && !settled) {
        settled = true;
        window.clearTimeout(timer);
        worker.terminate();
        resolve(msg.payload as SandboxExecutionOutput);
      }
    };

    worker.onerror = (err) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      worker.terminate();
      resolve({
        status: 'failed',
        stdout: '',
        stderr: err.message || 'Failed to run Pyodide Web Worker.',
        exit_code: -1,
        execution_time_ms: Math.round(performance.now() - started),
        generated_files: [],
      });
    };

    worker.postMessage({ entryFile, files });
  });
}

/**
 * Checks whether a local companion sandbox-runner server is reachable at `baseUrl`.
 */
export async function checkLocalSandboxHealth(baseUrl: string): Promise<boolean> {
  try {
    const clean = baseUrl.trim().replace(/\/+$/, '');
    const res = await fetch(`${clean}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Executes Python files against a user's local companion sandbox-runner (e.g. http://localhost:8080).
 */
export async function runInLocalCompanionSandbox(
  baseUrl: string,
  entryFile: string,
  files: CodeFile[],
  apiKey?: string
): Promise<SandboxExecutionOutput> {
  const clean = baseUrl.trim().replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey?.trim()) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    headers['X-Sandbox-Key'] = apiKey.trim();
  }

  const res = await fetch(`${clean}/execute`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      entry_file: entryFile,
      files: files.map((f) => ({ path: f.path, content: f.content })),
      limits: {
        cpu_cores: 1,
        memory_mb: 512,
        timeout_seconds: 60,
        network: 'disabled',
      },
    }),
    signal: AbortSignal.timeout(70000),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Local sandbox returned HTTP ${res.status}: ${errText.slice(0, 300)}`);
  }

  return (await res.json()) as SandboxExecutionOutput;
}
