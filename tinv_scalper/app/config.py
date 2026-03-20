from __future__ import annotations

import os
import subprocess
from dataclasses import dataclass
from datetime import time
from enum import StrEnum
from zoneinfo import ZoneInfo


class RunMode(StrEnum):
    REAL = "REAL"
    DRY_RUN = "DRY_RUN"
    PAPER = "PAPER"


@dataclass(slots=True)
class Settings:
    token: str
    account_id: str
    timezone: ZoneInfo

    ui_host: str
    ui_port: int

    loop_interval_sec: int
    confirm_seconds: int
    reconciliation_interval_sec: int
    universe_reload_sec: int
    max_instruments_per_cycle: int
    max_api_calls_per_cycle: int
    max_api_calls_per_minute: int
    max_candle_age_sec: int
    adaptive_scan_enabled: bool
    adaptive_scan_min_cap: int
    api_budget_soft_ratio: float
    scan_recovery_cycles: int
    api_budget_recovery_cycles: int
    api_budget_recover_ratio: float

    min_mom_60m: float
    min_mom_5m: float
    max_spread_pct: float
    emergency_spread_pct: float
    min_volatility_threshold: float
    max_slippage_pct: float
    min_edge: float
    strategy_mode: str
    candidate_top_n: int
    orb_minutes: int
    orb_breakout_buffer_pct: float
    orb_min_range_pct: float
    orb_weight: float
    bb_period: int
    bb_stddev: float
    bb_max_distance_pct: float
    bb_rebound_weight: float
    forecast_enabled: bool
    forecast_horizon_min: int
    forecast_min_samples: int
    forecast_weight: float
    forecast_min_edge_pct: float
    forecast_min_confidence: float
    forecast_lr: float
    forecast_l2: float
    forecast_epochs: int

    take_profit_pct: float
    take_profit_1_pct: float
    take_profit_1_fraction: float
    take_profit_1_min_lots: int
    stop_loss_pct: float
    time_stop_seconds: int
    trailing_activation_pct: float
    trailing_stop_pct: float
    breakeven_trigger_pct: float
    breakeven_offset_pct: float

    risk_per_trade_pct: float
    max_lots_cap: int
    max_position_rub: float
    max_leverage: float

    daily_loss_limit_rub: float
    max_daily_drawdown_rub: float
    max_loss_per_symbol_rub: float
    max_trades_per_day: int
    max_trades_per_hour: int
    max_daily_slippage_pct: float
    cooldown_after_trade_sec: int
    cooldown_after_losses_sec: int
    max_consecutive_losses: int

    max_failed_entries_per_symbol: int
    symbol_ban_seconds: int
    reentry_cooldown_sec: int
    reentry_min_mom5_delta: float
    max_notional_per_day_rub: float
    max_notional_per_hour_rub: float
    order_failure_cb_enabled: bool
    order_failure_cb_threshold: int
    order_failure_cb_cooldown_sec: int
    quality_guard_enabled: bool
    quality_guard_min_trades: int
    quality_guard_window_trades: int
    quality_guard_max_avg_slippage_pct: float
    quality_guard_min_avg_fill_ratio: float
    quality_guard_max_slippage_std_pct: float
    quality_guard_max_spread_slip_corr: float
    quality_guard_severe_mult: float
    quality_guard_risk_cut: float
    quality_guard_recovery_cycles: int

    order_fill_timeout_sec: int
    max_retry_errors: int
    max_api_latency_ms: int
    latency_recovery_cycles: int
    latency_recover_ratio: float
    order_slices: int
    limit_order_aggr_bps: float
    liquidity_depth_levels: int
    min_top_book_qty: int
    min_top_book_notional_rub: float
    min_bid_ask_ratio: float
    max_bid_ask_ratio: float
    bluechip_spread_mult: float
    standard_spread_mult: float
    thin_spread_mult: float
    bluechip_slippage_mult: float
    standard_slippage_mult: float
    thin_slippage_mult: float

    abnormal_candle_pct: float
    abnormal_pause_sec: int

    moex_start: time
    moex_end: time
    no_trade_minutes_after_open: int
    no_trade_minutes_before_close: int

    commission_bps: float

    default_mode: RunMode
    allow_real: bool
    require_preflight_real: bool
    preflight_report_file: str
    preflight_max_age_sec: int
    require_go_live_check_real: bool
    go_live_report_file: str
    go_live_max_age_sec: int
    desktop_notify: bool
    flatten_on_shutdown_real: bool
    ui_basic_auth_enabled: bool
    ui_basic_auth_user: str
    ui_basic_auth_password: str
    backup_enabled: bool
    backup_interval_sec: int
    backup_dir: str
    backup_keep: int
    disk_guard_min_free_mb: int
    disk_guard_recover_ratio: float
    disk_guard_check_sec: int

    log_level: str
    log_file: str
    state_file: str
    sqlite_file: str
    heartbeat_file: str
    runtime_config_file: str

    keychain_service: str
    keychain_account: str


def _getenv(name: str, default: str | None = None, required: bool = False) -> str:
    value = os.getenv(name, default)
    if required and not value:
        raise ValueError(f"Environment variable {name} is required")
    return value or ""


def _as_time(value: str) -> time:
    hh, mm = value.split(":", 1)
    return time(hour=int(hh), minute=int(mm))


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _as_strategy_mode(value: str) -> str:
    mode = value.strip().upper()
    if mode not in {"MOMENTUM", "COMPOSITE"}:
        return "COMPOSITE"
    return mode


def _token_from_keychain(service: str, account: str) -> str:
    if not service or not account:
        return ""
    try:
        out = subprocess.run(
            ["security", "find-generic-password", "-s", service, "-a", account, "-w"],
            check=True,
            capture_output=True,
            text=True,
            timeout=4,
        )
        return out.stdout.strip()
    except Exception:
        return ""


def _load_token() -> tuple[str, str, str]:
    token = _getenv("TINV_TOKEN", "")
    keychain_service = _getenv("KEYCHAIN_SERVICE", "")
    keychain_account = _getenv("KEYCHAIN_ACCOUNT", "")

    if token:
        return token, keychain_service, keychain_account

    kc_token = _token_from_keychain(keychain_service, keychain_account)
    if kc_token:
        return kc_token, keychain_service, keychain_account

    raise ValueError(
        "TINV_TOKEN is required (or configure KEYCHAIN_SERVICE + KEYCHAIN_ACCOUNT with token in macOS Keychain)"
    )


def load_settings() -> Settings:
    mode = RunMode(_getenv("BOT_MODE", RunMode.DRY_RUN.value).upper())
    token, keychain_service, keychain_account = _load_token()
    ui_basic_auth_user = _getenv("UI_BASIC_AUTH_USER", "")
    ui_basic_auth_password = _getenv("UI_BASIC_AUTH_PASSWORD", "")
    ui_basic_auth_enabled = _as_bool(_getenv("UI_BASIC_AUTH_ENABLED", "false")) and bool(
        ui_basic_auth_user and ui_basic_auth_password
    )

    return Settings(
        token=token,
        account_id=_getenv("TINV_ACCOUNT_ID", required=True),
        timezone=ZoneInfo(_getenv("TZ", "Europe/Moscow")),
        ui_host=_getenv("UI_HOST", "127.0.0.1"),
        ui_port=int(_getenv("UI_PORT", "8000")),
        loop_interval_sec=int(_getenv("LOOP_INTERVAL_SEC", "15")),
        confirm_seconds=int(_getenv("CONFIRM_SECONDS", "15")),
        reconciliation_interval_sec=int(_getenv("RECONCILIATION_INTERVAL_SEC", "60")),
        universe_reload_sec=int(_getenv("UNIVERSE_RELOAD_SEC", "900")),
        max_instruments_per_cycle=int(_getenv("MAX_INSTRUMENTS_PER_CYCLE", "24")),
        max_api_calls_per_cycle=int(_getenv("MAX_API_CALLS_PER_CYCLE", "120")),
        max_api_calls_per_minute=int(_getenv("MAX_API_CALLS_PER_MINUTE", "420")),
        max_candle_age_sec=int(_getenv("MAX_CANDLE_AGE_SEC", "120")),
        adaptive_scan_enabled=_as_bool(_getenv("ADAPTIVE_SCAN_ENABLED", "true")),
        adaptive_scan_min_cap=int(_getenv("ADAPTIVE_SCAN_MIN_CAP", "6")),
        api_budget_soft_ratio=float(_getenv("API_BUDGET_SOFT_RATIO", "0.85")),
        scan_recovery_cycles=int(_getenv("SCAN_RECOVERY_CYCLES", "4")),
        api_budget_recovery_cycles=int(_getenv("API_BUDGET_RECOVERY_CYCLES", "4")),
        api_budget_recover_ratio=float(_getenv("API_BUDGET_RECOVER_RATIO", "0.55")),
        min_mom_60m=float(_getenv("MIN_MOM_60M", "0.006")),
        min_mom_5m=float(_getenv("MIN_MOM_5M", "0.0015")),
        max_spread_pct=float(_getenv("MAX_SPREAD_PCT", "0.15")),
        emergency_spread_pct=float(_getenv("EMERGENCY_SPREAD_PCT", "0.35")),
        min_volatility_threshold=float(_getenv("MIN_VOLATILITY_THRESHOLD", "0.0015")),
        max_slippage_pct=float(_getenv("MAX_SLIPPAGE_PCT", "0.25")),
        min_edge=float(_getenv("MIN_EDGE", "0.07")),
        strategy_mode=_as_strategy_mode(_getenv("STRATEGY_MODE", "COMPOSITE")),
        candidate_top_n=int(_getenv("CANDIDATE_TOP_N", "8")),
        orb_minutes=int(_getenv("ORB_MINUTES", "15")),
        orb_breakout_buffer_pct=float(_getenv("ORB_BREAKOUT_BUFFER_PCT", "0.03")),
        orb_min_range_pct=float(_getenv("ORB_MIN_RANGE_PCT", "0.08")),
        orb_weight=float(_getenv("ORB_WEIGHT", "0.6")),
        bb_period=int(_getenv("BB_PERIOD", "20")),
        bb_stddev=float(_getenv("BB_STDDEV", "2.0")),
        bb_max_distance_pct=float(_getenv("BB_MAX_DISTANCE_PCT", "2.5")),
        bb_rebound_weight=float(_getenv("BB_REBOUND_WEIGHT", "0.4")),
        forecast_enabled=_as_bool(_getenv("FORECAST_ENABLED", "true")),
        forecast_horizon_min=int(_getenv("FORECAST_HORIZON_MIN", "5")),
        forecast_min_samples=int(_getenv("FORECAST_MIN_SAMPLES", "16")),
        forecast_weight=float(_getenv("FORECAST_WEIGHT", "0.45")),
        forecast_min_edge_pct=float(_getenv("FORECAST_MIN_EDGE_PCT", "0.03")),
        forecast_min_confidence=float(_getenv("FORECAST_MIN_CONFIDENCE", "0.53")),
        forecast_lr=float(_getenv("FORECAST_LR", "0.35")),
        forecast_l2=float(_getenv("FORECAST_L2", "0.002")),
        forecast_epochs=int(_getenv("FORECAST_EPOCHS", "8")),
        take_profit_pct=float(_getenv("TAKE_PROFIT_PCT", "0.45")),
        take_profit_1_pct=float(_getenv("TAKE_PROFIT_1_PCT", "0.28")),
        take_profit_1_fraction=float(_getenv("TAKE_PROFIT_1_FRACTION", "0.50")),
        take_profit_1_min_lots=int(_getenv("TAKE_PROFIT_1_MIN_LOTS", "1")),
        stop_loss_pct=float(_getenv("STOP_LOSS_PCT", "0.35")),
        time_stop_seconds=int(_getenv("TIME_STOP_SECONDS", "1500")),
        trailing_activation_pct=float(_getenv("TRAILING_ACTIVATION_PCT", "0.20")),
        trailing_stop_pct=float(_getenv("TRAILING_STOP_PCT", "0.25")),
        breakeven_trigger_pct=float(_getenv("BREAKEVEN_TRIGGER_PCT", "0.20")),
        breakeven_offset_pct=float(_getenv("BREAKEVEN_OFFSET_PCT", "0.02")),
        risk_per_trade_pct=float(_getenv("RISK_PER_TRADE_PCT", "0.005")),
        max_lots_cap=int(_getenv("MAX_LOTS_CAP", "250")),
        max_position_rub=float(_getenv("MAX_POSITION_RUB", "250000")),
        max_leverage=float(_getenv("MAX_LEVERAGE", "2.5")),
        daily_loss_limit_rub=float(_getenv("DAILY_LOSS_LIMIT_RUB", "-10000")),
        max_daily_drawdown_rub=float(_getenv("MAX_DAILY_DRAWDOWN_RUB", "-15000")),
        max_loss_per_symbol_rub=float(_getenv("MAX_LOSS_PER_SYMBOL_RUB", "-4000")),
        max_trades_per_day=int(_getenv("MAX_TRADES_PER_DAY", "20")),
        max_trades_per_hour=int(_getenv("MAX_TRADES_PER_HOUR", "6")),
        max_daily_slippage_pct=float(_getenv("MAX_DAILY_SLIPPAGE_PCT", "3.5")),
        cooldown_after_trade_sec=int(_getenv("COOLDOWN_AFTER_TRADE_SEC", "60")),
        cooldown_after_losses_sec=int(_getenv("COOLDOWN_AFTER_LOSSES_SEC", "300")),
        max_consecutive_losses=int(_getenv("MAX_CONSECUTIVE_LOSSES", "3")),
        max_failed_entries_per_symbol=int(_getenv("MAX_FAILED_ENTRIES_PER_SYMBOL", "3")),
        symbol_ban_seconds=int(_getenv("SYMBOL_BAN_SECONDS", "3600")),
        reentry_cooldown_sec=int(_getenv("REENTRY_COOLDOWN_SEC", "180")),
        reentry_min_mom5_delta=float(_getenv("REENTRY_MIN_MOM5_DELTA", "0.0007")),
        max_notional_per_day_rub=float(_getenv("MAX_NOTIONAL_PER_DAY_RUB", "5000000")),
        max_notional_per_hour_rub=float(_getenv("MAX_NOTIONAL_PER_HOUR_RUB", "1500000")),
        order_failure_cb_enabled=_as_bool(_getenv("ORDER_FAILURE_CB_ENABLED", "true")),
        order_failure_cb_threshold=int(_getenv("ORDER_FAILURE_CB_THRESHOLD", "3")),
        order_failure_cb_cooldown_sec=int(_getenv("ORDER_FAILURE_CB_COOLDOWN_SEC", "900")),
        quality_guard_enabled=_as_bool(_getenv("QUALITY_GUARD_ENABLED", "true")),
        quality_guard_min_trades=int(_getenv("QUALITY_GUARD_MIN_TRADES", "8")),
        quality_guard_window_trades=int(_getenv("QUALITY_GUARD_WINDOW_TRADES", "60")),
        quality_guard_max_avg_slippage_pct=float(_getenv("QUALITY_GUARD_MAX_AVG_SLIPPAGE_PCT", "0.35")),
        quality_guard_min_avg_fill_ratio=float(_getenv("QUALITY_GUARD_MIN_AVG_FILL_RATIO", "0.82")),
        quality_guard_max_slippage_std_pct=float(_getenv("QUALITY_GUARD_MAX_SLIPPAGE_STD_PCT", "0.22")),
        quality_guard_max_spread_slip_corr=float(_getenv("QUALITY_GUARD_MAX_SPREAD_SLIP_CORR", "0.85")),
        quality_guard_severe_mult=float(_getenv("QUALITY_GUARD_SEVERE_MULT", "1.6")),
        quality_guard_risk_cut=float(_getenv("QUALITY_GUARD_RISK_CUT", "0.65")),
        quality_guard_recovery_cycles=int(_getenv("QUALITY_GUARD_RECOVERY_CYCLES", "6")),
        order_fill_timeout_sec=int(_getenv("ORDER_FILL_TIMEOUT_SEC", "35")),
        max_retry_errors=int(_getenv("MAX_RETRY_ERRORS", "5")),
        max_api_latency_ms=int(_getenv("MAX_API_LATENCY_MS", "1300")),
        latency_recovery_cycles=int(_getenv("LATENCY_RECOVERY_CYCLES", "4")),
        latency_recover_ratio=float(_getenv("LATENCY_RECOVER_RATIO", "0.7")),
        order_slices=int(_getenv("ORDER_SLICES", "3")),
        limit_order_aggr_bps=float(_getenv("LIMIT_ORDER_AGGR_BPS", "4")),
        liquidity_depth_levels=int(_getenv("LIQUIDITY_DEPTH_LEVELS", "5")),
        min_top_book_qty=int(_getenv("MIN_TOP_BOOK_QTY", "120")),
        min_top_book_notional_rub=float(_getenv("MIN_TOP_BOOK_NOTIONAL_RUB", "250000")),
        min_bid_ask_ratio=float(_getenv("MIN_BID_ASK_RATIO", "0.85")),
        max_bid_ask_ratio=float(_getenv("MAX_BID_ASK_RATIO", "4.0")),
        bluechip_spread_mult=float(_getenv("BLUECHIP_SPREAD_MULT", "1.25")),
        standard_spread_mult=float(_getenv("STANDARD_SPREAD_MULT", "1.00")),
        thin_spread_mult=float(_getenv("THIN_SPREAD_MULT", "0.75")),
        bluechip_slippage_mult=float(_getenv("BLUECHIP_SLIPPAGE_MULT", "1.20")),
        standard_slippage_mult=float(_getenv("STANDARD_SLIPPAGE_MULT", "1.00")),
        thin_slippage_mult=float(_getenv("THIN_SLIPPAGE_MULT", "0.75")),
        abnormal_candle_pct=float(_getenv("ABNORMAL_CANDLE_PCT", "2.8")),
        abnormal_pause_sec=int(_getenv("ABNORMAL_PAUSE_SEC", "600")),
        moex_start=_as_time(_getenv("MOEX_START", "10:05")),
        moex_end=_as_time(_getenv("MOEX_END", "18:40")),
        no_trade_minutes_after_open=int(_getenv("NO_TRADE_MINUTES_AFTER_OPEN", "3")),
        no_trade_minutes_before_close=int(_getenv("NO_TRADE_MINUTES_BEFORE_CLOSE", "5")),
        commission_bps=float(_getenv("COMMISSION_BPS", "5")),
        default_mode=mode,
        allow_real=_as_bool(_getenv("ALLOW_REAL", "false")),
        require_preflight_real=_as_bool(_getenv("REQUIRE_PREFLIGHT_REAL", "true")),
        preflight_report_file=_getenv("PREFLIGHT_REPORT_FILE", "logs/preflight_real.json"),
        preflight_max_age_sec=int(_getenv("PREFLIGHT_MAX_AGE_SEC", "86400")),
        require_go_live_check_real=_as_bool(_getenv("REQUIRE_GO_LIVE_CHECK_REAL", "true")),
        go_live_report_file=_getenv("GO_LIVE_REPORT_FILE", "logs/go_live_check.json"),
        go_live_max_age_sec=int(_getenv("GO_LIVE_MAX_AGE_SEC", "21600")),
        desktop_notify=_as_bool(_getenv("DESKTOP_NOTIFY", "true")),
        flatten_on_shutdown_real=_as_bool(_getenv("FLATTEN_ON_SHUTDOWN_REAL", "false")),
        ui_basic_auth_enabled=ui_basic_auth_enabled,
        ui_basic_auth_user=ui_basic_auth_user,
        ui_basic_auth_password=ui_basic_auth_password,
        backup_enabled=_as_bool(_getenv("BACKUP_ENABLED", "true")),
        backup_interval_sec=int(_getenv("BACKUP_INTERVAL_SEC", "900")),
        backup_dir=_getenv("BACKUP_DIR", "backups"),
        backup_keep=int(_getenv("BACKUP_KEEP", "48")),
        disk_guard_min_free_mb=int(_getenv("DISK_GUARD_MIN_FREE_MB", "800")),
        disk_guard_recover_ratio=float(_getenv("DISK_GUARD_RECOVER_RATIO", "1.30")),
        disk_guard_check_sec=int(_getenv("DISK_GUARD_CHECK_SEC", "30")),
        log_level=_getenv("LOG_LEVEL", "INFO"),
        log_file=_getenv("LOG_FILE", "logs/bot.log"),
        state_file=_getenv("STATE_FILE", "state.json"),
        sqlite_file=_getenv("SQLITE_FILE", "logs/bot.db"),
        heartbeat_file=_getenv("HEARTBEAT_FILE", "logs/heartbeat.txt"),
        runtime_config_file=_getenv("RUNTIME_CONFIG_FILE", "logs/runtime_config.json"),
        keychain_service=keychain_service,
        keychain_account=keychain_account,
    )
