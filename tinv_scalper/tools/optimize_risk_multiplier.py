from __future__ import annotations

import sqlite3
import sys
from pathlib import Path


def load_returns(db_path: Path) -> list[float]:
    con = sqlite3.connect(db_path)
    rows = con.execute("SELECT net_pnl_rub FROM trades ORDER BY ts").fetchall()
    con.close()
    return [float(x[0]) for x in rows]


def score(seq: list[float], m: float) -> tuple[float, float]:
    equity = 0.0
    peak = 0.0
    dd = 0.0
    for r in seq:
        equity += r * m
        peak = max(peak, equity)
        dd = min(dd, equity - peak)
    # Penalize deep drawdown.
    objective = equity + dd * 0.25
    return objective, dd


def main() -> None:
    db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("logs/bot.db")
    returns = load_returns(db)
    if not returns:
        print("No trades in DB")
        return

    best = None
    for i in range(20, 151, 5):
        m = i / 100.0
        obj, dd = score(returns, m)
        if best is None or obj > best[0]:
            best = (obj, m, dd)

    print(f"Best risk multiplier: {best[1]:.2f}")
    print(f"Objective: {best[0]:.2f}")
    print(f"Drawdown: {best[2]:.2f}")


if __name__ == "__main__":
    main()
