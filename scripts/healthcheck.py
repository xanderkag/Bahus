#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Healthcheck for local Bakhus Assistant server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4173)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    url = f"http://{args.host}:{args.port}/"

    try:
      with urllib.request.urlopen(url, timeout=3) as response:
        status = response.status
        body = response.read(512).decode("utf-8", errors="ignore")
    except urllib.error.URLError as exc:
        print(f"healthcheck failed: {exc}")
        return 1

    if status != 200:
        print(f"healthcheck failed: unexpected status {status}")
        return 1

    if "Bakhus Assistant" not in body:
        print("healthcheck failed: response does not look like the app shell")
        return 1

    print(f"healthcheck ok: {url}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
