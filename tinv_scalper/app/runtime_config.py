from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any


@dataclass(slots=True)
class RuntimeConfigResult:
    ok: bool
    reason: str


class RuntimeConfigManager:
    ALLOWED_KEYS = {
        "max_instruments_per_cycle",
        "max_api_calls_per_cycle",
        "max_api_calls_per_minute",
        "max_candle_age_sec",
        "adaptive_scan_enabled",
        "adaptive_scan_min_cap",
        "api_budget_soft_ratio",
        "scan_recovery_cycles",
        "api_budget_recovery_cycles",
        "api_budget_recover_ratio",
        "min_mom_60m",
        "min_mom_5m",
        "max_spread_pct",
        "emergency_spread_pct",
        "min_volatility_threshold",
        "max_slippage_pct",
        "min_edge",
        "strategy_mode",
        "candidate_top_n",
        "orb_minutes",
        "orb_breakout_buffer_pct",
        "orb_min_range_pct",
        "orb_weight",
        "bb_period",
        "bb_stddev",
        "bb_max_distance_pct",
        "bb_rebound_weight",
        "forecast_enabled",
        "forecast_horizon_min",
        "forecast_min_samples",
        "forecast_weight",
        "forecast_min_edge_pct",
        "forecast_min_confidence",
        "forecast_lr",
        "forecast_l2",
        "forecast_epochs",
        "take_profit_pct",
        "take_profit_1_pct",
        "take_profit_1_fraction",
        "take_profit_1_min_lots",
        "stop_loss_pct",
        "time_stop_seconds",
        "trailing_activation_pct",
        "trailing_stop_pct",
        "breakeven_trigger_pct",
        "breakeven_offset_pct",
        "risk_per_trade_pct",
        "max_lots_cap",
        "max_position_rub",
        "max_leverage",
        "daily_loss_limit_rub",
        "max_daily_drawdown_rub",
        "max_loss_per_symbol_rub",
        "max_trades_per_day",
        "max_trades_per_hour",
        "max_daily_slippage_pct",
        "cooldown_after_trade_sec",
        "cooldown_after_losses_sec",
        "max_consecutive_losses",
        "order_fill_timeout_sec",
        "max_api_latency_ms",
        "latency_recovery_cycles",
        "latency_recover_ratio",
        "order_slices",
        "limit_order_aggr_bps",
        "liquidity_depth_levels",
        "min_top_book_qty",
        "min_top_book_notional_rub",
        "min_bid_ask_ratio",
        "max_bid_ask_ratio",
        "bluechip_spread_mult",
        "standard_spread_mult",
        "thin_spread_mult",
        "bluechip_slippage_mult",
        "standard_slippage_mult",
        "thin_slippage_mult",
        "no_trade_minutes_after_open",
        "no_trade_minutes_before_close",
        "commission_bps",
        "max_failed_entries_per_symbol",
        "symbol_ban_seconds",
        "reentry_cooldown_sec",
        "reentry_min_mom5_delta",
        "max_notional_per_day_rub",
        "max_notional_per_hour_rub",
        "order_failure_cb_enabled",
        "order_failure_cb_threshold",
        "order_failure_cb_cooldown_sec",
        "quality_guard_enabled",
        "quality_guard_min_trades",
        "quality_guard_window_trades",
        "quality_guard_max_avg_slippage_pct",
        "quality_guard_min_avg_fill_ratio",
        "quality_guard_max_slippage_std_pct",
        "quality_guard_max_spread_slip_corr",
        "quality_guard_severe_mult",
        "quality_guard_risk_cut",
        "quality_guard_recovery_cycles",
    }

    def __init__(self, settings_obj, file_path: str, history_limit: int = 40):
        self.settings = settings_obj
        self.path = Path(file_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.history_limit = max(5, history_limit)
        self._lock = RLock()

        self._history_path = self.path.with_name(self.path.stem + "_history.json")
        self._state = self._load_or_init()
        self._apply_state_to_settings()

    def _default_state(self) -> dict[str, Any]:
        values: dict[str, Any] = {}
        for key in sorted(self.ALLOWED_KEYS):
            values[key] = getattr(self.settings, key)
        return {
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "revision": 1,
            "values": values,
        }

    def _normalize_state(self, data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
        changed = False
        values = dict(data.get("values", {}))
        for key in sorted(self.ALLOWED_KEYS):
            if key not in values:
                values[key] = getattr(self.settings, key)
                changed = True
        if "revision" not in data:
            data["revision"] = 1
            changed = True
        if "updated_at" not in data:
            data["updated_at"] = datetime.now(timezone.utc).isoformat()
            changed = True
        data["values"] = values
        return data, changed

    def _load_or_init(self) -> dict[str, Any]:
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
                if "values" in data and isinstance(data["values"], dict):
                    data, changed = self._normalize_state(data)
                    if changed:
                        self.path.write_text(json.dumps(data, ensure_ascii=True, indent=2), encoding="utf-8")
                    return data
            except json.JSONDecodeError:
                pass
        state = self._default_state()
        self.path.write_text(json.dumps(state, ensure_ascii=True, indent=2), encoding="utf-8")
        self._history_path.write_text(json.dumps([state], ensure_ascii=True, indent=2), encoding="utf-8")
        return state

    def _load_history(self) -> list[dict[str, Any]]:
        if not self._history_path.exists():
            return [self._state]
        try:
            data = json.loads(self._history_path.read_text(encoding="utf-8"))
            if isinstance(data, list) and data:
                return data
        except json.JSONDecodeError:
            pass
        return [self._state]

    def _save_history(self, entries: list[dict[str, Any]]) -> None:
        if len(entries) > self.history_limit:
            entries = entries[-self.history_limit :]
        self._history_path.write_text(json.dumps(entries, ensure_ascii=True, indent=2), encoding="utf-8")

    def _cast_value(self, key: str, value: Any) -> Any:
        if key == "strategy_mode":
            mode = str(value).strip().upper()
            if mode not in {"MOMENTUM", "COMPOSITE"}:
                raise ValueError("strategy_mode must be MOMENTUM or COMPOSITE")
            return mode
        ref = getattr(self.settings, key)
        typ = type(ref)
        if typ is bool:
            if isinstance(value, bool):
                return value
            return str(value).strip().lower() in {"1", "true", "yes", "on"}
        if typ is int:
            return int(value)
        if typ is float:
            return float(value)
        return value

    def _apply_state_to_settings(self) -> None:
        for key, value in self._state["values"].items():
            if key in self.ALLOWED_KEYS:
                setattr(self.settings, key, self._cast_value(key, value))

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "revision": self._state["revision"],
                "updated_at": self._state["updated_at"],
                "values": dict(self._state["values"]),
            }

    def _validate_values(self, values: dict[str, Any]) -> RuntimeConfigResult:
        try:
            if not 0.0 <= float(values["take_profit_1_fraction"]) <= 1.0:
                return RuntimeConfigResult(False, "take_profit_1_fraction must be in [0,1]")
            if int(values["liquidity_depth_levels"]) < 1:
                return RuntimeConfigResult(False, "liquidity_depth_levels must be >= 1")
            if int(values["max_instruments_per_cycle"]) < 1:
                return RuntimeConfigResult(False, "max_instruments_per_cycle must be >= 1")
            if int(values["max_api_calls_per_cycle"]) < 10:
                return RuntimeConfigResult(False, "max_api_calls_per_cycle must be >= 10")
            if int(values["max_api_calls_per_minute"]) < 30:
                return RuntimeConfigResult(False, "max_api_calls_per_minute must be >= 30")
            if int(values["max_candle_age_sec"]) < 10:
                return RuntimeConfigResult(False, "max_candle_age_sec must be >= 10")
            if int(values["adaptive_scan_min_cap"]) < 1:
                return RuntimeConfigResult(False, "adaptive_scan_min_cap must be >= 1")
            if not 0.2 <= float(values["api_budget_soft_ratio"]) <= 0.98:
                return RuntimeConfigResult(False, "api_budget_soft_ratio must be in [0.2,0.98]")
            if int(values["scan_recovery_cycles"]) < 1:
                return RuntimeConfigResult(False, "scan_recovery_cycles must be >= 1")
            if int(values["api_budget_recovery_cycles"]) < 1:
                return RuntimeConfigResult(False, "api_budget_recovery_cycles must be >= 1")
            if not 0.2 <= float(values["api_budget_recover_ratio"]) <= 0.95:
                return RuntimeConfigResult(False, "api_budget_recover_ratio must be in [0.2,0.95]")
            if int(values["quality_guard_min_trades"]) < 1:
                return RuntimeConfigResult(False, "quality_guard_min_trades must be >= 1")
            if int(values["quality_guard_window_trades"]) < 5:
                return RuntimeConfigResult(False, "quality_guard_window_trades must be >= 5")
            if float(values["quality_guard_max_avg_slippage_pct"]) <= 0:
                return RuntimeConfigResult(False, "quality_guard_max_avg_slippage_pct must be > 0")
            if not 0.2 <= float(values["quality_guard_min_avg_fill_ratio"]) <= 1.0:
                return RuntimeConfigResult(False, "quality_guard_min_avg_fill_ratio must be in [0.2,1.0]")
            if float(values["quality_guard_max_slippage_std_pct"]) <= 0:
                return RuntimeConfigResult(False, "quality_guard_max_slippage_std_pct must be > 0")
            if not -1.0 <= float(values["quality_guard_max_spread_slip_corr"]) <= 1.0:
                return RuntimeConfigResult(False, "quality_guard_max_spread_slip_corr must be in [-1,1]")
            if not 1.05 <= float(values["quality_guard_severe_mult"]) <= 4.0:
                return RuntimeConfigResult(False, "quality_guard_severe_mult must be in [1.05,4.0]")
            if not 0.05 <= float(values["quality_guard_risk_cut"]) <= 1.0:
                return RuntimeConfigResult(False, "quality_guard_risk_cut must be in [0.05,1.0]")
            if int(values["quality_guard_recovery_cycles"]) < 1:
                return RuntimeConfigResult(False, "quality_guard_recovery_cycles must be >= 1")
            if float(values["max_notional_per_day_rub"]) <= 0:
                return RuntimeConfigResult(False, "max_notional_per_day_rub must be > 0")
            if float(values["max_notional_per_hour_rub"]) <= 0:
                return RuntimeConfigResult(False, "max_notional_per_hour_rub must be > 0")
            if int(values["order_failure_cb_threshold"]) < 1:
                return RuntimeConfigResult(False, "order_failure_cb_threshold must be >= 1")
            if int(values["order_failure_cb_cooldown_sec"]) < 1:
                return RuntimeConfigResult(False, "order_failure_cb_cooldown_sec must be >= 1")
            if float(values["min_bid_ask_ratio"]) <= 0:
                return RuntimeConfigResult(False, "min_bid_ask_ratio must be > 0")
            if float(values["max_bid_ask_ratio"]) < float(values["min_bid_ask_ratio"]):
                return RuntimeConfigResult(False, "max_bid_ask_ratio must be >= min_bid_ask_ratio")
            if float(values["trailing_activation_pct"]) < 0:
                return RuntimeConfigResult(False, "trailing_activation_pct must be >= 0")
            if not 0.0 <= float(values["forecast_min_confidence"]) <= 1.0:
                return RuntimeConfigResult(False, "forecast_min_confidence must be in [0,1]")
            if int(values["forecast_horizon_min"]) < 1:
                return RuntimeConfigResult(False, "forecast_horizon_min must be >= 1")
            if int(values["forecast_epochs"]) < 1:
                return RuntimeConfigResult(False, "forecast_epochs must be >= 1")
        except (TypeError, ValueError):
            return RuntimeConfigResult(False, "invalid numeric values")
        return RuntimeConfigResult(True, "ok")

    def update(self, values: dict[str, Any]) -> RuntimeConfigResult:
        with self._lock:
            unknown = [k for k in values if k not in self.ALLOWED_KEYS]
            if unknown:
                return RuntimeConfigResult(False, f"unknown keys: {unknown}")

            new_values = dict(self._state["values"])
            try:
                for key, value in values.items():
                    new_values[key] = self._cast_value(key, value)
            except (TypeError, ValueError) as exc:
                return RuntimeConfigResult(False, str(exc))

            vr = self._validate_values(new_values)
            if not vr.ok:
                return vr

            history = self._load_history()
            history.append(self._state)
            new_state = {
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "revision": int(self._state.get("revision", 1)) + 1,
                "values": new_values,
            }
            self._state = new_state

            self.path.write_text(json.dumps(self._state, ensure_ascii=True, indent=2), encoding="utf-8")
            self._save_history(history)
            self._apply_state_to_settings()
            return RuntimeConfigResult(True, "ok")

    def rollback(self) -> RuntimeConfigResult:
        with self._lock:
            history = self._load_history()
            if not history:
                return RuntimeConfigResult(False, "history is empty")

            prev = history.pop()
            self._state = prev
            self.path.write_text(json.dumps(self._state, ensure_ascii=True, indent=2), encoding="utf-8")
            self._save_history(history)
            self._apply_state_to_settings()
            return RuntimeConfigResult(True, "rolled back")
