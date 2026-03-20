from __future__ import annotations

import sqlite3
import sys
from collections import defaultdict


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python tools/execution_report.py logs/bot.db [limit]")
        return
    db_path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 500

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        """
        SELECT ts, ticker, reason, lots, entry_price, exit_price, net_pnl_rub
        FROM trades
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    conn.close()

    if not rows:
        print("No trades found")
        return

    trades = [dict(r) for r in rows]
    trades.reverse()

    total = len(trades)
    pnl = sum(float(t["net_pnl_rub"]) for t in trades)
    wins = sum(1 for t in trades if float(t["net_pnl_rub"]) > 0)
    losses = sum(1 for t in trades if float(t["net_pnl_rub"]) < 0)
    avg = pnl / total if total else 0.0
    winrate = wins / total * 100.0 if total else 0.0

    print("Execution report")
    print(f"trades={total} wins={wins} losses={losses} winrate_pct={winrate:.2f}")
    print(f"net_pnl_rub={pnl:.2f} avg_trade_rub={avg:.2f}")

    by_reason: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0.0, "net": 0.0})
    by_ticker: dict[str, dict[str, float]] = defaultdict(lambda: {"count": 0.0, "net": 0.0})
    for t in trades:
        reason = str(t.get("reason", ""))
        ticker = str(t.get("ticker", ""))
        net = float(t.get("net_pnl_rub", 0.0))
        by_reason[reason]["count"] += 1
        by_reason[reason]["net"] += net
        by_ticker[ticker]["count"] += 1
        by_ticker[ticker]["net"] += net

    print("\nBy reason:")
    for reason, stat in sorted(by_reason.items(), key=lambda x: x[1]["net"], reverse=True):
        c = int(stat["count"])
        n = float(stat["net"])
        print(f"{reason:>20}  count={c:<4} net={n:>10.2f}")

    print("\nBy ticker:")
    for ticker, stat in sorted(by_ticker.items(), key=lambda x: x[1]["net"], reverse=True):
        c = int(stat["count"])
        n = float(stat["net"])
        print(f"{ticker:>10}  count={c:<4} net={n:>10.2f}")


if __name__ == "__main__":
    main()
