#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Bakhus frontend and mock API together")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--frontend-port", type=int, default=4173)
    parser.add_argument("--api-port", type=int, default=8079)
    return parser.parse_args()


def is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((host, port)) == 0


def fetch_json(url: str) -> dict | None:
    try:
        with urllib.request.urlopen(url, timeout=0.5) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError, ValueError):
        return None


def fetch_status(url: str) -> int | None:
    try:
        with urllib.request.urlopen(url, timeout=0.5) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code
    except urllib.error.URLError:
        return None


def wait_for_ready(check, attempts: int = 20, delay: float = 0.25) -> bool:
    for _ in range(attempts):
        if check():
            return True
        time.sleep(delay)
    return False


def main() -> int:
    args = parse_args()
    frontend_url = f"http://{args.host}:{args.frontend_port}/"
    api_health_url = f"http://{args.host}:{args.api_port}/api/health"

    def frontend_ready() -> bool:
        return fetch_status(frontend_url) == 200

    def api_ready() -> bool:
        payload = fetch_json(api_health_url)
        return bool(payload and payload.get("status") == "ok")

    frontend_cmd = [
        sys.executable,
        str(PROJECT_ROOT / "scripts" / "dev_server.py"),
        "--host",
        args.host,
        "--port",
        str(args.frontend_port),
    ]
    api_cmd = [
        sys.executable,
        str(PROJECT_ROOT / "scripts" / "mock_api.py"),
        "--host",
        args.host,
        "--port",
        str(args.api_port),
    ]

    frontend = None
    api = None

    if is_port_open(args.host, args.frontend_port):
        if not frontend_ready():
            print(
                f"Port {args.frontend_port} is already in use, but it does not look like the Bakhus frontend.",
                file=sys.stderr,
            )
            return 1
        print(f"Reusing existing frontend on {frontend_url}")
    else:
        frontend = subprocess.Popen(frontend_cmd, cwd=PROJECT_ROOT)
        if not wait_for_ready(frontend_ready):
            print("Frontend server failed to start.", file=sys.stderr)
            if frontend.poll() is None:
                frontend.terminate()
            return 1

    if is_port_open(args.host, args.api_port):
        if not api_ready():
            print(
                f"Port {args.api_port} is already in use, but it does not look like the Bakhus mock API.",
                file=sys.stderr,
            )
            if frontend is not None and frontend.poll() is None:
                frontend.terminate()
            return 1
        print(f"Reusing existing mock API on http://{args.host}:{args.api_port}/api")
    else:
        api = subprocess.Popen(api_cmd, cwd=PROJECT_ROOT)
        if not wait_for_ready(api_ready):
            print("Mock API failed to start.", file=sys.stderr)
            if frontend is not None and frontend.poll() is None:
                frontend.terminate()
            if api.poll() is None:
                api.terminate()
            return 1

    def shutdown(*_args: object) -> None:
        for proc in (frontend, api):
            if proc is None:
                continue
            if proc.poll() is None:
                proc.terminate()
        for proc in (frontend, api):
            if proc is None:
                continue
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
        raise SystemExit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    print(f"Frontend: http://{args.host}:{args.frontend_port}/")
    print(
        "Frontend with API: "
        f"http://{args.host}:{args.frontend_port}/?dataSource=local-api&apiBaseUrl=http://{args.host}:{args.api_port}/api"
    )
    print(f"Mock API health: http://{args.host}:{args.api_port}/api/health")
    print("Press Ctrl+C to stop both servers.")

    try:
        while True:
            if frontend is not None and frontend.poll() is not None:
                print("Frontend server stopped unexpectedly.")
                shutdown()
            if api is not None and api.poll() is not None:
                print("Mock API stopped unexpectedly.")
                shutdown()
            time.sleep(0.5)
    except KeyboardInterrupt:
        shutdown()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
