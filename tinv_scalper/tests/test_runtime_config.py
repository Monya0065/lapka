from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

from app.runtime_config import RuntimeConfigManager


def make_settings():
    return SimpleNamespace(
        max_instruments_per_cycle=24,
        max_api_calls_per_cycle=120,
        max_api_calls_per_minute=420,
        max_candle_age_sec=120,
        adaptive_scan_enabled=True,
        adaptive_scan_min_cap=6,
        api_budget_soft_ratio=0.85,
        scan_recovery_cycles=4,
        api_budget_recovery_cycles=4,
        api_budget_recover_ratio=0.55,
        min_mom_60m=0.006,
        min_mom_5m=0.001,
        max_spread_pct=0.2,
        emergency_spread_pct=0.4,
        min_volatility_threshold=0.001,
        max_slippage_pct=0.3,
        min_edge=0.05,
        strategy_mode="COMPOSITE",
        candidate_top_n=8,
        orb_minutes=15,
        orb_breakout_buffer_pct=0.03,
        orb_min_range_pct=0.08,
        orb_weight=0.6,
        bb_period=20,
        bb_stddev=2.0,
        bb_max_distance_pct=2.5,
        bb_rebound_weight=0.4,
        forecast_enabled=True,
        forecast_horizon_min=5,
        forecast_min_samples=16,
        forecast_weight=0.45,
        forecast_min_edge_pct=0.03,
        forecast_min_confidence=0.53,
        forecast_lr=0.35,
        forecast_l2=0.002,
        forecast_epochs=8,
        take_profit_pct=0.5,
        take_profit_1_pct=0.3,
        take_profit_1_fraction=0.5,
        take_profit_1_min_lots=1,
        stop_loss_pct=0.3,
        time_stop_seconds=1200,
        trailing_activation_pct=0.20,
        trailing_stop_pct=0.25,
        breakeven_trigger_pct=0.20,
        breakeven_offset_pct=0.02,
        risk_per_trade_pct=0.01,
        max_lots_cap=100,
        max_position_rub=100000,
        max_leverage=2.0,
        daily_loss_limit_rub=-5000,
        max_daily_drawdown_rub=-7000,
        max_loss_per_symbol_rub=-2000,
        max_trades_per_day=10,
        max_trades_per_hour=3,
        max_daily_slippage_pct=5.0,
        cooldown_after_trade_sec=60,
        cooldown_after_losses_sec=300,
        max_consecutive_losses=3,
        order_fill_timeout_sec=20,
        max_api_latency_ms=1200,
        latency_recovery_cycles=4,
        latency_recover_ratio=0.7,
        order_slices=3,
        limit_order_aggr_bps=4.0,
        liquidity_depth_levels=5,
        min_top_book_qty=100,
        min_top_book_notional_rub=200000.0,
        min_bid_ask_ratio=0.85,
        max_bid_ask_ratio=4.0,
        bluechip_spread_mult=1.25,
        standard_spread_mult=1.0,
        thin_spread_mult=0.75,
        bluechip_slippage_mult=1.2,
        standard_slippage_mult=1.0,
        thin_slippage_mult=0.75,
        no_trade_minutes_after_open=3,
        no_trade_minutes_before_close=5,
        commission_bps=5.0,
        require_preflight_real=True,
        preflight_report_file="logs/preflight_real.json",
        preflight_max_age_sec=86400,
        max_failed_entries_per_symbol=3,
        symbol_ban_seconds=3600,
        reentry_cooldown_sec=180,
        reentry_min_mom5_delta=0.0005,
        max_notional_per_day_rub=5_000_000.0,
        max_notional_per_hour_rub=1_500_000.0,
        order_failure_cb_enabled=True,
        order_failure_cb_threshold=3,
        order_failure_cb_cooldown_sec=900,
        quality_guard_enabled=True,
        quality_guard_min_trades=8,
        quality_guard_window_trades=60,
        quality_guard_max_avg_slippage_pct=0.35,
        quality_guard_min_avg_fill_ratio=0.82,
        quality_guard_max_slippage_std_pct=0.22,
        quality_guard_max_spread_slip_corr=0.85,
        quality_guard_severe_mult=1.6,
        quality_guard_risk_cut=0.65,
        quality_guard_recovery_cycles=6,
    )


def test_runtime_config_update_and_rollback():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"max_api_latency_ms": 3000, "max_trades_per_hour": 5})
        assert res.ok
        assert settings.max_api_latency_ms == 3000
        assert settings.max_trades_per_hour == 5

        rb = cfg.rollback()
        assert rb.ok
        assert settings.max_api_latency_ms == 1200
        assert settings.max_trades_per_hour == 3


def test_runtime_config_rejects_unknown_keys():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"unknown_key": 1})
        assert not res.ok


def test_runtime_config_rejects_bad_strategy_mode():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"strategy_mode": "bad"})
        assert not res.ok


def test_runtime_config_rejects_bad_tp1_fraction():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"take_profit_1_fraction": 1.5})
        assert not res.ok


def test_runtime_config_rejects_bad_forecast_confidence():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"forecast_min_confidence": 1.2})
        assert not res.ok


def test_runtime_config_rejects_bad_scan_cap():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"max_instruments_per_cycle": 0})
        assert not res.ok


def test_runtime_config_rejects_bad_api_budget():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"max_api_calls_per_cycle": 5})
        assert not res.ok


def test_runtime_config_rejects_bad_api_budget_recover_ratio():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"api_budget_recover_ratio": 1.2})
        assert not res.ok


def test_runtime_config_rejects_bad_quality_guard_values():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"quality_guard_min_avg_fill_ratio": 1.2})
        assert not res.ok


def test_runtime_config_rejects_bad_quality_corr():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"quality_guard_max_spread_slip_corr": 2.0})
        assert not res.ok


def test_runtime_config_rejects_bad_notional_limits():
    with TemporaryDirectory() as td:
        settings = make_settings()
        path = Path(td) / "runtime.json"
        cfg = RuntimeConfigManager(settings, str(path))

        res = cfg.update({"max_notional_per_day_rub": 0})
        assert not res.ok
