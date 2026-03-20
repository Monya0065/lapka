from __future__ import annotations

import json
import os
import platform
import sqlite3
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def ok(msg: str) -> None:
    print(f"[OK] {msg}")


def warn(msg: str) -> None:
    print(f"[WARN] {msg}")


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")


def main() -> None:
    failures = 0

    py = sys.version_info
    if py.major == 3 and py.minor in {11, 12, 13}:
        ok(f"Python {py.major}.{py.minor}.{py.micro}")
    elif py.major == 3 and py.minor >= 11:
        warn(f"Python {py.major}.{py.minor}.{py.micro} (SDK may be unstable on this version)")
    else:
        fail("Python must be 3.11+")
        failures += 1

    env_path = ROOT / ".env"
    if env_path.exists():
        ok(".env found")
    else:
        fail(".env missing")
        failures += 1

    token = os.getenv("TINV_TOKEN", "")
    acc = os.getenv("TINV_ACCOUNT_ID", "")
    if token and "your_" not in token:
        ok("TINV_TOKEN is set")
    else:
        warn("TINV_TOKEN is empty or placeholder")

    if acc and "your_" not in acc:
        ok("TINV_ACCOUNT_ID is set")
    else:
        warn("TINV_ACCOUNT_ID is empty or placeholder")

    try:
        import t_tech.invest  # noqa: F401
        ok("t-tech-investments import ok")
    except Exception as exc:
        fail(f"SDK import failed: {exc}")
        failures += 1

    db = ROOT / "logs" / "bot.db"
    db.parent.mkdir(parents=True, exist_ok=True)
    try:
        con = sqlite3.connect(db)
        con.execute("SELECT 1")
        con.close()
        ok("SQLite writable")
    except Exception as exc:
        fail(f"SQLite error: {exc}")
        failures += 1

    hb = ROOT / "logs" / "heartbeat.txt"
    if hb.exists():
        age = time.time() - hb.stat().st_mtime
        if age < 120:
            ok(f"heartbeat fresh ({age:.1f}s)")
        else:
            warn(f"heartbeat stale ({age:.1f}s)")
    else:
        warn("heartbeat not found (bot may be stopped)")

    print(f"Platform: {platform.platform()}")

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
