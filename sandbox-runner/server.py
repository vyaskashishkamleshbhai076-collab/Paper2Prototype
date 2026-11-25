import base64
import hmac
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import List, Optional

try:
    import resource
except ImportError:
    resource = None  # Windows does not provide POSIX resource limits

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Paper2Prototype Isolated Sandbox Runner")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

SANDBOX_API_KEY = os.environ.get("SANDBOX_API_KEY", "")


class CodeFile(BaseModel):
    path: str
    content: str


class ResourceLimits(BaseModel):
    cpu_cores: int = 1
    memory_mb: int = 512
    timeout_seconds: int = 60
    network: str = "disabled"


class ExecuteRequest(BaseModel):
    entry_file: str = "main.py"
    files: List[CodeFile]
    limits: Optional[ResourceLimits] = None


def safe_resolve(base_dir: Path, rel_path: str) -> Path:
    if not rel_path or not rel_path.strip():
        raise HTTPException(status_code=400, detail="Empty file path is not allowed")
    base_resolved = base_dir.resolve()
    resolved = (base_resolved / rel_path).resolve()
    if resolved == base_resolved or not resolved.is_relative_to(base_resolved):
        raise HTTPException(status_code=400, detail=f"Invalid file path traversal attempt: {rel_path}")
    return resolved


def set_subprocess_limits(memory_mb: int, cpu_seconds: int):
    if resource is None or os.name != "posix":
        return None

    def _apply():
        # Allow headroom on virtual address space for OpenBLAS/NumPy thread arenas while capping heap/data & CPU
        as_bytes = max(memory_mb * 2, 1024) * 1024 * 1024
        data_bytes = memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (as_bytes, as_bytes))
        resource.setrlimit(resource.RLIMIT_DATA, (data_bytes, data_bytes))
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds))
        resource.setrlimit(resource.RLIMIT_FSIZE, (20 * 1024 * 1024, 20 * 1024 * 1024))

    return _apply


def _decode_stream(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


@app.get("/health")
def health():
    return {"status": "ok", "sandbox": "isolated-python"}


@app.post("/execute")
def execute_experiment(
    req: ExecuteRequest,
    x_sandbox_key: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
):
    if SANDBOX_API_KEY:
        bearer_token = ""
        if authorization and authorization.lower().startswith("bearer "):
            bearer_token = authorization[7:].strip()
        token = x_sandbox_key or bearer_token
        if not hmac.compare_digest(token, SANDBOX_API_KEY):
            raise HTTPException(status_code=401, detail="Invalid sandbox API key")

    limits = req.limits or ResourceLimits()
    timeout_s = min(max(limits.timeout_seconds, 2), 120)
    memory_mb = min(max(limits.memory_mb, 128), 2048)

    with tempfile.TemporaryDirectory(prefix="p2p_run_") as tmpdir:
        base = Path(tmpdir)
        written_inputs = set()

        for file in req.files:
            target = safe_resolve(base, file.path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(file.content, encoding="utf-8")
            written_inputs.add(str(target.resolve()))

        entry_path = safe_resolve(base, req.entry_file)
        if not entry_path.exists():
            raise HTTPException(status_code=400, detail=f"Entry file {req.entry_file} not found")

        # Strip ALL host environment variables so no secrets leak into executed code
        clean_env = {
            "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin") if os.name == "nt" else "/usr/local/bin:/usr/bin:/bin",
            "HOME": tmpdir,
            "TMPDIR": tmpdir,
            "TEMP": tmpdir,
            "TMP": tmpdir,
            "PYTHONUNBUFFERED": "1",
            "MPLBACKEND": "Agg",
            "OPENBLAS_NUM_THREADS": "1",
            "OMP_NUM_THREADS": "1",
            "MKL_NUM_THREADS": "1",
        }
        if os.name == "nt" and "SYSTEMROOT" in os.environ:
            clean_env["SYSTEMROOT"] = os.environ["SYSTEMROOT"]

        start = time.monotonic()
        status = "completed"
        try:
            proc = subprocess.run(
                [sys.executable, str(entry_path)],
                cwd=tmpdir,
                env=clean_env,
                capture_output=True,
                text=True,
                timeout=timeout_s,
                preexec_fn=set_subprocess_limits(memory_mb, timeout_s),
            )
            stdout = proc.stdout[:100000]
            stderr = proc.stderr[:100000]
            exit_code = proc.returncode
            if exit_code != 0:
                status = "failed"
        except subprocess.TimeoutExpired as exc:
            stdout = _decode_stream(exc.stdout)[:50000]
            stderr = f"Execution timed out after {timeout_s}s.\n{_decode_stream(exc.stderr)[:10000]}".strip()
            exit_code = -1
            status = "timeout"

        elapsed_ms = int((time.monotonic() - start) * 1000)

        base_resolved = base.resolve()
        generated_files = []
        for p in base.rglob("*"):
            if p.is_symlink() or "__pycache__" in p.parts:
                continue
            if not p.is_file():
                continue
            resolved_p = p.resolve()
            if not resolved_p.is_relative_to(base_resolved):
                continue
            if str(resolved_p) not in written_inputs:
                rel = p.relative_to(base).as_posix()
                raw = p.read_bytes()
                if len(raw) <= 2 * 1024 * 1024:
                    generated_files.append(
                        {
                            "name": rel,
                            "size": len(raw),
                            "content_base64": base64.b64encode(raw).decode("ascii"),
                            "text_preview": raw.decode("utf-8", errors="ignore")[:2000]
                            if rel.endswith((".txt", ".json", ".csv", ".log", ".md"))
                            else None,
                        }
                    )

        return {
            "status": status,
            "stdout": stdout,
            "stderr": stderr,
            "exit_code": exit_code,
            "execution_time_ms": elapsed_ms,
            "generated_files": generated_files,
        }
