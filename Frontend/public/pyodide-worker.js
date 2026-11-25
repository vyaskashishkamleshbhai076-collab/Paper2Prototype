/* eslint-disable no-undef */
// Isolated Web Worker for executing Python prototypes via Pyodide (WebAssembly).
// Runs strictly in browser memory with no access to local filesystem or app secrets.

const PYODIDE_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';

const PYODIDE_SUPPORTED_PACKAGES = new Set([
  'numpy',
  'scipy',
  'scikit-learn',
  'pandas',
  'matplotlib',
  'pillow',
  'sympy',
  'statsmodels',
  'networkx',
  'joblib',
  'scikit-image',
]);

const IMPORT_TO_PACKAGE = {
  sklearn: 'scikit-learn',
  PIL: 'pillow',
  skimage: 'scikit-image',
};

let pyodideReadyPromise = null;

async function getPyodide() {
  if (!pyodideReadyPromise) {
    importScripts(`${PYODIDE_INDEX_URL}pyodide.js`);
    pyodideReadyPromise = loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  }
  return pyodideReadyPromise;
}

function detectNeededPackages(files) {
  const needed = new Set();
  for (const file of files) {
    if (file.path === 'requirements.txt') {
      for (const rawLine of file.content.split(/\r?\n/)) {
        const pkg = rawLine.split('#')[0].trim().split(/[=<>!~\[]/)[0].trim().toLowerCase();
        if (PYODIDE_SUPPORTED_PACKAGES.has(pkg)) needed.add(pkg);
      }
    } else if (file.path.endsWith('.py')) {
      const importMatches = file.content.matchAll(/^\s*(?:import|from)\s+([a-zA-Z0-9_]+)/gm);
      for (const m of importMatches) {
        const mod = m[1];
        const mapped = IMPORT_TO_PACKAGE[mod] || mod.toLowerCase();
        if (PYODIDE_SUPPORTED_PACKAGES.has(mapped)) needed.add(mapped);
      }
    }
  }
  return Array.from(needed);
}

self.onmessage = async (event) => {
  const { entryFile, files } = event.data;
  const stdoutLines = [];
  const stderrLines = [];
  const start = performance.now();

  try {
    self.postMessage({ type: 'progress', message: 'Loading Pyodide WebAssembly runtime...' });
    const pyodide = await getPyodide();

    pyodide.setStdout({
      batched: (text) => stdoutLines.push(text),
    });
    pyodide.setStderr({
      batched: (text) => stderrLines.push(text),
    });

    const packages = detectNeededPackages(files);
    if (packages.length > 0) {
      self.postMessage({
        type: 'progress',
        message: `Loading scientific packages: ${packages.join(', ')}...`,
      });
      await pyodide.loadPackage(packages);
    }

    // Prepare clean /workspace directory
    const FS = pyodide.FS;
    const workspace = '/workspace';
    const clearDir = (dirPath) => {
      if (!FS.analyzePath(dirPath).exists) return;
      for (const name of FS.readdir(dirPath)) {
        if (name === '.' || name === '..') continue;
        const full = `${dirPath}/${name}`;
        const stat = FS.stat(full);
        if (FS.isDir(stat.mode)) {
          clearDir(full);
          FS.rmdir(full);
        } else {
          FS.unlink(full);
        }
      }
    };
    clearDir(workspace);
    if (!FS.analyzePath(workspace).exists) FS.mkdir(workspace);

    const writtenInputs = new Set();
    for (const f of files) {
      const cleanRel = f.path.replace(/^\/+/, '');
      const parts = cleanRel.split('/');
      let cur = workspace;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = `${cur}/${parts[i]}`;
        if (!FS.analyzePath(cur).exists) FS.mkdir(cur);
      }
      const target = `${workspace}/${cleanRel}`;
      FS.writeFile(target, f.content || '', { encoding: 'utf8' });
      writtenInputs.add(target);
    }

    self.postMessage({ type: 'progress', message: `Executing ${entryFile}...` });

    const cleanEntry = entryFile.replace(/^\/+/, '');
    const runnerScript = `
import os, sys, runpy
os.environ["MPLBACKEND"] = "Agg"
os.chdir("${workspace}")
if "${workspace}" not in sys.path:
    sys.path.insert(0, "${workspace}")
sys.argv = ["${cleanEntry}"]
runpy.run_path("${workspace}/${cleanEntry}", run_name="__main__")
`;

    let exitCode = 0;
    let status = 'completed';
    try {
      await pyodide.runPythonAsync(runnerScript);
    } catch (pyErr) {
      exitCode = 1;
      status = 'failed';
      const errMsg = pyErr && pyErr.message ? pyErr.message : String(pyErr);
      stderrLines.push(errMsg);
      const missingMod = errMsg.match(/ModuleNotFoundError:\s*No module named ['"]([^'"]+)['"]/);
      if (missingMod) {
        stderrLines.push(
          `\n[Browser Sandbox Hint] Module "${missingMod[1]}" is not available in the Pyodide WebAssembly runtime. ` +
            'Use the "Local Machine" sandbox mode (docker/uvicorn) or download the project ZIP to run with full pip support.'
        );
      }
    }

    // Collect newly generated files from /workspace
    const generatedFiles = [];
    const walk = (dir) => {
      for (const name of FS.readdir(dir)) {
        if (name === '.' || name === '..' || name === '__pycache__') continue;
        const full = `${dir}/${name}`;
        const stat = FS.stat(full);
        if (FS.isDir(stat.mode)) {
          walk(full);
        } else if (!writtenInputs.has(full)) {
          const bytes = FS.readFile(full);
          if (bytes.length <= 2 * 1024 * 1024) {
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < bytes.length; i += chunkSize) {
              binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
            }
            const rel = full.slice(workspace.length + 1);
            const isText = /\.(txt|json|csv|log|md)$/i.test(rel);
            generatedFiles.push({
              name: rel,
              size: bytes.length,
              content_base64: btoa(binary),
              text_preview: isText ? new TextDecoder().decode(bytes).slice(0, 2000) : null,
            });
          }
        }
      }
    };
    walk(workspace);

    const elapsedMs = Math.round(performance.now() - start);
    self.postMessage({
      type: 'result',
      payload: {
        status,
        stdout: stdoutLines.join('\n').slice(0, 100000),
        stderr: stderrLines.join('\n').slice(0, 100000),
        exit_code: exitCode,
        execution_time_ms: elapsedMs,
        generated_files: generatedFiles,
      },
    });
  } catch (err) {
    const elapsedMs = Math.round(performance.now() - start);
    self.postMessage({
      type: 'result',
      payload: {
        status: 'failed',
        stdout: stdoutLines.join('\n').slice(0, 100000),
        stderr: (err && err.message ? err.message : String(err)) || 'Pyodide worker failed',
        exit_code: -1,
        execution_time_ms: elapsedMs,
        generated_files: [],
      },
    });
  }
};
