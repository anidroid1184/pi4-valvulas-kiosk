"""
Start the full demo (backend + static web) with a single command.

Usage:
  python -m scripts.dev_start

- FastAPI (backend) on http://127.0.0.1:8000
- Static web on http://127.0.0.1:5500
"""
from __future__ import annotations
import subprocess
import sys
from pathlib import Path
import time

ROOT = Path(__file__).resolve().parents[1]
WEB_DIR = ROOT / 'web'


def run():
    procs = []
    try:
        # 1) Backend (uvicorn)
        uvicorn_cmd = [sys.executable, '-m', 'scripts.run_vision_api']
        procs.append(subprocess.Popen(uvicorn_cmd, cwd=str(ROOT)))

        time.sleep(0.8)  # small stagger

        # 2) Static server for web/
        http_cmd = [sys.executable, '-m', 'http.server', '5500']
        procs.append(subprocess.Popen(http_cmd, cwd=str(WEB_DIR)))

        print('\nRunning...')
        print(' Backend: http://127.0.0.1:8000')
        print('   Web  : http://127.0.0.1:5500')
        print('Press Ctrl+C to stop.')

        # Wait for both
        for p in procs:
            p.wait()
    except KeyboardInterrupt:
        pass
    finally:
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass


if __name__ == '__main__':
    run()
