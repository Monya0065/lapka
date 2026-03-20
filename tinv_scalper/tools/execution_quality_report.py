from __future__ import annotations

import sys

from app.storage import SqliteStore


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python tools/execution_quality_report.py logs/bot.db [limit]")
        return
    db_path = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 1000

    db = SqliteStore(db_path)
    q = db.execution_quality_summary(limit)
    windows = db.execution_quality_windows([1, 24, 24 * 7], max(limit * 5, 500))
    points = db.execution_trade_points(min(30, limit))
    stability = db.execution_stability(max(100, min(1000, limit)))
    perf = db.trade_performance_summary(max(500, limit))
    signal_health = db.signal_health(max(1000, limit * 2))
    db.close()

    if not q:
        print("No data")
        return

    print("Execution quality summary")
    print(f"trades={int(q['trades_count'])}")
    print(f"avg_fill_ratio={float(q['avg_fill_ratio']):.4f}")
    print(f"avg_slippage_pct={float(q['avg_slippage_pct']):.4f}")
    print(f"avg_spread_pct={float(q['avg_spread_pct']):.4f}")
    print(f"total_notional_rub={float(q['total_notional_rub']):.2f}")
    print(f"est_slippage_rub={float(q['est_slippage_rub']):.2f}")

    print("\nPerformance:")
    print(f"profit_factor={float(perf['profit_factor']):.4f}")
    print(f"expectancy_rub={float(perf['expectancy_rub']):.2f}")
    print(f"max_drawdown_rub={float(perf['max_drawdown_rub']):.2f}")
    print(f"recovery_factor={float(perf['recovery_factor']):.4f}")

    print("\nStability:")
    print(f"slippage_std_pct={float(stability['slippage_std_pct']):.4f}")
    print(f"fill_std={float(stability['fill_std']):.4f}")
    print(f"spread_slippage_corr={float(stability['spread_slippage_corr']):.4f}")

    print("\nSignal health:")
    print(f"signals_total={int(signal_health['signals_total'])}")
    print(f"pass_ratio={float(signal_health['pass_ratio']):.3f}")
    print(f"reject_ratio={float(signal_health['reject_ratio']):.3f}")

    print("\nWindow KPIs:")
    for w in windows:
        print(
            f"{w['window']:>5}  trades={int(w['trades_count']):<4} "
            f"fill={float(w['avg_fill_ratio']):.3f} "
            f"slip={float(w['avg_slippage_pct']):.3f}% "
            f"spread={float(w['avg_spread_pct']):.3f}% "
            f"winrate={float(w['winrate_pct']):.1f}% "
            f"net={float(w['net_pnl_rub']):.2f} RUB"
        )

    print("\nBy reason:")
    for row in q["by_reason"]:
        print(
            f"{row['reason']:>20}  trades={int(row['trades_count']):<4} "
            f"fill={float(row['avg_fill_ratio']):.3f} "
            f"slip={float(row['avg_slippage_pct']):.3f}% "
            f"notional={float(row['total_notional_rub']):.2f}"
        )

    print("\nLast trades (slip/fill/pnl):")
    for row in points[-10:]:
        print(
            f"{row['ts']} slip={float(row['slippage_pct']):.3f}% "
            f"fill={float(row['fill_ratio']):.3f} pnl={float(row['net_pnl_rub']):.2f}"
        )


if __name__ == "__main__":
    main()
