from __future__ import annotations

from datetime import datetime
from pathlib import Path


class Heartbeat:
    def __init__(self, path: str):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def touch(self, status: str) -> None:
        self.path.write_text(f"{datetime.utcnow().isoformat()} {status}\n", encoding="utf-8")
