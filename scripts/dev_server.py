#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent


class BakhusDevHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str | None = None, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def end_headers(self) -> None:
        # Disable caching so UI changes are visible immediately in local mode.
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self) -> None:  # noqa: N802
        requested = self.translate_path(self.path)
        target = Path(requested)

        # Future-proof for SPA-style routing if more local routes appear later.
        if not target.exists() and not self.path.startswith("/src/"):
            self.path = "/index.html"

        super().do_GET()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bakhus Assistant local dev server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    handler = functools.partial(BakhusDevHandler, directory=str(PROJECT_ROOT))

    class ThreadingServer(socketserver.ThreadingTCPServer):
        allow_reuse_address = True

    with ThreadingServer((args.host, args.port), handler) as httpd:
        print(f"Bakhus Assistant running at http://{args.host}:{args.port}")
        print(f"Serving files from {PROJECT_ROOT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down dev server")


if __name__ == "__main__":
    main()
