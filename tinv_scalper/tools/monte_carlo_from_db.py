from __future__ import annotations

import random
import sqlite3
import statistics
import sys
from pathlib import Path


def load_returns(db_path: Path) -> list[float]:
    con = sqlite3.connect(db_path)
    rows = con.execute("SELECT net_pnl_rub FROM trades ORDER BY ts").fetchall()
    con.close()
    return [float(x[0]) for x in rows]


def simulate(returns: list[float], runs: int = 5000) -> tuple[list[float], list[float]]:
    finals: list[float] = []
    maxdds: list[float] = []

    for _ in range(runs):
        seq = returns[:]
        random.shuffle(seq)
        equity = 0.0
        peak = 0.0
        dd = 0.0
        for r in seq:
            equity += r
            peak = max(peak, equity)
            dd = min(dd, equity - peak)
        finals.append(equity)
        maxdds.append(dd)

    return finals, maxdds


def pct(values: list[float], q: float) -> float:
    s = sorted(values)
    i = max(0, min(len(s) - 1, int((len(s) - 1) * q)))
    return s[i]


def main() -> None:
    db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("logs/bot.db")
    runs = int(sys.argv[2]) if len(sys.argv) > 2 else 5000

    returns = load_returns(db)
    if not returns:
        print("No trades in DB")
        return

    finals, dds = simulate(returns, runs)

    print(f"Runs: {runs}")
    print(f"Final equity P50: {pct(finals, 0.50):.2f}")
    print(f"Final equity P10: {pct(finals, 0.10):.2f}")
    print(f"Final equity P90: {pct(finals, 0.90):.2f}")
    print(f"MaxDD P50: {pct(dds, 0.50):.2f}")
    print(f"MaxDD P10: {pct(dds, 0.10):.2f}")
    print(f"MaxDD P90: {pct(dds, 0.90):.2f}")


if __name__ == "__main__":
    main()
