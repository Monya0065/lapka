from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import RunMode


@dataclass(slots=True)
class PositionState:
    figi: str = ""
    ticker: str = ""
    lots: int = 0
    avg_price: float = 0.0
    peak_price: float = 0.0
    breakeven_armed: bool = False
    tp1_done: bool = False
    opened_at: str = ""


@dataclass(slots=True)
class Marker:
    ts: str
    type: str
    figi: str
    price: float


@dataclass(slots=True)
class BotState:
    state_version: int = 11
    day: str = ""
    mode: str = RunMode.DRY_RUN.value

    daily_realized_pnl_rub: float = 0.0
    daily_peak_pnl_rub: float = 0.0
    trades_today: int = 0
    consecutive_losses: int = 0
    daily_slippage_pct_sum: float = 0.0
    notional_traded_today_rub: float = 0.0

    symbol_realized_pnl_rub: dict[str, float] = field(default_factory=dict)
    trades_by_hour: dict[str, int] = field(default_factory=dict)
    notional_by_hour_rub: dict[str, float] = field(default_factory=dict)

    symbol_failed_entries: dict[str, int] = field(default_factory=dict)
    symbol_banned_until_ts: dict[str, float] = field(default_factory=dict)
    last_exit_ts_by_symbol: dict[str, float] = field(default_factory=dict)
    last_entry_mom5_by_symbol: dict[str, float] = field(default_factory=dict)

    cooldown_until_ts: float = 0.0
    losses_cooldown_until_ts: float = 0.0
    paused_by_volatility_until_ts: float = 0.0
    low_latency_streak: int = 0
    universe_scan_offset: int = 0
    dynamic_scan_cap: int = 0
    scan_cap_recovery_streak: int = 0
    api_budget_recovery_streak: int = 0
    execution_guard_active: bool = False
    execution_guard_forced_close_only: bool = False
    execution_guard_recovery_streak: int = 0
    execution_risk_factor: float = 1.0
    execution_guard_reason: str = ""
    consecutive_order_failures: int = 0
    order_failure_cooldown_until_ts: float = 0.0
    disk_guard_active: bool = False
    disk_guard_forced_close_only: bool = False
    last_backup_ts: float = 0.0
    last_reconciliation_ts: float = 0.0
    last_universe_reload_ts: float = 0.0

    trading_enabled: bool = True
    close_only_mode: bool = False
    emergency_flatten: bool = False
    killswitched: bool = False

    entry_candidate_figi: str = ""
    entry_candidate_ts: float = 0.0

    paper_cash_rub: float = 1_000_000.0

    position: PositionState = field(default_factory=PositionState)
    markers: list[Marker] = field(default_factory=list)


class StateStore:
    def __init__(self, file_path: str):
        self.path = Path(file_path)

    def load(self) -> BotState:
        if not self.path.exists():
            return BotState()
        raw = json.loads(self.path.read_text(encoding="utf-8"))

        pos = PositionState(**raw.get("position", {}))
        markers = [Marker(**m) for m in raw.get("markers", [])]

        raw["position"] = pos
        raw["markers"] = markers

        # Backward compatibility for older states.
        raw.setdefault("symbol_realized_pnl_rub", {})
        raw.setdefault("trades_by_hour", {})
        raw.setdefault("notional_traded_today_rub", 0.0)
        raw.setdefault("notional_by_hour_rub", {})
        raw.setdefault("daily_peak_pnl_rub", float(raw.get("daily_realized_pnl_rub", 0.0)))
        raw.setdefault("daily_slippage_pct_sum", 0.0)

        raw.setdefault("symbol_failed_entries", {})
        raw.setdefault("symbol_banned_until_ts", {})
        raw.setdefault("last_exit_ts_by_symbol", {})
        raw.setdefault("last_entry_mom5_by_symbol", {})

        raw.setdefault("low_latency_streak", 0)
        raw.setdefault("universe_scan_offset", 0)
        raw.setdefault("dynamic_scan_cap", 0)
        raw.setdefault("scan_cap_recovery_streak", 0)
        raw.setdefault("api_budget_recovery_streak", 0)
        raw.setdefault("execution_guard_active", False)
        raw.setdefault("execution_guard_forced_close_only", False)
        raw.setdefault("execution_guard_recovery_streak", 0)
        raw.setdefault("execution_risk_factor", 1.0)
        raw.setdefault("execution_guard_reason", "")
        raw.setdefault("consecutive_order_failures", 0)
        raw.setdefault("order_failure_cooldown_until_ts", 0.0)
        raw.setdefault("disk_guard_active", False)
        raw.setdefault("disk_guard_forced_close_only", False)
        raw.setdefault("last_backup_ts", 0.0)
        raw.setdefault("state_version", 11)

        return BotState(**raw)

    def save(self, state: BotState) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload: dict[str, Any] = asdict(state)
        self.path.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")


def ensure_day(state: BotState, now: datetime) -> None:
    day = now.date().isoformat()
    if state.day == day:
        return
    state.day = day
    state.daily_realized_pnl_rub = 0.0
    state.daily_peak_pnl_rub = 0.0
    state.trades_today = 0
    state.consecutive_losses = 0
    state.daily_slippage_pct_sum = 0.0
    state.notional_traded_today_rub = 0.0
    state.symbol_realized_pnl_rub = {}
    state.trades_by_hour = {}
    state.notional_by_hour_rub = {}
    state.symbol_failed_entries = {}
    state.symbol_banned_until_ts = {}
    state.cooldown_until_ts = 0.0
    state.losses_cooldown_until_ts = 0.0
    state.api_budget_recovery_streak = 0
    state.execution_guard_active = False
    state.execution_guard_forced_close_only = False
    state.execution_guard_recovery_streak = 0
    state.execution_risk_factor = 1.0
    state.execution_guard_reason = ""
    state.consecutive_order_failures = 0
    state.order_failure_cooldown_until_ts = 0.0


def add_marker(state: BotState, marker_type: str, figi: str, price: float, now: datetime) -> None:
    state.markers.append(Marker(ts=now.isoformat(), type=marker_type, figi=figi, price=price))
    if len(state.markers) > 400:
        del state.markers[: len(state.markers) - 400]


def hour_key(now: datetime) -> str:
    return now.strftime("%Y-%m-%d %H")
