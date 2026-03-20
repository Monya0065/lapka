from __future__ import annotations

from datetime import datetime, timedelta, timezone
from tempfile import TemporaryDirectory

from app.storage import ClosedTrade, SqliteStore


def test_signal_reject_stats_counts_rejects():
    with TemporaryDirectory() as td:
        db = SqliteStore(f"{td}/bot.db")
        db.log_event("signal", {"decision": "reject_spread"})
        db.log_event("signal", {"decision": "reject_spread"})
        db.log_event("signal", {"decision": "reject_edge"})
        db.log_event("signal", {"decision": "pass"})
        stats = db.signal_reject_stats(100)
        db.close()

        assert stats
        top = {x["decision"]: int(x["count"]) for x in stats}
        assert top.get("reject_spread") == 2
        assert top.get("reject_edge") == 1


def test_execution_quality_summary_has_values():
    with TemporaryDirectory() as td:
        db = SqliteStore(f"{td}/bot.db")
        db.add_trade(
            ClosedTrade(
                ts="2026-02-16T10:00:00+00:00",
                figi="F1",
                ticker="AAA",
                side="LONG",
                lots=5,
                entry_price=100.0,
                exit_price=101.0,
                gross_pnl_rub=50.0,
                fee_rub=5.0,
                net_pnl_rub=45.0,
                reason="take_profit",
                order_id="o1",
                spread_pct=0.1,
                slippage_pct=0.2,
                fill_ratio=1.0,
                notional_rub=5050.0,
            )
        )
        q = db.execution_quality_summary(100)
        db.close()
        assert q["trades_count"] == 1
        assert q["avg_fill_ratio"] > 0
        assert q["avg_slippage_pct"] >= 0


def test_execution_windows_and_points():
    with TemporaryDirectory() as td:
        db = SqliteStore(f"{td}/bot.db")
        now = datetime.now(timezone.utc)
        db.add_trade(
            ClosedTrade(
                ts=(now - timedelta(minutes=20)).isoformat(),
                figi="F1",
                ticker="AAA",
                side="LONG",
                lots=2,
                entry_price=100.0,
                exit_price=99.5,
                gross_pnl_rub=-10.0,
                fee_rub=1.0,
                net_pnl_rub=-11.0,
                reason="stop_loss",
                order_id="o1",
                spread_pct=0.12,
                slippage_pct=0.25,
                fill_ratio=0.9,
                notional_rub=199.0,
            )
        )
        db.add_trade(
            ClosedTrade(
                ts=(now - timedelta(hours=2)).isoformat(),
                figi="F2",
                ticker="BBB",
                side="LONG",
                lots=1,
                entry_price=200.0,
                exit_price=201.0,
                gross_pnl_rub=1.0,
                fee_rub=0.2,
                net_pnl_rub=0.8,
                reason="take_profit",
                order_id="o2",
                spread_pct=0.08,
                slippage_pct=0.10,
                fill_ratio=1.0,
                notional_rub=201.0,
            )
        )

        windows = db.execution_quality_windows([1, 24], 100)
        points = db.execution_trade_points(10)
        db.close()

        assert len(points) == 2
        by_h = {int(x["hours"]): x for x in windows}
        assert by_h[1]["trades_count"] == 1
        assert by_h[24]["trades_count"] == 2


def test_trade_performance_and_signal_health():
    with TemporaryDirectory() as td:
        db = SqliteStore(f"{td}/bot.db")
        db.add_trade(
            ClosedTrade(
                ts="2026-02-16T10:00:00+00:00",
                figi="F1",
                ticker="AAA",
                side="LONG",
                lots=1,
                entry_price=100.0,
                exit_price=101.0,
                gross_pnl_rub=1.0,
                fee_rub=0.0,
                net_pnl_rub=1.0,
                reason="tp",
                order_id="a",
                spread_pct=0.1,
                slippage_pct=0.1,
                fill_ratio=1.0,
                notional_rub=101.0,
            )
        )
        db.add_trade(
            ClosedTrade(
                ts="2026-02-16T10:05:00+00:00",
                figi="F2",
                ticker="BBB",
                side="LONG",
                lots=1,
                entry_price=100.0,
                exit_price=99.0,
                gross_pnl_rub=-1.0,
                fee_rub=0.0,
                net_pnl_rub=-1.0,
                reason="sl",
                order_id="b",
                spread_pct=0.2,
                slippage_pct=0.2,
                fill_ratio=0.8,
                notional_rub=99.0,
            )
        )
        db.log_event("signal", {"decision": "pass"})
        db.log_event("signal", {"decision": "reject_spread"})
        db.log_event("signal", {"decision": "reject_spread"})
        perf = db.trade_performance_summary(100)
        st = db.execution_stability(100)
        sh = db.signal_health(100)
        db.close()

        assert perf["trades_count"] == 2
        assert perf["wins"] == 1
        assert perf["losses"] == 1
        assert st["trades_count"] == 2
        assert sh["signals_total"] == 3
        assert sh["signals_rejected"] == 2
