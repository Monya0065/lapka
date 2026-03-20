from __future__ import annotations

import sqlite3
import statistics
import sys
from pathlib import Path


def load_returns(db_path: Path) -> list[float]:
    con = sqlite3.connect(db_path)
    rows = con.execute("SELECT net_pnl_rub FROM trades ORDER BY ts").fetchall()
    con.close()
    return [float(x[0]) for x in rows]


def metrics(values: list[float]) -> dict[str, float]:
    if not values:
        return {"trades": 0.0, "mean": 0.0, "std": 0.0, "win_rate": 0.0, "sum": 0.0}
    mean = statistics.fmean(values)
    std = statistics.pstdev(values) if len(values) > 1 else 0.0
    win_rate = sum(1 for x in values if x > 0) / len(values)
    return {
        "trades": float(len(values)),
        "mean": mean,
        "std": std,
        "win_rate": win_rate,
        "sum": sum(values),
    }


def main() -> None:
    db = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("logs/bot.db")
    train = int(sys.argv[2]) if len(sys.argv) > 2 else 30
    test = int(sys.argv[3]) if len(sys.argv) > 3 else 10

    returns = load_returns(db)
    if len(returns) < train + test:
        print("Not enough trades for walk-forward")
        return

    i = 0
    fold = 1
    while i + train + test <= len(returns):
        tr = returns[i : i + train]
        te = returns[i + train : i + train + test]

        mtr = metrics(tr)
        mte = metrics(te)

        print(f"Fold {fold}")
        print(f"  Train: trades={int(mtr['trades'])} mean={mtr['mean']:.2f} sum={mtr['sum']:.2f} win={mtr['win_rate']*100:.1f}%")
        print(f"  Test : trades={int(mte['trades'])} mean={mte['mean']:.2f} sum={mte['sum']:.2f} win={mte['win_rate']*100:.1f}%")

        i += test
        fold += 1


if __name__ == "__main__":
    main()
