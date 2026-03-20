from __future__ import annotations

import json
import sys
from pathlib import Path


def main() -> None:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "logs/bot.log")
    if not path.exists():
        print(f"log file not found: {path}")
        raise SystemExit(1)

    entries = 0
    exits = 0
    pnl_values: list[float] = []

    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        if event.get("event") == "order":
            action = event.get("action")
            if action == "entry" and event.get("ok"):
                entries += 1
            if action == "exit" and event.get("ok"):
                exits += 1

        if event.get("event") == "pnl":
            pnl_values.append(float(event.get("realized_rub", 0.0)))

    total = sum(pnl_values)
    wins = sum(1 for x in pnl_values if x > 0)
    losses = sum(1 for x in pnl_values if x < 0)
    win_rate = (wins / len(pnl_values) * 100.0) if pnl_values else 0.0

    print(f"Log file: {path}")
    print(f"Entries: {entries}")
    print(f"Exits: {exits}")
    print(f"Closed trades: {len(pnl_values)}")
    print(f"Wins: {wins} / Losses: {losses} / Win rate: {win_rate:.2f}%")
    print(f"Total realized PnL (RUB): {total:.2f}")


if __name__ == "__main__":
    main()
