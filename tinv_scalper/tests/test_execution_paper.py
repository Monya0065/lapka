from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

from app.execution import ExecutionEngine
from app.state import BotState


class DummyClient:
    pass


class DummyLogger:
    def info(self, *_args, **_kwargs):
        return None


def make_settings():
    return SimpleNamespace(
        order_fill_timeout_sec=10,
        limit_order_aggr_bps=4.0,
        order_slices=2,
        commission_bps=5.0,
    )


def test_paper_mode_applies_fees_on_roundtrip():
    state = BotState()
    state.mode = "PAPER"
    state.paper_cash_rub = 100_000.0

    ex = ExecutionEngine(make_settings(), DummyClient(), DummyLogger())
    now = datetime(2026, 2, 16, 12, 0, 0)

    r1 = ex.open_long(state, "FIGI1", "AAA", lots=10, lot_size=10, expected_price=100.0, now=now)
    assert r1.ok
    # Buy notional=10000, fee=5
    assert abs(state.paper_cash_rub - 89_995.0) < 1e-6

    r2 = ex.close_position(state, reason="test", lot_size=10, expected_price=101.0, now=now)
    assert r2.ok
    # Sell notional=10100, fee=5.05; cash back
    assert abs(state.paper_cash_rub - 100_089.95) < 1e-6
