from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace

from app.risk import RiskEngine
from app.state import BotState


def make_settings():
    return SimpleNamespace(
        risk_per_trade_pct=0.01,
        max_lots_cap=100,
        max_position_rub=50_000,
        max_leverage=2.0,
        daily_loss_limit_rub=-5000,
        max_daily_drawdown_rub=-7000,
        max_loss_per_symbol_rub=-2000,
        max_trades_per_day=5,
        max_trades_per_hour=2,
        max_daily_slippage_pct=4.0,
        cooldown_after_trade_sec=60,
        cooldown_after_losses_sec=300,
        max_consecutive_losses=2,
        abnormal_candle_pct=3.0,
        abnormal_pause_sec=600,
    )


def test_position_sizing_respects_limits():
    risk = RiskEngine(make_settings())
    result = risk.size_position(
        equity_rub=100_000,
        entry_price=250.0,
        lot_size=1,
        stop_loss_pct=1.0,
        max_lots_broker=80,
        risk_multiplier=1.0,
    )

    # lots_by_risk = (100000 * 0.01) / (250 * 0.01) = 400
    assert result.lots_by_risk == 400
    # Final lots limited by max_lots_broker=80 and max_position_rub=50000 -> 200
    assert result.chosen_lots == 80


def test_entry_blocked_by_daily_loss():
    risk = RiskEngine(make_settings())
    state = BotState()
    state.daily_realized_pnl_rub = -6000
    decision = risk.check_entry_allowed(
        state=state,
        now=datetime(2026, 2, 16, 12, 0, 0),
        now_ts=0.0,
        trading_session_ok=True,
        figi="BBG000TEST",
    )
    assert not decision.allowed
    assert decision.reason == "DAILY-LOSS"


def test_position_sizing_accounts_for_lot_size():
    risk = RiskEngine(make_settings())
    result = risk.size_position(
        equity_rub=100_000,
        entry_price=100.0,
        lot_size=10,
        stop_loss_pct=1.0,
        max_lots_broker=200,
        risk_multiplier=1.0,
    )
    # risk budget = 1000; per-lot risk=10 -> 100 lots by risk.
    assert result.lots_by_risk == 100
    # max_position_rub=50_000 and lot notional=1000 -> 50 lots cap.
    assert result.chosen_lots == 50
