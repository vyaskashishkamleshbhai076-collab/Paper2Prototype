import unittest
from pathlib import Path
import tempfile
from fastapi import HTTPException
from fastapi.testclient import TestClient

import server


class SandboxRunnerTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(server.app)

    def test_health_endpoint(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_safe_resolve_blocks_traversal_and_prefix_bypass(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp) / "p2p_run_abc"
            base.mkdir()
            sibling = Path(tmp) / "p2p_run_abcdef"
            sibling.mkdir()

            with self.assertRaises(HTTPException):
                server.safe_resolve(base, "../p2p_run_abcdef/escape.py")
            with self.assertRaises(HTTPException):
                server.safe_resolve(base, "../../etc/passwd")
            with self.assertRaises(HTTPException):
                server.safe_resolve(base, ".")
            with self.assertRaises(HTTPException):
                server.safe_resolve(base, "")

            ok = server.safe_resolve(base, "src/model.py")
            self.assertTrue(ok.is_relative_to(base.resolve()))

    def test_execute_python_strips_env_and_collects_artifacts(self):
        payload = {
            "entry_file": "main.py",
            "files": [
                {
                    "path": "main.py",
                    "content": (
                        "import json, os\n"
                        "from pathlib import Path\n"
                        "assert 'GEMINI_API_KEY' not in os.environ\n"
                        "Path('result.txt').write_text('artifact_ok', encoding='utf-8')\n"
                        "print('METRICS_JSON:', json.dumps({'accuracy': 0.91, 'f1_macro': 0.89}))\n"
                    ),
                }
            ],
            "limits": {"cpu_cores": 1, "memory_mb": 512, "timeout_seconds": 10, "network": "disabled"},
        }
        res = self.client.post("/execute", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "completed")
        self.assertEqual(body["exit_code"], 0)
        self.assertIn("METRICS_JSON:", body["stdout"])
        self.assertEqual(len(body["generated_files"]), 1)
        self.assertEqual(body["generated_files"][0]["name"], "result.txt")
        self.assertEqual(body["generated_files"][0]["text_preview"], "artifact_ok")

    def test_execute_timeout(self):
        payload = {
            "entry_file": "main.py",
            "files": [{"path": "main.py", "content": "import time\ntime.sleep(5)\n"}],
            "limits": {"timeout_seconds": 2},
        }
        res = self.client.post("/execute", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "timeout")
        self.assertEqual(body["exit_code"], -1)
        self.assertIn("timed out", body["stderr"].lower())

    def test_execute_nonzero_exit_reports_failed(self):
        payload = {
            "entry_file": "main.py",
            "files": [{"path": "main.py", "content": "raise RuntimeError('boom')\n"}],
        }
        res = self.client.post("/execute", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["status"], "failed")
        self.assertNotEqual(body["exit_code"], 0)
        self.assertIn("RuntimeError: boom", body["stderr"])

    def test_execute_ignores_symlink_artifact_exfiltration(self):
        server_path = Path(server.__file__).resolve().as_posix()
        payload = {
            "entry_file": "main.py",
            "files": [
                {
                    "path": "main.py",
                    "content": (
                        "import os\n"
                        "from pathlib import Path\n"
                        "try:\n"
                        f"    os.symlink({server_path!r}, 'leak.txt')\n"
                        "except OSError:\n"
                        "    pass\n"
                        "Path('safe.txt').write_text('ok', encoding='utf-8')\n"
                    ),
                }
            ],
        }
        res = self.client.post("/execute", json=payload)
        self.assertEqual(res.status_code, 200)
        body = res.json()
        names = [f["name"] for f in body["generated_files"]]
        self.assertNotIn("leak.txt", names)
        self.assertIn("safe.txt", names)


if __name__ == "__main__":
    unittest.main()
