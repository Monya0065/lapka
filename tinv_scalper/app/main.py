from __future__ import annotations

import json
import signal
import shutil
import subprocess
import sys
import threading
import time
import uuid
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

from app.config import RunMode, Settings, load_settings
from app.execution import ExecutionEngine
from app.forecast import ForecastOutput, train_and_forecast
from app.logging_setup import setup_logging
from app.metrics import MetricsRegistry
from app.notifier import DesktopNotifier
from app.risk import RiskEngine
from app.runtime_config import RuntimeConfigManager
from app.signals import (
    bollinger_rebound_score,
    compute_score,
    has_candle_gaps,
    last_candle_return_pct,
    opening_range_breakout_score,
)
from app.slippage import SlippageEstimate, estimate_buy_slippage, estimate_sell_slippage, orderbook_depth_stats
from app.state import BotState, PositionState, StateStore, ensure_day
from app.storage import ClosedTrade, SqliteStore
from app.tbank_client import ApiKillSwitchError, SdkNotInstalledError, TBankClient
from app.time_rules import in_no_trade_window, trading_session_allowed
from app.ui.server import start_ui_thread
from app.universe import Instrument, build_universe
from app.watchdog import Heartbeat


def _trim(buf: list[dict[str, Any]], limit: int = 120) -> None:
    if len(buf) > limit:
        del buf[: len(buf) - limit]


class TradingBot:
    def __init__(self, settings: Settings):
        self.s = settings
        self.logger = setup_logging(settings.log_file, settings.log_level)

        self.state_store = StateStore(settings.state_file)
        self.state = self.state_store.load()
        if not self.state.mode:
            self.state.mode = settings.default_mode.value
        if self.state.dynamic_scan_cap <= 0:
            self.state.dynamic_scan_cap = max(1, settings.max_instruments_per_cycle)

        self.runtime_cfg = RuntimeConfigManager(settings, settings.runtime_config_file)

        self.db = SqliteStore(settings.sqlite_file)
        self.metrics = MetricsRegistry()
        self.heartbeat = Heartbeat(settings.heartbeat_file)
        self.notifier = DesktopNotifier(settings.desktop_notify)

        self.lock = threading.RLock()
        self.stop_event = threading.Event()

        self.client = TBankClient(
            token=settings.token,
            account_id=settings.account_id,
            max_retry_errors=settings.max_retry_errors,
            logger=self.logger,
            on_retry=lambda: self.metrics.inc("total_api_retries", 1),
        )
        self.risk = RiskEngine(settings)
        self.execution = ExecutionEngine(settings, self.client, self.logger)

        self.universe: list[Instrument] = []
        self.universe_map: dict[str, Instrument] = {}

        self.price_history: dict[str, list[dict[str, Any]]] = {}
        self.last_price: dict[str, float] = {}
        self.last_good_candles: dict[str, list[Any]] = {}

        self.last_signals: list[dict[str, Any]] = []
        self.last_orders: list[dict[str, Any]] = []
        self.risk_events: list[dict[str, Any]] = []
        self.errors: list[dict[str, Any]] = []
        self.top_candidates: list[dict[str, Any]] = []
        self.last_scan_size = 0
        self.risk_presets = {
            "CONSERVATIVE": {
                "risk_per_trade_pct": max(0.001, self.s.risk_per_trade_pct * 0.6),
                "max_leverage": max(1.0, self.s.max_leverage * 0.8),
                "max_spread_pct": max(0.03, self.s.max_spread_pct * 0.8),
                "max_slippage_pct": max(0.05, self.s.max_slippage_pct * 0.8),
                "max_trades_per_hour": max(1, int(self.s.max_trades_per_hour * 0.8)),
            },
            "BALANCED": {
                "risk_per_trade_pct": self.s.risk_per_trade_pct,
                "max_leverage": self.s.max_leverage,
                "max_spread_pct": self.s.max_spread_pct,
                "max_slippage_pct": self.s.max_slippage_pct,
                "max_trades_per_hour": self.s.max_trades_per_hour,
            },
            "AGGRESSIVE": {
                "risk_per_trade_pct": min(0.03, self.s.risk_per_trade_pct * 1.35),
                "max_leverage": min(5.0, self.s.max_leverage * 1.2),
                "max_spread_pct": min(0.50, self.s.max_spread_pct * 1.2),
                "max_slippage_pct": min(0.60, self.s.max_slippage_pct * 1.2),
                "max_trades_per_hour": min(20, int(self.s.max_trades_per_hour * 1.35) + 1),
            },
        }

        self.current_risk_mode = "INIT"
        self.last_known_equity = 0.0
        self.last_cycle_id = ""

        self.last_cycle_ts = 0.0
        self.last_success_ts = 0.0
        self.last_cycle_api_calls = 0
        self.api_budget_guard_active = False
        self.last_disk_guard_check_ts = 0.0
        self.last_backup_ts = 0.0
        self._closed_resources = False
        if self.state.execution_risk_factor <= 0 or self.state.execution_risk_factor > 1.0:
            self.state.execution_risk_factor = 1.0

        if self.state.last_backup_ts > 0:
            self.last_backup_ts = self.state.last_backup_ts

        if self.state.mode == RunMode.REAL.value:
            gate_ok, gate_reason, _ = self._prelaunch_real_gate(datetime.now(self.s.timezone))
            if not gate_ok:
                self.state.mode = RunMode.DRY_RUN.value
                self.state.trading_enabled = False
                self.state.close_only_mode = True
                self._log_risk({"kind": "startup_real_blocked", "reason": gate_reason})
                self._notify("T-Invest Scalper", "REAL blocked on startup", gate_reason)

    def _with_cycle(self, payload: dict[str, Any]) -> dict[str, Any]:
        payload.setdefault("cycle_id", self.last_cycle_id)
        return payload

    def _log_signal(self, payload: dict[str, Any]) -> None:
        payload = self._with_cycle(payload)
        with self.lock:
            self.last_signals.append(payload)
            _trim(self.last_signals)
        self.db.log_event("signal", payload)
        self.logger.info("signal", extra={"event": "signal", **payload})

    def _log_order(self, payload: dict[str, Any]) -> None:
        payload = self._with_cycle(payload)
        with self.lock:
            self.last_orders.append(payload)
            _trim(self.last_orders)
        self.db.log_event("order", payload)
        self.logger.info("order", extra={"event": "order", **payload})

    def _log_risk(self, payload: dict[str, Any]) -> None:
        payload = self._with_cycle(payload)
        with self.lock:
            self.risk_events.append(payload)
            _trim(self.risk_events)
        self.db.log_event("risk", payload)
        self.logger.warning("risk", extra={"event": "risk", **payload})

    def _log_error(self, payload: dict[str, Any]) -> None:
        payload = self._with_cycle(payload)
        with self.lock:
            self.errors.append(payload)
            _trim(self.errors)
        self.db.log_event("error", payload)
        self.logger.error("error", extra={"event": "error", **payload})

    def _log_audit(self, payload: dict[str, Any]) -> None:
        payload = self._with_cycle(payload)
        self.db.log_event("audit", payload)

    def _notify(self, title: str, message: str, subtitle: str = "") -> None:
        self.notifier.notify(title, message, subtitle)

    def _candle_age_sec(self, candles: list[Any]) -> float:
        if not candles:
            return 1e12
        try:
            ts = str(candles[-1].ts).replace("Z", "+00:00")
            dt = datetime.fromisoformat(ts)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=self.s.timezone)
            now = datetime.now(self.s.timezone)
            return max(0.0, (now - dt.astimezone(self.s.timezone)).total_seconds())
        except Exception:
            return 1e12

    def _candles_safe(self, figi: str) -> list[Any]:
        candles = self.client.get_candles_1m_last_60m(figi)
        age = self._candle_age_sec(candles)
        if candles and age <= self.s.max_candle_age_sec and not has_candle_gaps(candles):
            self.last_good_candles[figi] = candles
            return candles

        cached = self.last_good_candles.get(figi, [])
        cached_age = self._candle_age_sec(cached)
        if cached and cached_age <= self.s.max_candle_age_sec:
            self._log_risk(
                {
                    "kind": "data_fallback",
                    "figi": figi,
                    "source": "cached_candles",
                    "age_sec": cached_age,
                }
            )
            return cached
        self._log_risk({"kind": "data_stale", "figi": figi, "age_sec": age})
        return []

    def _api_budget_guard(self) -> None:
        used = self.last_cycle_api_calls
        per_min = self.client.api_calls_last_minute
        over_budget = used > self.s.max_api_calls_per_cycle or per_min > self.s.max_api_calls_per_minute
        if over_budget:
            self.state.api_budget_recovery_streak = 0
            self.api_budget_guard_active = True
            if not self.state.close_only_mode:
                self.state.close_only_mode = True
                self._log_risk(
                    {
                        "kind": "api_budget_guard",
                        "api_calls_cycle": used,
                        "limit_cycle": self.s.max_api_calls_per_cycle,
                        "api_calls_minute": per_min,
                        "limit_minute": self.s.max_api_calls_per_minute,
                    }
                )
                self._notify("T-Invest Scalper", "API budget guard enabled", "Close-only mode")
            return

        if not self.api_budget_guard_active:
            self.state.api_budget_recovery_streak = 0
            return

        if not self.state.close_only_mode:
            self.api_budget_guard_active = False
            self.state.api_budget_recovery_streak = 0
            return

        if not self.state.trading_enabled or self.state.killswitched:
            self.state.api_budget_recovery_streak = 0
            return

        recover_ratio = max(0.2, min(0.95, float(self.s.api_budget_recover_ratio)))
        cycle_recover_limit = self.s.max_api_calls_per_cycle * recover_ratio
        minute_recover_limit = self.s.max_api_calls_per_minute * recover_ratio
        recover_latency = self.s.max_api_latency_ms * max(0.2, min(1.0, self.s.latency_recover_ratio))

        latency_ok = self.client.latency_ms_ewma <= 0 or self.client.latency_ms_ewma <= recover_latency
        if used <= cycle_recover_limit and per_min <= minute_recover_limit and latency_ok:
            self.state.api_budget_recovery_streak += 1
        else:
            self.state.api_budget_recovery_streak = 0

        if self.state.api_budget_recovery_streak >= max(1, int(self.s.api_budget_recovery_cycles)):
            self.api_budget_guard_active = False
            if self._can_disable_close_only():
                self.state.close_only_mode = False
            self.state.api_budget_recovery_streak = 0
            self._log_risk(
                {
                    "kind": "api_budget_recovered",
                    "api_calls_cycle": used,
                    "api_calls_minute": per_min,
                    "recover_ratio": recover_ratio,
                }
            )
            self._notify("T-Invest Scalper", "API budget recovered", "Close-only disabled")

    def _can_disable_close_only(self) -> bool:
        if self.api_budget_guard_active:
            return False
        if self.state.execution_guard_forced_close_only:
            return False
        if self.state.disk_guard_active:
            return False
        if self.state.disk_guard_forced_close_only:
            return False
        if self.state.killswitched:
            return False
        if self.client.latency_ms_ewma > self.s.max_api_latency_ms:
            return False
        if self.state.daily_realized_pnl_rub <= self.s.daily_loss_limit_rub:
            return False
        drawdown = self.state.daily_realized_pnl_rub - self.state.daily_peak_pnl_rub
        if drawdown <= self.s.max_daily_drawdown_rub:
            return False
        if self.state.order_failure_cooldown_until_ts > time.time():
            return False
        return True

    def _execution_quality_guard(self) -> None:
        if not self.s.quality_guard_enabled:
            self.state.execution_guard_active = False
            self.state.execution_guard_forced_close_only = False
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = 1.0
            self.state.execution_guard_reason = ""
            return

        summary = self.db.execution_quality_summary(max(10, int(self.s.quality_guard_window_trades)))
        stability = self.db.execution_stability(max(10, int(self.s.quality_guard_window_trades)))
        trades = int(summary.get("trades_count", 0))
        if trades < int(self.s.quality_guard_min_trades):
            if self.state.execution_guard_active:
                self.state.execution_guard_recovery_streak += 1
                if self.state.execution_guard_recovery_streak >= max(1, int(self.s.quality_guard_recovery_cycles)):
                    self.state.execution_guard_active = False
                    self.state.execution_guard_recovery_streak = 0
                    self.state.execution_risk_factor = 1.0
                    self.state.execution_guard_reason = ""
                    was_forced = self.state.execution_guard_forced_close_only
                    self.state.execution_guard_forced_close_only = False
                    if (
                        was_forced
                        and self.state.trading_enabled
                        and not self.state.killswitched
                        and self._can_disable_close_only()
                    ):
                        self.state.close_only_mode = False
                    self._log_risk({"kind": "execution_quality_recovered", "source": "insufficient_recent_trades"})
            return

        avg_slip = float(summary.get("avg_slippage_pct", 0.0))
        avg_fill = float(summary.get("avg_fill_ratio", 0.0))
        slip_std = float(stability.get("slippage_std_pct", 0.0))
        slip_corr = float(stability.get("spread_slippage_corr", 0.0))
        bad_slip = avg_slip > float(self.s.quality_guard_max_avg_slippage_pct)
        bad_fill = avg_fill < float(self.s.quality_guard_min_avg_fill_ratio)
        bad_std = slip_std > float(self.s.quality_guard_max_slippage_std_pct)
        bad_corr = (
            slip_corr > float(self.s.quality_guard_max_spread_slip_corr)
            and avg_slip > float(self.s.quality_guard_max_avg_slippage_pct) * 0.7
        )
        reasons: list[str] = []
        if bad_slip:
            reasons.append("high_avg_slippage")
        if bad_fill:
            reasons.append("low_avg_fill")
        if bad_std:
            reasons.append("high_slippage_std")
        if bad_corr:
            reasons.append("high_spread_slippage_corr")

        severe_mult = max(1.05, float(self.s.quality_guard_severe_mult))
        severe = (
            avg_slip > float(self.s.quality_guard_max_avg_slippage_pct) * severe_mult
            or avg_fill < float(self.s.quality_guard_min_avg_fill_ratio) / severe_mult
            or slip_std > float(self.s.quality_guard_max_slippage_std_pct) * severe_mult
        )

        if bad_slip or bad_fill or bad_std or bad_corr:
            was_active = self.state.execution_guard_active
            self.state.execution_guard_active = True
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = max(0.05, min(1.0, float(self.s.quality_guard_risk_cut)))
            self.state.execution_guard_reason = ",".join(reasons) if reasons else "quality_warning"
            if not was_active:
                self._log_risk(
                    {
                        "kind": "execution_quality_guard",
                        "avg_slippage_pct": avg_slip,
                        "avg_fill_ratio": avg_fill,
                        "slippage_std_pct": slip_std,
                        "spread_slippage_corr": slip_corr,
                        "trades": trades,
                        "window_trades": self.s.quality_guard_window_trades,
                        "risk_factor": self.state.execution_risk_factor,
                        "reasons": reasons,
                    }
                )

            if severe:
                if not self.state.close_only_mode:
                    self.state.close_only_mode = True
                if not self.state.execution_guard_forced_close_only:
                    self.state.execution_guard_forced_close_only = True
                    self._log_risk(
                        {
                            "kind": "execution_quality_guard_severe",
                            "avg_slippage_pct": avg_slip,
                            "avg_fill_ratio": avg_fill,
                            "slippage_std_pct": slip_std,
                            "spread_slippage_corr": slip_corr,
                            "trades": trades,
                            "severe_mult": severe_mult,
                            "reasons": reasons,
                        }
                    )
                    self._notify("T-Invest Scalper", "Execution degraded", "Close-only mode")
            return

        if not self.state.execution_guard_active:
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = 1.0
            return

        self.state.execution_guard_recovery_streak += 1
        if self.state.execution_guard_recovery_streak >= max(1, int(self.s.quality_guard_recovery_cycles)):
            self.state.execution_guard_active = False
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = 1.0
            self.state.execution_guard_reason = ""
            was_forced = self.state.execution_guard_forced_close_only
            self.state.execution_guard_forced_close_only = False
            if (
                was_forced
                and self.state.trading_enabled
                and not self.state.killswitched
                and self._can_disable_close_only()
            ):
                self.state.close_only_mode = False
            self._log_risk(
                {
                    "kind": "execution_quality_recovered",
                    "avg_slippage_pct": avg_slip,
                    "avg_fill_ratio": avg_fill,
                    "slippage_std_pct": slip_std,
                    "spread_slippage_corr": slip_corr,
                    "trades": trades,
                }
            )
            self._notify("T-Invest Scalper", "Execution recovered", "Risk factor restored")

    def _adaptive_scan_cap_update(self) -> None:
        max_cap = max(1, int(self.s.max_instruments_per_cycle))
        min_cap = max(1, min(max_cap, int(self.s.adaptive_scan_min_cap)))
        cur = self.state.dynamic_scan_cap if self.state.dynamic_scan_cap > 0 else max_cap
        cur = max(1, min(max_cap, int(cur)))
        self.state.dynamic_scan_cap = cur

        if not self.s.adaptive_scan_enabled:
            self.state.dynamic_scan_cap = max_cap
            self.state.scan_cap_recovery_streak = 0
            return

        soft = max(0.2, min(0.98, float(self.s.api_budget_soft_ratio)))
        minute_usage = self.client.api_calls_last_minute / max(1.0, float(self.s.max_api_calls_per_minute))
        cycle_usage = self.last_cycle_api_calls / max(1.0, float(self.s.max_api_calls_per_cycle))
        latency_usage = self.client.latency_ms_ewma / max(1.0, float(self.s.max_api_latency_ms))
        pressure = max(minute_usage, cycle_usage, latency_usage)

        if pressure >= soft:
            new_cap = max(min_cap, int(cur * 0.8))
            if new_cap < cur:
                self.state.dynamic_scan_cap = new_cap
                self.state.scan_cap_recovery_streak = 0
                self._log_risk(
                    {
                        "kind": "adaptive_scan_reduce",
                        "from_cap": cur,
                        "to_cap": new_cap,
                        "pressure": pressure,
                        "soft_ratio": soft,
                    }
                )
            return

        if pressure < soft * 0.7 and not self.state.close_only_mode:
            self.state.scan_cap_recovery_streak += 1
            if self.state.scan_cap_recovery_streak >= max(1, int(self.s.scan_recovery_cycles)) and cur < max_cap:
                self.state.dynamic_scan_cap = cur + 1
                self.state.scan_cap_recovery_streak = 0
                self._log_risk(
                    {
                        "kind": "adaptive_scan_recover",
                        "from_cap": cur,
                        "to_cap": cur + 1,
                        "pressure": pressure,
                    }
                )
        else:
            self.state.scan_cap_recovery_streak = 0

    def _preflight_real_ok(self) -> tuple[bool, str]:
        if not self.s.require_preflight_real:
            return True, "preflight_disabled"
        path = Path(self.s.preflight_report_file)
        if not path.exists():
            return False, "preflight_report_missing"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return False, "preflight_report_invalid"
        status = str(data.get("status", "")).lower()
        if status != "ok":
            return False, "preflight_status_not_ok"
        ts = str(data.get("ts", ""))
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return False, "preflight_ts_invalid"
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self.s.timezone)
        age = (datetime.now(self.s.timezone) - dt.astimezone(self.s.timezone)).total_seconds()
        if age > self.s.preflight_max_age_sec:
            return False, "preflight_too_old"
        return True, "ok"

    def _preflight_status(self) -> dict[str, Any]:
        now = datetime.now(self.s.timezone)
        path = Path(self.s.preflight_report_file)
        status: dict[str, Any] = {
            "required": self.s.require_preflight_real,
            "path": self.s.preflight_report_file,
            "status": "disabled" if not self.s.require_preflight_real else "unknown",
            "reason": "",
            "age_sec": None,
        }
        if not self.s.require_preflight_real:
            return status
        if not path.exists():
            status["status"] = "missing"
            status["reason"] = "report_not_found"
            return status
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            status["status"] = "invalid"
            status["reason"] = "report_parse_failed"
            return status

        raw_status = str(data.get("status", "")).lower()
        ts = str(data.get("ts", ""))
        if raw_status in {"ok", "fail"}:
            status["status"] = raw_status
        else:
            status["status"] = "invalid"
            status["reason"] = "report_missing_status"
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=self.s.timezone)
            age = max(0.0, (now - dt.astimezone(self.s.timezone)).total_seconds())
            status["age_sec"] = age
            if age > self.s.preflight_max_age_sec:
                status["status"] = "stale"
                status["reason"] = "report_too_old"
        except Exception:
            if status["status"] == "ok":
                status["status"] = "invalid"
            status["reason"] = "report_invalid_ts"
        return status

    def _go_live_check_ok(self) -> tuple[bool, str]:
        if not self.s.require_go_live_check_real:
            return True, "go_live_check_disabled"
        path = Path(self.s.go_live_report_file)
        if not path.exists():
            return False, "go_live_report_missing"
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return False, "go_live_report_invalid"
        status = str(data.get("status", "")).lower()
        if status != "ok":
            return False, "go_live_status_not_ok"
        ts = str(data.get("ts", ""))
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        except Exception:
            return False, "go_live_ts_invalid"
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=self.s.timezone)
        age = (datetime.now(self.s.timezone) - dt.astimezone(self.s.timezone)).total_seconds()
        if age > self.s.go_live_max_age_sec:
            return False, "go_live_too_old"
        return True, "ok"

    def _go_live_status(self) -> dict[str, Any]:
        now = datetime.now(self.s.timezone)
        path = Path(self.s.go_live_report_file)
        status: dict[str, Any] = {
            "required": self.s.require_go_live_check_real,
            "path": self.s.go_live_report_file,
            "status": "disabled" if not self.s.require_go_live_check_real else "unknown",
            "reason": "",
            "age_sec": None,
        }
        if not self.s.require_go_live_check_real:
            return status
        if not path.exists():
            status["status"] = "missing"
            status["reason"] = "report_not_found"
            return status
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            status["status"] = "invalid"
            status["reason"] = "report_parse_failed"
            return status
        raw_status = str(data.get("status", "")).lower()
        ts = str(data.get("ts", ""))
        if raw_status in {"ok", "fail"}:
            status["status"] = raw_status
        else:
            status["status"] = "invalid"
            status["reason"] = "report_missing_status"
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=self.s.timezone)
            age = max(0.0, (now - dt.astimezone(self.s.timezone)).total_seconds())
            status["age_sec"] = age
            if age > self.s.go_live_max_age_sec:
                status["status"] = "stale"
                status["reason"] = "report_too_old"
        except Exception:
            if status["status"] == "ok":
                status["status"] = "invalid"
            status["reason"] = "report_invalid_ts"
        return status

    def _free_disk_mb(self) -> float:
        try:
            target = Path(self.s.log_file).expanduser().resolve()
            base = target.parent if target.parent.exists() else Path(".")
            du = shutil.disk_usage(base)
            return du.free / (1024.0 * 1024.0)
        except Exception:
            return 1e12

    def _prelaunch_real_gate(self, now: datetime, apply_disk_guard: bool = True) -> tuple[bool, str, dict[str, Any]]:
        if apply_disk_guard:
            self._disk_guard(time.time())
        payload: dict[str, Any] = {
            "allow_real": self.s.allow_real,
            "killswitched": self.state.killswitched,
            "api_budget_guard_active": self.api_budget_guard_active,
            "execution_guard_forced_close_only": self.state.execution_guard_forced_close_only,
            "disk_guard_active": self.state.disk_guard_active,
            "order_failure_cooldown_until_ts": self.state.order_failure_cooldown_until_ts,
            "disk_free_mb": self._free_disk_mb(),
        }
        if not self.s.allow_real:
            return False, "ALLOW_REAL=false", payload
        pf_ok, pf_reason = self._preflight_real_ok()
        if not pf_ok:
            payload["preflight_reason"] = pf_reason
            return False, pf_reason, payload
        gl_ok, gl_reason = self._go_live_check_ok()
        if not gl_ok:
            payload["go_live_reason"] = gl_reason
            return False, gl_reason, payload
        if self.state.killswitched:
            return False, "killswitched", payload
        if self.api_budget_guard_active:
            return False, "api_budget_guard_active", payload
        if self.state.execution_guard_forced_close_only:
            return False, "execution_guard_forced_close_only", payload
        if self.state.disk_guard_active:
            return False, "disk_guard_active", payload
        if self.state.order_failure_cooldown_until_ts > now.timestamp():
            return False, "order_failure_cooldown", payload
        if self.client.latency_ms_ewma > self.s.max_api_latency_ms:
            payload["latency_ms_ewma"] = self.client.latency_ms_ewma
            return False, "latency_too_high", payload
        if payload["disk_free_mb"] < float(self.s.disk_guard_min_free_mb):
            return False, "disk_free_too_low", payload
        return True, "ok", payload

    def _record_order_outcome(self, ok: bool, context: str, now_ts: float) -> None:
        if ok:
            self.state.consecutive_order_failures = 0
            return
        self.state.consecutive_order_failures += 1
        if (
            self.s.order_failure_cb_enabled
            and self.state.consecutive_order_failures >= self.s.order_failure_cb_threshold
        ):
            self.state.order_failure_cooldown_until_ts = now_ts + self.s.order_failure_cb_cooldown_sec
            self.state.close_only_mode = True
            self._log_risk(
                {
                    "kind": "order_failure_circuit_breaker",
                    "context": context,
                    "consecutive_order_failures": self.state.consecutive_order_failures,
                    "cooldown_until_ts": self.state.order_failure_cooldown_until_ts,
                    "threshold": self.s.order_failure_cb_threshold,
                }
            )
            self._notify("T-Invest Scalper", "Order failures circuit breaker", "Close-only mode")

    def _disk_guard(self, now_ts: float) -> None:
        if now_ts - self.last_disk_guard_check_ts < max(3, int(self.s.disk_guard_check_sec)):
            return
        self.last_disk_guard_check_ts = now_ts
        free_mb = self._free_disk_mb()
        threshold = float(self.s.disk_guard_min_free_mb)
        recover_threshold = threshold * max(1.05, float(self.s.disk_guard_recover_ratio))

        if free_mb < threshold:
            if not self.state.disk_guard_active:
                self._log_risk(
                    {
                        "kind": "disk_guard",
                        "free_mb": free_mb,
                        "threshold_mb": threshold,
                    }
                )
                self._notify("T-Invest Scalper", "Low disk space", "Close-only mode")
            self.state.disk_guard_active = True
            self.state.disk_guard_forced_close_only = True
            self.state.close_only_mode = True
            return

        if not self.state.disk_guard_active:
            return

        if free_mb >= recover_threshold:
            self.state.disk_guard_active = False
            was_forced = self.state.disk_guard_forced_close_only
            self.state.disk_guard_forced_close_only = False
            if (
                was_forced
                and self.state.trading_enabled
                and not self.state.killswitched
                and self._can_disable_close_only()
            ):
                self.state.close_only_mode = False
            self._log_risk(
                {
                    "kind": "disk_guard_recovered",
                    "free_mb": free_mb,
                    "recover_threshold_mb": recover_threshold,
                }
            )

    def _cleanup_backups(self, backup_dir: Path, pattern: str, keep: int) -> None:
        files = sorted(backup_dir.glob(pattern))
        if len(files) <= keep:
            return
        for p in files[: len(files) - keep]:
            try:
                p.unlink()
            except Exception:
                continue

    def _backup_if_needed(self, now_ts: float) -> None:
        if not self.s.backup_enabled:
            return
        if now_ts - self.last_backup_ts < max(60, int(self.s.backup_interval_sec)):
            return
        backup_dir = Path(self.s.backup_dir)
        backup_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(self.s.timezone).strftime("%Y%m%d_%H%M%S")
        keep = max(3, int(self.s.backup_keep))

        state_src = Path(self.s.state_file)
        if state_src.exists():
            shutil.copy2(state_src, backup_dir / f"state_{stamp}.json")
        self.db.backup_to(str(backup_dir / f"bot_{stamp}.db"))

        self._cleanup_backups(backup_dir, "state_*.json", keep)
        self._cleanup_backups(backup_dir, "bot_*.db", keep)
        self.last_backup_ts = now_ts
        self.state.last_backup_ts = now_ts

    def _activate_killswitch(self, reason: str, exc: Exception | None = None) -> None:
        self.metrics.inc("total_killswitch", 1)
        with self.lock:
            self.state.killswitched = True
            self.state.trading_enabled = False
            self.state.close_only_mode = True
            self.current_risk_mode = "KILL-SWITCH"
        self._log_risk({"kind": "killswitch", "reason": reason})
        if exc:
            self._log_error({"kind": "killswitch_exception", "reason": reason, "error": str(exc)})
        self._notify("T-Invest Scalper", f"Kill-switch: {reason}", "Trading stopped")

    def _is_position_open(self) -> bool:
        return bool(self.state.position.figi and self.state.position.lots > 0)

    def _get_lot_size(self, figi: str) -> int:
        inst = self.universe_map.get(figi)
        return inst.lot if inst else 1

    def _pnl_rub(self, entry: float, current: float, lots: int, lot_size: int) -> float:
        return (current - entry) * lots * lot_size

    def _commission_rub(self, notional_rub: float) -> float:
        return max(0.0, notional_rub) * (self.s.commission_bps / 10_000.0)

    def _refresh_universe_if_needed(self, now_ts: float) -> None:
        if now_ts - self.state.last_universe_reload_ts < self.s.universe_reload_sec and self.universe:
            return
        self.universe = build_universe(self.client, self.logger)
        self.universe_map = {x.figi: x for x in self.universe}
        self.state.last_universe_reload_ts = now_ts

    def _reconcile(self, startup: bool = False) -> None:
        positions = self.client.get_positions()
        _ = self.client.get_orders()
        portfolio = self.client.get_portfolio()
        self.last_known_equity = max(0.0, portfolio.equity_rub)

        open_positions = [p for p in positions if p.balance_lots > 0]
        if len(open_positions) > 1:
            raise RuntimeError("broker has multiple positions while bot requires single position")

        if RunMode(self.state.mode) != RunMode.REAL:
            self.state.last_reconciliation_ts = time.time()
            return

        if not open_positions:
            if self._is_position_open():
                self._log_risk({"kind": "reconcile", "issue": "internal_position_without_broker"})
                self.state.position = PositionState()
            self.state.last_reconciliation_ts = time.time()
            return

        broker_pos = open_positions[0]
        ticker = self.universe_map.get(broker_pos.figi).ticker if broker_pos.figi in self.universe_map else broker_pos.figi

        if (
            self.state.position.figi != broker_pos.figi
            or self.state.position.lots != broker_pos.balance_lots
            or abs(self.state.position.avg_price - broker_pos.average_price) > 1e-8
        ):
            self._log_risk(
                {
                    "kind": "reconcile",
                    "issue": "sync_internal_from_broker",
                    "broker_figi": broker_pos.figi,
                    "broker_lots": broker_pos.balance_lots,
                    "broker_avg": broker_pos.average_price,
                }
            )
            self.state.position = PositionState(
                figi=broker_pos.figi,
                ticker=ticker,
                lots=broker_pos.balance_lots,
                avg_price=broker_pos.average_price,
                peak_price=broker_pos.average_price,
                breakeven_armed=False,
                tp1_done=False,
                opened_at=self.state.position.opened_at if self.state.position.figi == broker_pos.figi else datetime.now(self.s.timezone).isoformat(),
            )

        self.state.last_reconciliation_ts = time.time()
        if startup:
            self.logger.info(
                "startup reconciliation",
                extra={
                    "event": "startup",
                    "mode": self.state.mode,
                    "position_figi": self.state.position.figi,
                    "position_lots": self.state.position.lots,
                    "equity_rub": self.last_known_equity,
                },
            )

    def _entry_conditions_met(
        self,
        score,
        slip: SlippageEstimate,
        now: datetime,
        profile: str,
        forecast: ForecastOutput | None = None,
        strategy_extra_edge: float = 0.0,
    ) -> tuple[bool, str, float]:
        if score.metrics.momentum_60m < self.s.min_mom_60m:
            return False, "mom_60m", 0.0
        if score.metrics.momentum_5m < self.s.min_mom_5m:
            return False, "mom_5m", 0.0
        allowed_spread, allowed_slippage = self._profile_entry_limits(profile)
        if slip.spread_pct > allowed_spread:
            return False, "spread", 0.0
        if score.metrics.atr_15m < self.s.min_volatility_threshold:
            return False, "atr", 0.0
        if slip.slippage_pct > allowed_slippage:
            return False, "slippage", 0.0
        if self.s.forecast_enabled and forecast is not None:
            f_edge_pct = forecast.expected_return * 100.0
            if f_edge_pct < self.s.forecast_min_edge_pct:
                return False, "forecast_edge", 0.0
            if forecast.confidence < self.s.forecast_min_confidence:
                return False, "forecast_conf", 0.0
        if not trading_session_allowed(now, self.s.moex_start, self.s.moex_end):
            return False, "session", 0.0
        if in_no_trade_window(
            now,
            self.s.moex_start,
            self.s.moex_end,
            self.s.no_trade_minutes_after_open,
            self.s.no_trade_minutes_before_close,
        ):
            return False, "time_window", 0.0

        # Include round-trip fee estimate in expected edge filter.
        edge_after_fee = score.expected_net_edge + strategy_extra_edge - (2 * self.s.commission_bps / 10_000.0)
        edge_after_fee_pct = edge_after_fee * 100.0
        if edge_after_fee_pct < self.s.min_edge:
            return False, "edge", edge_after_fee_pct
        return True, "ok", edge_after_fee_pct

    def _record_equity(self) -> None:
        mode = RunMode(self.state.mode)
        if mode == RunMode.PAPER:
            equity = self.state.paper_cash_rub
            if self._is_position_open():
                figi = self.state.position.figi
                current = self.last_price.get(figi, self.state.position.avg_price)
                lot = self._get_lot_size(figi)
                equity += current * self.state.position.lots * lot
            self.last_known_equity = max(0.0, equity)
            self.db.add_equity_point(self.last_known_equity, self.state.daily_realized_pnl_rub)
            return

        # DRY_RUN and REAL use broker portfolio as source of truth for equity.
        portfolio = self.client.get_portfolio()
        self.last_known_equity = max(0.0, portfolio.equity_rub)
        self.db.add_equity_point(self.last_known_equity, self.state.daily_realized_pnl_rub)

    def _adaptive_slices(self, profile: str, spread_pct: float) -> int:
        base = max(1, int(self.s.order_slices))
        p = profile.upper()
        if p == "BLUECHIP" and spread_pct <= self.s.max_spread_pct * 0.5:
            return max(1, base - 1)
        if p == "THIN" or spread_pct >= self.s.max_spread_pct * 0.9:
            return min(8, base + 2)
        return base

    def _liquidity_guard(self, book, lot_size: int) -> tuple[bool, str, dict[str, Any]]:
        stats = orderbook_depth_stats(book, self.s.liquidity_depth_levels, lot_size=lot_size)
        min_notional = min(stats.bid_notional, stats.ask_notional)
        payload = {
            "bid_qty": stats.bid_qty,
            "ask_qty": stats.ask_qty,
            "bid_notional": stats.bid_notional,
            "ask_notional": stats.ask_notional,
            "bid_ask_ratio": stats.bid_ask_ratio,
            "levels": self.s.liquidity_depth_levels,
        }
        if stats.bid_qty < self.s.min_top_book_qty or stats.ask_qty < self.s.min_top_book_qty:
            return False, "top_qty", payload
        if min_notional < self.s.min_top_book_notional_rub:
            return False, "top_notional", payload
        if stats.bid_ask_ratio < self.s.min_bid_ask_ratio:
            return False, "imbalance_low", payload
        if stats.bid_ask_ratio > self.s.max_bid_ask_ratio:
            return False, "imbalance_high", payload
        return True, "ok", payload

    def _cycle_universe(self) -> list[Instrument]:
        if not self.universe:
            return []
        cap = self.state.dynamic_scan_cap if self.state.dynamic_scan_cap > 0 else int(self.s.max_instruments_per_cycle)
        cap = max(1, min(int(self.s.max_instruments_per_cycle), int(cap)))
        if cap >= len(self.universe):
            return list(self.universe)

        offset = self.state.universe_scan_offset % len(self.universe)
        if offset + cap <= len(self.universe):
            batch = self.universe[offset : offset + cap]
        else:
            tail = self.universe[offset:]
            head = self.universe[: cap - len(tail)]
            batch = tail + head

        self.state.universe_scan_offset = (offset + cap) % len(self.universe)
        return batch

    def _profile_entry_limits(self, profile: str) -> tuple[float, float]:
        p = profile.upper()
        if p == "BLUECHIP":
            spread_mult = self.s.bluechip_spread_mult
            slip_mult = self.s.bluechip_slippage_mult
        elif p == "THIN":
            spread_mult = self.s.thin_spread_mult
            slip_mult = self.s.thin_slippage_mult
        else:
            spread_mult = self.s.standard_spread_mult
            slip_mult = self.s.standard_slippage_mult
        allowed_spread = self.s.max_spread_pct * max(0.1, spread_mult)
        allowed_slippage = self.s.max_slippage_pct * max(0.1, slip_mult)
        return allowed_spread, allowed_slippage

    def _pretrade_gate(
        self,
        now: datetime,
        candidate: Instrument,
        fresh_price: float,
        candles: list[Any],
        sizing,
        allowed_slippage: float,
        sized_slip: SlippageEstimate,
    ) -> tuple[bool, str, dict[str, Any]]:
        lot_size = max(1, int(candidate.lot))
        notional = max(0.0, float(sizing.chosen_lots) * float(fresh_price) * lot_size)
        payload = {
            "figi": candidate.figi,
            "ticker": candidate.ticker,
            "price": fresh_price,
            "lot_size": lot_size,
            "chosen_lots": int(sizing.chosen_lots),
            "notional_rub": notional,
            "effective_leverage": float(sizing.effective_leverage),
            "slippage_pct_sized": float(sized_slip.slippage_pct),
            "allowed_slippage_pct": float(allowed_slippage),
            "candle_age_sec": self._candle_age_sec(candles),
            "api_calls_cycle": int(self.last_cycle_api_calls),
            "api_calls_minute": int(self.client.api_calls_last_minute),
            "execution_risk_factor": float(self.state.execution_risk_factor),
        }

        if fresh_price <= 0:
            return False, "bad_price", payload
        if lot_size <= 0:
            return False, "bad_lot_size", payload
        if int(sizing.chosen_lots) <= 0:
            return False, "zero_lots", payload
        if notional > self.s.max_position_rub + 1e-6:
            return False, "notional_limit", payload
        if float(sizing.effective_leverage) > self.s.max_leverage + 1e-9:
            return False, "leverage_limit", payload
        if float(sized_slip.slippage_pct) > float(allowed_slippage):
            return False, "size_slippage_limit", payload
        if payload["candle_age_sec"] > self.s.max_candle_age_sec:
            return False, "stale_candles", payload
        if not trading_session_allowed(now, self.s.moex_start, self.s.moex_end):
            return False, "session_closed", payload
        day_after = self.state.notional_traded_today_rub + notional
        hour_key = now.strftime("%Y-%m-%d %H")
        hour_after = self.state.notional_by_hour_rub.get(hour_key, 0.0) + notional
        if day_after > self.s.max_notional_per_day_rub:
            payload["day_notional_after"] = day_after
            return False, "notional_day_limit", payload
        if hour_after > self.s.max_notional_per_hour_rub:
            payload["hour_notional_after"] = hour_after
            return False, "notional_hour_limit", payload

        soft = max(0.2, min(0.98, float(self.s.api_budget_soft_ratio)))
        if self.last_cycle_api_calls > self.s.max_api_calls_per_cycle * soft:
            return False, "api_budget_soft_cycle", payload
        if self.client.api_calls_last_minute > self.s.max_api_calls_per_minute * soft:
            return False, "api_budget_soft_minute", payload
        return True, "ok", payload

    def _check_exit(self, now: datetime) -> None:
        if not self._is_position_open():
            return

        pos = self.state.position
        candles = self._candles_safe(pos.figi)
        if not candles:
            return
        current_price = candles[-1].close
        self.last_price[pos.figi] = current_price
        self.price_history[pos.figi] = [{"ts": c.ts, "price": c.close} for c in candles][-60:]

        lot_size = self._get_lot_size(pos.figi)
        pnl_pct = ((current_price - pos.avg_price) / pos.avg_price) * 100.0 if pos.avg_price > 0 else 0.0
        if current_price > pos.peak_price:
            pos.peak_price = current_price
        if not pos.breakeven_armed and pnl_pct >= self.s.breakeven_trigger_pct:
            pos.breakeven_armed = True
        drawdown_from_peak_pct = (
            ((pos.peak_price - current_price) / pos.peak_price) * 100.0 if pos.peak_price > 0 else 0.0
        )
        trailing_active = pnl_pct >= self.s.trailing_activation_pct

        book = self.client.get_order_book(pos.figi, depth=max(20, self.s.liquidity_depth_levels))
        slip = estimate_sell_slippage(book, max(1, pos.lots), lot_size=lot_size)
        self.metrics.add_slippage_sample(slip.slippage_pct)

        opened_at = datetime.fromisoformat(pos.opened_at) if pos.opened_at else now
        time_in_trade = (now - opened_at).total_seconds()

        can_tp1 = (
            not pos.tp1_done
            and self.s.take_profit_1_pct > 0
            and pnl_pct >= self.s.take_profit_1_pct
            and pos.lots > max(1, self.s.take_profit_1_min_lots)
        )
        if can_tp1:
            partial_lots = int(round(pos.lots * self.s.take_profit_1_fraction))
            partial_lots = max(self.s.take_profit_1_min_lots, partial_lots)
            partial_lots = min(max(1, pos.lots - 1), partial_lots)
            profile = self.universe_map.get(pos.figi).profile if pos.figi in self.universe_map else "STANDARD"
            slices = self._adaptive_slices(profile, slip.spread_pct)
            p_result = self.execution.close_lots(
                state=self.state,
                lots_to_close=partial_lots,
                reason="take_profit_1",
                lot_size=lot_size,
                expected_price=current_price,
                now=now,
                slices_override=slices,
            )
            self.metrics.add_fill(p_result.requested_lots, p_result.filled_lots)
            self._record_order_outcome(p_result.ok, "partial_exit", now.timestamp())
            self._log_order(
                {
                    "action": "partial_exit",
                    "ok": p_result.ok,
                    "figi": pos.figi,
                    "ticker": pos.ticker,
                    "requested_lots": p_result.requested_lots,
                    "filled_lots": p_result.filled_lots,
                    "avg_price": p_result.avg_price,
                    "status": p_result.status,
                    "reason": "take_profit_1",
                    "pnl_pct": pnl_pct,
                    "order_id": p_result.order_id,
                }
            )
            if not p_result.ok:
                self.metrics.inc("total_rejects", 1)
                self._activate_killswitch("partial exit order mismatch")
                return

            closed_lots = max(0, min(p_result.filled_lots or partial_lots, pos.lots))
            if closed_lots > 0:
                exit_price = p_result.avg_price if p_result.avg_price > 0 else current_price
                gross = self._pnl_rub(pos.avg_price, exit_price, closed_lots, lot_size)
                entry_notional = pos.avg_price * closed_lots * lot_size
                exit_notional = exit_price * closed_lots * lot_size
                fee = self._commission_rub(entry_notional) + self._commission_rub(exit_notional)
                net = gross - fee
                self.risk.on_partial_close(self.state, pos.figi, net, slip.slippage_pct)
                self.risk.on_notional_executed(self.state, exit_price * closed_lots * lot_size, now)
                self.db.add_trade(
                    ClosedTrade(
                        ts=now.isoformat(),
                        figi=pos.figi,
                        ticker=pos.ticker,
                        side="LONG",
                        lots=closed_lots,
                        entry_price=pos.avg_price,
                        exit_price=exit_price,
                        gross_pnl_rub=gross,
                        fee_rub=fee,
                        net_pnl_rub=net,
                        reason="take_profit_1",
                        order_id=p_result.order_id,
                        spread_pct=slip.spread_pct,
                        slippage_pct=slip.slippage_pct,
                        fill_ratio=(closed_lots / max(1, p_result.requested_lots)),
                        notional_rub=exit_price * closed_lots * lot_size,
                    )
                )
                self.logger.info(
                    "pnl_partial",
                    extra={
                        "event": "pnl_partial",
                        "gross_rub": gross,
                        "fee_rub": fee,
                        "net_rub": net,
                        "daily_pnl": self.state.daily_realized_pnl_rub,
                    },
                )
                if self._is_position_open():
                    self.state.position.tp1_done = True
                    self.state.position.breakeven_armed = True
                    self.state.position.peak_price = max(self.state.position.peak_price, current_price)
                return

        reason = ""
        if pnl_pct >= self.s.take_profit_pct:
            reason = "take_profit"
        elif pnl_pct <= -self.s.stop_loss_pct:
            reason = "stop_loss"
        elif trailing_active and self.s.trailing_stop_pct > 0 and drawdown_from_peak_pct >= self.s.trailing_stop_pct:
            reason = "trailing_stop"
        elif pos.breakeven_armed and pnl_pct <= self.s.breakeven_offset_pct:
            reason = "breakeven_stop"
        elif time_in_trade >= self.s.time_stop_seconds:
            reason = "time_stop"
        elif slip.spread_pct > self.s.emergency_spread_pct:
            reason = "spread_emergency"
        elif slip.slippage_pct > self.s.max_slippage_pct:
            reason = "slippage_emergency"
        elif self.state.emergency_flatten:
            reason = "emergency_flatten"

        if not reason:
            return

        profile = self.universe_map.get(pos.figi).profile if pos.figi in self.universe_map else "STANDARD"
        slices = self._adaptive_slices(profile, slip.spread_pct)
        result = self.execution.close_position(
            state=self.state,
            reason=reason,
            lot_size=lot_size,
            expected_price=current_price,
            now=now,
            slices_override=slices,
        )
        self.metrics.add_fill(result.requested_lots, result.filled_lots)
        self._record_order_outcome(result.ok, "exit", now.timestamp())

        self._log_order(
            {
                "action": "exit",
                "ok": result.ok,
                "figi": pos.figi,
                "ticker": pos.ticker,
                "requested_lots": result.requested_lots,
                "filled_lots": result.filled_lots,
                "lot_size": lot_size,
                "avg_price": result.avg_price,
                "status": result.status,
                "reason": reason,
                "pnl_pct": pnl_pct,
                "drawdown_from_peak_pct": drawdown_from_peak_pct,
                "trailing_active": trailing_active,
                "breakeven_armed": pos.breakeven_armed,
                "order_id": result.order_id,
            }
        )

        if not result.ok:
            self.metrics.inc("total_rejects", 1)
            self._activate_killswitch("exit order mismatch")
            return

        self.metrics.inc("total_exits", 1)

        exit_price = result.avg_price if result.avg_price > 0 else current_price
        gross = self._pnl_rub(pos.avg_price, exit_price, result.filled_lots or pos.lots, lot_size)

        entry_notional = pos.avg_price * (result.filled_lots or pos.lots) * lot_size
        exit_notional = exit_price * (result.filled_lots or pos.lots) * lot_size
        fee = self._commission_rub(entry_notional) + self._commission_rub(exit_notional)
        net = gross - fee

        self.risk.on_trade_closed(self.state, pos.figi, net, slip.slippage_pct, now)
        self.risk.on_notional_executed(
            self.state,
            exit_price * (result.filled_lots or pos.lots) * lot_size,
            now,
        )
        self.db.add_trade(
            ClosedTrade(
                ts=now.isoformat(),
                figi=pos.figi,
                ticker=pos.ticker,
                side="LONG",
                lots=result.filled_lots or pos.lots,
                entry_price=pos.avg_price,
                exit_price=exit_price,
                gross_pnl_rub=gross,
                fee_rub=fee,
                net_pnl_rub=net,
                reason=reason,
                order_id=result.order_id,
                spread_pct=slip.spread_pct,
                slippage_pct=slip.slippage_pct,
                fill_ratio=((result.filled_lots or pos.lots) / max(1, result.requested_lots or pos.lots)),
                notional_rub=exit_price * (result.filled_lots or pos.lots) * lot_size,
            )
        )

        self.logger.info(
            "pnl",
            extra={
                "event": "pnl",
                "gross_rub": gross,
                "fee_rub": fee,
                "net_rub": net,
                "daily_pnl": self.state.daily_realized_pnl_rub,
            },
        )

        if reason == "emergency_flatten":
            self.state.emergency_flatten = False

    def _select_candidate(self, now: datetime) -> tuple[Instrument | None, float, Any, SlippageEstimate, float]:
        best: tuple[Instrument, float, Any, SlippageEstimate, float] | None = None
        ranked: list[dict[str, Any]] = []

        scan_universe = self._cycle_universe()
        self.last_scan_size = len(scan_universe)
        for inst in scan_universe:
            banned_until = self.state.symbol_banned_until_ts.get(inst.figi, 0.0)
            if banned_until > now.timestamp():
                continue

            candles = self._candles_safe(inst.figi)
            if len(candles) < 25:
                continue

            last_price = candles[-1].close
            self.last_price[inst.figi] = last_price
            self.price_history[inst.figi] = [{"ts": c.ts, "price": c.close} for c in candles][-60:]

            abnormal = self.risk.detect_abnormal_candle(last_candle_return_pct(candles), self.state, now.timestamp())
            if abnormal:
                self._log_risk({"kind": "volatility_circuit_breaker", "figi": inst.figi, "ticker": inst.ticker})
                continue

            try:
                book = self.client.get_order_book(inst.figi, depth=max(20, self.s.liquidity_depth_levels))
                slip = estimate_buy_slippage(book, 1, lot_size=inst.lot)
            except Exception as exc:
                self._log_risk({"kind": "liquidity_guard", "figi": inst.figi, "error": str(exc)})
                continue
            liq_ok, liq_reason, liq_payload = self._liquidity_guard(book, lot_size=inst.lot)
            if not liq_ok:
                self._log_signal(
                    {
                        "figi": inst.figi,
                        "ticker": inst.ticker,
                        "profile": inst.profile,
                        "price": last_price,
                        "spread_pct": slip.spread_pct,
                        "slippage_pct": slip.slippage_pct,
                        "decision": f"reject_liquidity_{liq_reason}",
                        "strategy_mode": self.s.strategy_mode,
                        **liq_payload,
                    }
                )
                ranked.append(
                    {
                        "ticker": inst.ticker,
                        "figi": inst.figi,
                        "profile": inst.profile,
                        "score": -1.0,
                        "score_base": -1.0,
                        "edge_fee_pct": -1.0,
                        "decision": f"reject_liquidity_{liq_reason}",
                        "spread_pct": slip.spread_pct,
                        "slippage_pct": slip.slippage_pct,
                        "bid_ask_ratio": liq_payload.get("bid_ask_ratio", 0.0),
                        "forecast_expected_return_pct": 0.0,
                        "forecast_confidence": 0.5,
                    }
                )
                continue

            self.metrics.add_slippage_sample(slip.slippage_pct)

            score = compute_score(candles, slip.spread_pct, slip.slippage_pct)
            orb_score = 0.0
            orb_range_pct = 0.0
            bb_score = 0.0
            forecast = ForecastOutput(expected_return=0.0, confidence=0.5, samples=0, mae=1.0)
            if self.s.strategy_mode == "COMPOSITE":
                session_open = now.replace(
                    hour=self.s.moex_start.hour,
                    minute=self.s.moex_start.minute,
                    second=0,
                    microsecond=0,
                )
                orb_score, orb_range_pct = opening_range_breakout_score(
                    candles=candles,
                    now=now,
                    session_open=session_open,
                    orb_minutes=self.s.orb_minutes,
                    breakout_buffer_pct=self.s.orb_breakout_buffer_pct,
                    min_range_pct=self.s.orb_min_range_pct,
                )
                bb_score = bollinger_rebound_score(
                    candles=candles,
                    period=self.s.bb_period,
                    stddev_mult=self.s.bb_stddev,
                    max_distance_pct=self.s.bb_max_distance_pct,
                )
            if self.s.forecast_enabled:
                forecast = train_and_forecast(
                    candles=candles,
                    horizon=self.s.forecast_horizon_min,
                    min_samples=self.s.forecast_min_samples,
                    lr=self.s.forecast_lr,
                    l2=self.s.forecast_l2,
                    epochs=self.s.forecast_epochs,
                )
            strategy_extra_edge = (
                self.s.orb_weight * orb_score
                + self.s.bb_rebound_weight * bb_score
                + (self.s.forecast_weight * forecast.expected_return if self.s.forecast_enabled else 0.0)
            )
            composite_score = score.total + strategy_extra_edge
            ok, fail_reason, edge_after_fee_pct = self._entry_conditions_met(
                score, slip, now, inst.profile, forecast=forecast, strategy_extra_edge=strategy_extra_edge
            )

            signal_payload = {
                "figi": inst.figi,
                "ticker": inst.ticker,
                "profile": inst.profile,
                "price": last_price,
                "momentum_60m": score.metrics.momentum_60m,
                "momentum_5m": score.metrics.momentum_5m,
                "atr_15m": score.metrics.atr_15m,
                "noise_penalty": score.metrics.noise_penalty,
                "spread_pct": slip.spread_pct,
                "slippage_pct": slip.slippage_pct,
                "expected_net_edge": score.expected_net_edge,
                "strategy_extra_edge": strategy_extra_edge,
                "expected_edge_after_fee_pct": edge_after_fee_pct,
                "orb_score": orb_score,
                "orb_range_pct": orb_range_pct,
                "bb_rebound_score": bb_score,
                "forecast_expected_return_pct": forecast.expected_return * 100.0,
                "forecast_confidence": forecast.confidence,
                "forecast_samples": forecast.samples,
                "forecast_mae_pct": forecast.mae * 100.0,
                "allowed_spread_pct": self._profile_entry_limits(inst.profile)[0],
                "allowed_slippage_pct": self._profile_entry_limits(inst.profile)[1],
                **liq_payload,
                "decision": "pass" if ok else f"reject_{fail_reason}",
                "score_base": score.total,
                "score_composite": composite_score,
                "strategy_mode": self.s.strategy_mode,
            }
            self._log_signal(signal_payload)
            ranked.append(
                {
                    "ticker": inst.ticker,
                    "figi": inst.figi,
                    "profile": inst.profile,
                    "score": composite_score,
                    "score_base": score.total,
                    "edge_fee_pct": edge_after_fee_pct,
                    "decision": signal_payload["decision"],
                    "spread_pct": slip.spread_pct,
                    "slippage_pct": slip.slippage_pct,
                    "allowed_spread_pct": self._profile_entry_limits(inst.profile)[0],
                    "allowed_slippage_pct": self._profile_entry_limits(inst.profile)[1],
                    "bid_ask_ratio": liq_payload.get("bid_ask_ratio", 0.0),
                    "forecast_expected_return_pct": forecast.expected_return * 100.0,
                    "forecast_confidence": forecast.confidence,
                }
            )

            if not ok:
                continue

            if best is None or composite_score > best[1]:
                best = (inst, composite_score, score, slip, strategy_extra_edge)

        ranked.sort(key=lambda x: float(x.get("score", 0.0)), reverse=True)
        self.top_candidates = ranked[: max(1, self.s.candidate_top_n)]

        if not best:
            return None, 0.0, None, SlippageEstimate(0, 0, 0, 0, 0), 0.0
        return best

    def _entry_flow(self, now: datetime) -> None:
        if self._is_position_open():
            return

        candidate, _, score, _, _ = self._select_candidate(now)
        if not candidate:
            self.state.entry_candidate_figi = ""
            self.state.entry_candidate_ts = 0.0
            self.current_risk_mode = "NO-SIGNAL"
            return

        now_ts = now.timestamp()
        decision = self.risk.check_entry_allowed(
            self.state,
            now,
            now_ts,
            trading_session_allowed(now, self.s.moex_start, self.s.moex_end),
            candidate.figi,
        )
        self.current_risk_mode = decision.reason
        if not decision.allowed:
            return
        if self.state.execution_guard_active:
            self.current_risk_mode = "EXECUTION-GUARD"

        last_exit_ts = self.state.last_exit_ts_by_symbol.get(candidate.figi, 0.0)
        if last_exit_ts > 0 and now_ts - last_exit_ts < self.s.reentry_cooldown_sec:
            self.current_risk_mode = "REENTRY-COOLDOWN"
            return

        last_entry_mom5 = self.state.last_entry_mom5_by_symbol.get(candidate.figi)
        if (
            last_entry_mom5 is not None
            and score is not None
            and score.metrics.momentum_5m < last_entry_mom5 + self.s.reentry_min_mom5_delta
        ):
            self.current_risk_mode = "REENTRY-WAIT-IMPULSE"
            return

        if self.state.entry_candidate_figi != candidate.figi:
            self.state.entry_candidate_figi = candidate.figi
            self.state.entry_candidate_ts = now_ts
            return

        if now_ts - self.state.entry_candidate_ts < self.s.confirm_seconds:
            return

        # Re-confirm after delay.
        candles = self._candles_safe(candidate.figi)
        if not candles:
            return
        fresh_price = candles[-1].close

        book = self.client.get_order_book(candidate.figi, depth=max(20, self.s.liquidity_depth_levels))
        slip2 = estimate_buy_slippage(book, 1, lot_size=candidate.lot)
        liq_ok2, liq_reason2, liq_payload2 = self._liquidity_guard(book, lot_size=candidate.lot)
        if not liq_ok2:
            self.state.entry_candidate_figi = ""
            self.state.entry_candidate_ts = 0.0
            self._log_risk({"kind": "confirm_reject_liquidity", "figi": candidate.figi, "reason": liq_reason2, **liq_payload2})
            return
        score2 = compute_score(candles, slip2.spread_pct, slip2.slippage_pct)
        orb_score2 = 0.0
        bb_score2 = 0.0
        forecast2 = ForecastOutput(expected_return=0.0, confidence=0.5, samples=0, mae=1.0)
        if self.s.strategy_mode == "COMPOSITE":
            session_open = now.replace(
                hour=self.s.moex_start.hour,
                minute=self.s.moex_start.minute,
                second=0,
                microsecond=0,
            )
            orb_score2, _ = opening_range_breakout_score(
                candles=candles,
                now=now,
                session_open=session_open,
                orb_minutes=self.s.orb_minutes,
                breakout_buffer_pct=self.s.orb_breakout_buffer_pct,
                min_range_pct=self.s.orb_min_range_pct,
            )
            bb_score2 = bollinger_rebound_score(
                candles=candles,
                period=self.s.bb_period,
                stddev_mult=self.s.bb_stddev,
                max_distance_pct=self.s.bb_max_distance_pct,
            )
        if self.s.forecast_enabled:
            forecast2 = train_and_forecast(
                candles=candles,
                horizon=self.s.forecast_horizon_min,
                min_samples=self.s.forecast_min_samples,
                lr=self.s.forecast_lr,
                l2=self.s.forecast_l2,
                epochs=self.s.forecast_epochs,
            )
        strategy_extra_edge = (
            self.s.orb_weight * orb_score2
            + self.s.bb_rebound_weight * bb_score2
            + (self.s.forecast_weight * forecast2.expected_return if self.s.forecast_enabled else 0.0)
        )
        ok, fail_reason, edge_after_fee_pct = self._entry_conditions_met(
            score2, slip2, now, candidate.profile, forecast=forecast2, strategy_extra_edge=strategy_extra_edge
        )
        if not ok:
            self.state.entry_candidate_figi = ""
            self.state.entry_candidate_ts = 0.0
            self._log_risk({"kind": "confirm_reject", "figi": candidate.figi, "reason": fail_reason})
            return

        if self.last_known_equity <= 0:
            self.last_known_equity = self.client.get_portfolio().equity_rub

        base_risk_mult = self.risk.dynamic_risk_multiplier(self.state, candidate.profile)
        risk_mult = max(0.05, min(1.0, base_risk_mult * self.state.execution_risk_factor))
        max_lots = self.client.get_max_lots(candidate.figi, fresh_price, is_buy=True)
        sizing = self.risk.size_position(
            self.last_known_equity,
            fresh_price,
            candidate.lot,
            self.s.stop_loss_pct,
            max_lots,
            risk_mult,
        )
        sized_slip = estimate_buy_slippage(book, max(1, sizing.chosen_lots), lot_size=candidate.lot)
        _, allowed_slippage = self._profile_entry_limits(candidate.profile)

        self.logger.info(
            "sizing",
            extra={
                "event": "sizing",
                "figi": candidate.figi,
                "ticker": candidate.ticker,
                "price": fresh_price,
                "max_lots_broker": sizing.max_lots_broker,
                "lots_by_risk": sizing.lots_by_risk,
                "lots_by_notional": sizing.lots_by_notional,
                "chosen_lots": sizing.chosen_lots,
                "lot_size": candidate.lot,
                "effective_leverage": sizing.effective_leverage,
                "risk_multiplier": sizing.risk_multiplier,
                "base_risk_multiplier": base_risk_mult,
                "execution_risk_factor": self.state.execution_risk_factor,
                "expected_edge_after_fee_pct": edge_after_fee_pct,
                "strategy_extra_edge": strategy_extra_edge,
                "slippage_pct_sized": sized_slip.slippage_pct,
                "allowed_slippage_pct": allowed_slippage,
                "forecast_expected_return_pct": forecast2.expected_return * 100.0,
                "forecast_confidence": forecast2.confidence,
                "forecast_samples": forecast2.samples,
                "profile": candidate.profile,
            },
        )

        gate_ok, gate_reason, gate_payload = self._pretrade_gate(
            now=now,
            candidate=candidate,
            fresh_price=fresh_price,
            candles=candles,
            sizing=sizing,
            allowed_slippage=allowed_slippage,
            sized_slip=sized_slip,
        )
        if not gate_ok:
            self._log_risk({"kind": "entry_reject", "reason": gate_reason, **gate_payload})
            self.state.entry_candidate_figi = ""
            self.state.entry_candidate_ts = 0.0
            return

        slices = self._adaptive_slices(candidate.profile, slip2.spread_pct)
        result = self.execution.open_long(
            state=self.state,
            figi=candidate.figi,
            ticker=candidate.ticker,
            lots=sizing.chosen_lots,
            lot_size=candidate.lot,
            expected_price=fresh_price,
            now=now,
            slices_override=slices,
        )

        self.metrics.add_fill(result.requested_lots, result.filled_lots)
        self._record_order_outcome(result.ok, "entry", now_ts)

        self._log_order(
            {
                "action": "entry",
                "ok": result.ok,
                "figi": candidate.figi,
                "ticker": candidate.ticker,
                "requested_lots": result.requested_lots,
                "filled_lots": result.filled_lots,
                "lot_size": candidate.lot,
                "avg_price": result.avg_price,
                "status": result.status,
                "order_id": result.order_id,
                "max_lots_broker": sizing.max_lots_broker,
                "effective_leverage": sizing.effective_leverage,
                "risk_multiplier": sizing.risk_multiplier,
                "base_risk_multiplier": base_risk_mult,
                "execution_risk_factor": self.state.execution_risk_factor,
                "profile": candidate.profile,
                "strategy_mode": self.s.strategy_mode,
                "expected_edge_after_fee_pct": edge_after_fee_pct,
                "strategy_extra_edge": strategy_extra_edge,
                "slippage_pct_sized": sized_slip.slippage_pct,
                "allowed_slippage_pct": allowed_slippage,
                "forecast_expected_return_pct": forecast2.expected_return * 100.0,
                "forecast_confidence": forecast2.confidence,
                "slices": slices,
            }
        )

        if not result.ok:
            self.risk.on_entry_failed(self.state, candidate.figi, now_ts)
            self.metrics.inc("total_rejects", 1)
            self._log_risk(
                {
                    "kind": "entry_failed",
                    "figi": candidate.figi,
                    "ticker": candidate.ticker,
                    "reason": result.message,
                    "failed_count": self.state.symbol_failed_entries.get(candidate.figi, 0),
                    "banned_until_ts": self.state.symbol_banned_until_ts.get(candidate.figi, 0.0),
                }
            )
            return

        self.metrics.inc("total_entries", 1)
        self.risk.on_notional_executed(
            self.state,
            (result.avg_price if result.avg_price > 0 else fresh_price)
            * max(0, result.filled_lots)
            * candidate.lot,
            now,
        )
        self.state.symbol_failed_entries[candidate.figi] = 0
        self.state.last_entry_mom5_by_symbol[candidate.figi] = score2.metrics.momentum_5m

        self.state.entry_candidate_figi = ""
        self.state.entry_candidate_ts = 0.0

    def _active_limits(self) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        now_ts = time.time()
        if self.state.killswitched:
            out.append({"name": "KILL-SWITCH", "active": True})
        if self.api_budget_guard_active:
            out.append(
                {
                    "name": "API_BUDGET_GUARD",
                    "active": True,
                    "recovery_streak": self.state.api_budget_recovery_streak,
                    "recovery_cycles": self.s.api_budget_recovery_cycles,
                }
            )
        if self.state.execution_guard_active:
            out.append(
                {
                    "name": "EXECUTION_GUARD",
                    "active": True,
                    "reason": self.state.execution_guard_reason,
                    "risk_factor": self.state.execution_risk_factor,
                    "recovery_streak": self.state.execution_guard_recovery_streak,
                    "forced_close_only": self.state.execution_guard_forced_close_only,
                }
            )
        if self.state.close_only_mode:
            out.append({"name": "CLOSE-ONLY", "active": True})
        if not self.state.trading_enabled:
            out.append({"name": "TRADING_DISABLED", "active": True})
        if self.state.daily_realized_pnl_rub <= self.s.daily_loss_limit_rub:
            out.append({"name": "DAILY_LOSS_LIMIT", "active": True, "value": self.state.daily_realized_pnl_rub})
        if self.state.daily_slippage_pct_sum >= self.s.max_daily_slippage_pct:
            out.append({"name": "DAILY_SLIPPAGE_LIMIT", "active": True, "value": self.state.daily_slippage_pct_sum})
        if self.state.cooldown_until_ts > now_ts:
            out.append({"name": "COOLDOWN_AFTER_TRADE", "active": True, "until_ts": self.state.cooldown_until_ts})
        if self.state.losses_cooldown_until_ts > now_ts:
            out.append({"name": "COOLDOWN_AFTER_LOSSES", "active": True, "until_ts": self.state.losses_cooldown_until_ts})
        if self.state.order_failure_cooldown_until_ts > now_ts:
            out.append(
                {
                    "name": "ORDER_FAILURE_COOLDOWN",
                    "active": True,
                    "until_ts": self.state.order_failure_cooldown_until_ts,
                    "consecutive_order_failures": self.state.consecutive_order_failures,
                }
            )
        if self.state.paused_by_volatility_until_ts > now_ts:
            out.append({"name": "VOLATILITY_PAUSE", "active": True, "until_ts": self.state.paused_by_volatility_until_ts})
        if self.state.disk_guard_active:
            out.append({"name": "DISK_GUARD", "active": True, "forced_close_only": self.state.disk_guard_forced_close_only})
        banned = [
            {"figi": k, "until_ts": v}
            for k, v in self.state.symbol_banned_until_ts.items()
            if v > now_ts
        ]
        if banned:
            out.append({"name": "SYMBOL_BANS", "active": True, "items": banned})
        return out

    def ui_snapshot(self) -> dict[str, Any]:
        with self.lock:
            now = datetime.now(self.s.timezone)
            pos = self.state.position
            figi = pos.figi
            current_price = self.last_price.get(figi, 0.0)
            lot_size = self._get_lot_size(figi) if figi else 1

            unreal_rub = 0.0
            unreal_pct = 0.0
            lev = 0.0
            if figi and pos.avg_price > 0 and pos.lots > 0 and current_price > 0:
                unreal_rub = self._pnl_rub(pos.avg_price, current_price, pos.lots, lot_size)
                unreal_pct = ((current_price - pos.avg_price) / pos.avg_price) * 100.0
                if self.last_known_equity > 0:
                    lev = (current_price * pos.lots * lot_size) / self.last_known_equity

            if self.state.killswitched:
                bot_status = "KILL-SWITCH"
            elif self.state.close_only_mode:
                bot_status = "CLOSE-ONLY"
            elif not self.state.trading_enabled:
                bot_status = "STOPPED"
            else:
                bot_status = "RUNNING"

            chart_prices = self.price_history.get(figi, []) if figi else []
            chart_markers = [asdict(m) for m in self.state.markers if m.figi == figi][-20:] if figi else []
            gate_ok, gate_reason, gate_payload = self._prelaunch_real_gate(now, apply_disk_guard=False)

            return {
                "timestamp": now.isoformat(),
                "bot_status": bot_status,
                "killswitched": self.state.killswitched,
                "mode": self.state.mode,
                "instrument": pos.ticker,
                "figi": figi,
                "position_lots": pos.lots,
                "entry_price": pos.avg_price,
                "peak_price": pos.peak_price,
                "breakeven_armed": pos.breakeven_armed,
                "tp1_done": pos.tp1_done,
                "current_price": current_price,
                "unrealized_pnl_rub": unreal_rub,
                "unrealized_pnl_pct": unreal_pct,
                "daily_pnl_rub": self.state.daily_realized_pnl_rub,
                "risk_mode": self.current_risk_mode,
                "scanned_instruments": self.last_scan_size,
                "dynamic_scan_cap": self.state.dynamic_scan_cap,
                "api_calls_cycle": self.last_cycle_api_calls,
                "api_calls_minute": self.client.api_calls_last_minute,
                "api_budget_guard_active": self.api_budget_guard_active,
                "api_budget_recovery_streak": self.state.api_budget_recovery_streak,
                "execution_guard_active": self.state.execution_guard_active,
                "execution_guard_forced_close_only": self.state.execution_guard_forced_close_only,
                "execution_guard_recovery_streak": self.state.execution_guard_recovery_streak,
                "execution_risk_factor": self.state.execution_risk_factor,
                "execution_guard_reason": self.state.execution_guard_reason,
                "consecutive_order_failures": self.state.consecutive_order_failures,
                "order_failure_cooldown_until_ts": self.state.order_failure_cooldown_until_ts,
                "notional_traded_today_rub": self.state.notional_traded_today_rub,
                "notional_traded_hour_rub": self.state.notional_by_hour_rub.get(
                    now.strftime("%Y-%m-%d %H"), 0.0
                ),
                "disk_free_mb": self._free_disk_mb(),
                "disk_guard_active": self.state.disk_guard_active,
                "last_backup_ts": self.state.last_backup_ts,
                "leverage_used": lev,
                "strategy_mode": self.s.strategy_mode,
                "top_candidates": self.top_candidates[: max(1, self.s.candidate_top_n)],
                "latency_ms_ewma": self.client.latency_ms_ewma,
                "low_latency_streak": self.state.low_latency_streak,
                "risk_presets": sorted(self.risk_presets.keys()),
                "last_signals": self.last_signals[-30:],
                "last_orders": self.last_orders[-30:],
                "risk_events": self.risk_events[-30:],
                "errors": self.errors[-30:],
                "active_limits": self._active_limits(),
                "closed_trades": self.db.recent_trades(40),
                "equity_curve": self.db.equity_curve(240),
                "daily_summary": self.db.daily_summary(self.state.day or now.date().isoformat()),
                "signal_reject_stats": self.db.signal_reject_stats(2000),
                "execution_quality": self.db.execution_quality_summary(1000),
                "execution_kpi_windows": self.db.execution_quality_windows([1, 24, 24 * 7], 5000),
                "execution_points": self.db.execution_trade_points(240),
                "execution_stability": self.db.execution_stability(500),
                "trade_performance": self.db.trade_performance_summary(5000),
                "signal_health": self.db.signal_health(4000),
                "preflight": self._preflight_status(),
                "go_live_check": self._go_live_status(),
                "real_readiness": {"ok": gate_ok, "reason": gate_reason, "details": gate_payload},
                "audit_events": self.db.recent_events("audit", 30),
                "runtime_config": self.runtime_cfg.snapshot(),
                "chart": {"prices": chart_prices, "markers": chart_markers},
                "metrics": self.metrics.snapshot(),
            }

    def health_snapshot(self) -> dict[str, Any]:
        return {
            "status": "ok" if not self.state.killswitched else "degraded",
            "last_cycle_ts": self.last_cycle_ts,
            "last_success_ts": self.last_success_ts,
            "bot_status": self.current_risk_mode,
            "latency_ms_ewma": self.client.latency_ms_ewma,
            "api_calls_minute": self.client.api_calls_last_minute,
            "api_budget_guard_active": self.api_budget_guard_active,
            "execution_guard_active": self.state.execution_guard_active,
            "disk_guard_active": self.state.disk_guard_active,
            "disk_free_mb": self._free_disk_mb(),
            "runtime_config_revision": self.runtime_cfg.snapshot().get("revision"),
        }

    def ready_snapshot(self) -> dict[str, Any]:
        now = datetime.now(self.s.timezone)
        gate_ok, gate_reason, _ = self._prelaunch_real_gate(now, apply_disk_guard=False)
        ready = not self.state.killswitched and bool(self.universe)
        if self.state.mode == RunMode.REAL.value:
            ready = ready and gate_ok
        return {
            "ready": ready,
            "universe_size": len(self.universe),
            "mode": self.state.mode,
            "trading_enabled": self.state.trading_enabled,
            "real_gate_ok": gate_ok,
            "real_gate_reason": gate_reason,
        }

    def metrics_text(self) -> str:
        return self.metrics.as_prometheus()

    def config_snapshot(self) -> dict[str, Any]:
        return self.runtime_cfg.snapshot()

    def command_config_update(self, values: dict[str, Any]) -> tuple[bool, str]:
        res = self.runtime_cfg.update(values)
        if res.ok:
            self._log_audit({"action": "config_update", "values": values})
        return res.ok, res.reason

    def command_config_rollback(self) -> tuple[bool, str]:
        res = self.runtime_cfg.rollback()
        if res.ok:
            self._log_audit({"action": "config_rollback"})
        return res.ok, res.reason

    def command_risk_preset(self, preset: str) -> tuple[bool, str]:
        key = preset.strip().upper()
        values = self.risk_presets.get(key)
        if not values:
            return False, "unknown preset"
        res = self.runtime_cfg.update(values)
        if res.ok:
            self._log_audit({"action": "risk_preset", "preset": key, "values": values})
            self._notify("T-Invest Scalper", f"Risk preset applied: {key}", self.state.mode)
        return res.ok, res.reason

    def _run_check_script(self, script_name: str, timeout_sec: int = 45) -> tuple[bool, str, dict[str, Any]]:
        root = Path(__file__).resolve().parents[1]
        script = root / "tools" / script_name
        if not script.exists():
            return False, "script_not_found", {"script": str(script)}
        try:
            proc = subprocess.run(
                [sys.executable, str(script)],
                capture_output=True,
                text=True,
                timeout=max(5, int(timeout_sec)),
                cwd=str(root),
            )
        except subprocess.TimeoutExpired:
            return False, "timeout", {"script": str(script), "timeout_sec": timeout_sec}
        except Exception as exc:
            return False, "exec_failed", {"script": str(script), "error": str(exc)}

        out = (proc.stdout or "").strip()
        err = (proc.stderr or "").strip()
        payload: dict[str, Any] = {
            "script": str(script.name),
            "returncode": proc.returncode,
            "stdout": out[-4000:],
            "stderr": err[-2000:],
        }
        last_line = out.splitlines()[-1] if out else ""
        parsed: dict[str, Any] = {}
        if last_line:
            try:
                parsed = json.loads(last_line)
            except Exception:
                parsed = {}
        if parsed:
            payload["report"] = parsed

        ok = proc.returncode == 0 and str(parsed.get("status", "")).lower() == "ok"
        reason = "ok" if ok else str(parsed.get("status", "")) or f"rc_{proc.returncode}"
        return ok, reason, payload

    def command_run_preflight(self) -> tuple[bool, str, dict[str, Any]]:
        with self.lock:
            ok, reason, payload = self._run_check_script("preflight_real.py")
            self._log_audit({"action": "run_preflight", "ok": ok, "reason": reason})
            if not ok:
                self._log_risk({"kind": "manual_preflight_failed", "reason": reason})
            return ok, reason, payload

    def command_run_go_live_check(self) -> tuple[bool, str, dict[str, Any]]:
        with self.lock:
            ok, reason, payload = self._run_check_script("go_live_check.py")
            self._log_audit({"action": "run_go_live_check", "ok": ok, "reason": reason})
            if not ok:
                self._log_risk({"kind": "manual_go_live_check_failed", "reason": reason})
            return ok, reason, payload

    def command_set_paper_cash(self, amount_rub: float) -> tuple[bool, str]:
        with self.lock:
            if amount_rub <= 0:
                return False, "amount_must_be_positive"
            if self.state.mode != RunMode.PAPER.value:
                return False, "mode_is_not_paper"
            if self._is_position_open():
                return False, "close_position_first"
            self.state.paper_cash_rub = float(amount_rub)
            self.state_store.save(self.state)
            self._log_audit({"action": "set_paper_cash", "amount_rub": amount_rub})
            return True, "ok"

    def command_start(self) -> None:
        with self.lock:
            if self.state.killswitched:
                return
            if self.state.mode == RunMode.REAL.value:
                gate_ok, gate_reason, gate_payload = self._prelaunch_real_gate(datetime.now(self.s.timezone))
                if not gate_ok:
                    self.state.trading_enabled = False
                    self.state.close_only_mode = True
                    self._log_risk({"kind": "start_blocked_prelaunch", "reason": gate_reason, **gate_payload})
                    self._notify("T-Invest Scalper", "Start blocked", gate_reason)
                    return
            self.state.trading_enabled = True
            if self._can_disable_close_only():
                self.state.close_only_mode = False
            self.state.low_latency_streak = 0
            self.state.api_budget_recovery_streak = 0
            self.state.execution_guard_recovery_streak = 0
            self.current_risk_mode = "RUNNING"
            self._log_audit({"action": "start"})
            self._notify("T-Invest Scalper", "Trading enabled", self.state.mode)

    def command_stop(self) -> None:
        with self.lock:
            self.state.trading_enabled = False
            self.state.close_only_mode = True
            self.state.low_latency_streak = 0
            self.current_risk_mode = "STOPPED"
            self._log_audit({"action": "stop"})
            self._notify("T-Invest Scalper", "Trading stopped", self.state.mode)

    def command_panic(self) -> None:
        with self.lock:
            self.state.trading_enabled = False
            self.state.close_only_mode = True
            self.state.low_latency_streak = 0
            self.state.emergency_flatten = True
            self.current_risk_mode = "PANIC"
            self._log_audit({"action": "panic"})
            self._notify("T-Invest Scalper", "Emergency flatten requested", self.state.mode)

    def command_reset_daily(self) -> None:
        with self.lock:
            self.state.daily_realized_pnl_rub = 0.0
            self.state.daily_peak_pnl_rub = 0.0
            self.state.trades_today = 0
            self.state.consecutive_losses = 0
            self.state.daily_slippage_pct_sum = 0.0
            self.state.symbol_realized_pnl_rub = {}
            self.state.trades_by_hour = {}
            self.state.notional_traded_today_rub = 0.0
            self.state.notional_by_hour_rub = {}
            self.state.cooldown_until_ts = 0.0
            self.state.losses_cooldown_until_ts = 0.0
            self.state.api_budget_recovery_streak = 0
            self.state.execution_guard_active = False
            self.state.execution_guard_forced_close_only = False
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = 1.0
            self.state.execution_guard_reason = ""
            self.state.consecutive_order_failures = 0
            self.state.order_failure_cooldown_until_ts = 0.0
            self._log_audit({"action": "reset_daily"})

    def command_reset_killswitch(self) -> tuple[bool, str]:
        with self.lock:
            if self._is_position_open():
                return False, "close_position_first"
            if not self.state.killswitched:
                return True, "already_off"

            self.state.killswitched = False
            self.state.trading_enabled = False
            self.state.close_only_mode = True
            self.state.emergency_flatten = False
            self.state.low_latency_streak = 0
            self.state.api_budget_recovery_streak = 0
            self.state.execution_guard_active = False
            self.state.execution_guard_forced_close_only = False
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = 1.0
            self.state.execution_guard_reason = ""
            self.state.consecutive_order_failures = 0
            self.state.order_failure_cooldown_until_ts = 0.0
            self.current_risk_mode = "STOPPED"
            self.state_store.save(self.state)

            self._log_risk({"kind": "killswitch_reset", "reason": "manual_operator_reset"})
            self._log_audit({"action": "reset_killswitch"})
            self._notify("T-Invest Scalper", "Kill-switch reset", "Trading is stopped, press Start")
            return True, "ok"

    def command_set_mode(self, mode: str, confirm_real: bool = False) -> tuple[bool, str]:
        with self.lock:
            wanted = RunMode(mode)
            if wanted == RunMode.REAL:
                if not self.s.allow_real:
                    self._log_risk({"kind": "mode_switch_blocked", "reason": "ALLOW_REAL=false"})
                    return False, "ALLOW_REAL=false"
                if not confirm_real:
                    self._log_risk({"kind": "mode_switch_blocked", "reason": "REAL_not_confirmed"})
                    return False, "REAL_not_confirmed"
                gate_ok, gate_reason, gate_payload = self._prelaunch_real_gate(datetime.now(self.s.timezone))
                if not gate_ok:
                    self._log_risk({"kind": "mode_switch_blocked", "reason": gate_reason, **gate_payload})
                    return False, gate_reason
            self.state.mode = wanted.value
            self.state.entry_candidate_figi = ""
            self.state.entry_candidate_ts = 0.0
            self.state.low_latency_streak = 0
            self.state.api_budget_recovery_streak = 0
            self.api_budget_guard_active = False
            self.state.execution_guard_active = False
            self.state.execution_guard_forced_close_only = False
            self.state.execution_guard_recovery_streak = 0
            self.state.execution_risk_factor = 1.0
            self.state.execution_guard_reason = ""
            self.state.consecutive_order_failures = 0
            self.state.order_failure_cooldown_until_ts = 0.0
            self._log_audit({"action": "set_mode", "mode": wanted.value})
            self._notify("T-Invest Scalper", f"Mode changed to {wanted.value}", "Mode switch")
            return True, "ok"

    def _latency_guard(self) -> None:
        latency = self.client.latency_ms_ewma
        if latency <= 0:
            return

        if latency > self.s.max_api_latency_ms:
            self.state.low_latency_streak = 0
            if not self.state.close_only_mode:
                self.state.close_only_mode = True
                self._log_risk(
                    {
                        "kind": "latency_guard",
                        "latency_ms_ewma": latency,
                        "threshold": self.s.max_api_latency_ms,
                    }
                )
            return

        # Auto-recover from latency-induced close-only mode.
        if not self.state.close_only_mode or not self.state.trading_enabled or self.state.killswitched:
            self.state.low_latency_streak = 0
            return

        recover_threshold = self.s.max_api_latency_ms * max(0.2, min(1.0, self.s.latency_recover_ratio))
        if latency <= recover_threshold:
            self.state.low_latency_streak += 1
        else:
            self.state.low_latency_streak = 0

        if self.state.low_latency_streak >= self.s.latency_recovery_cycles:
            if self._can_disable_close_only():
                self.state.close_only_mode = False
            self.state.low_latency_streak = 0
            self._log_risk(
                {
                    "kind": "latency_guard_recovered",
                    "latency_ms_ewma": latency,
                    "recover_threshold": recover_threshold,
                    "required_cycles": self.s.latency_recovery_cycles,
                }
            )

    def _daily_loss_guard(self) -> None:
        if self.state.daily_realized_pnl_rub <= self.s.daily_loss_limit_rub and self.state.trading_enabled:
            self.state.trading_enabled = False
            self.state.close_only_mode = True
            self._log_risk(
                {
                    "kind": "daily_loss_limit",
                    "daily_pnl_rub": self.state.daily_realized_pnl_rub,
                    "threshold": self.s.daily_loss_limit_rub,
                }
            )
            self._notify("T-Invest Scalper", "Daily loss limit reached", "Close-only mode")
            return

        drawdown = self.state.daily_realized_pnl_rub - self.state.daily_peak_pnl_rub
        if drawdown <= self.s.max_daily_drawdown_rub and self.state.trading_enabled:
            self.state.trading_enabled = False
            self.state.close_only_mode = True
            self._log_risk(
                {
                    "kind": "daily_drawdown_limit",
                    "drawdown_rub": drawdown,
                    "threshold": self.s.max_daily_drawdown_rub,
                }
            )
            self._notify("T-Invest Scalper", "Daily drawdown limit reached", "Close-only mode")

    def run(self) -> None:
        start_ui_thread(self, self.s.ui_host, self.s.ui_port)
        self._refresh_universe_if_needed(time.time())
        self._reconcile(startup=True)

        self.logger.info(
            "bot started",
            extra={
                "event": "startup",
                "ui": f"http://{self.s.ui_host}:{self.s.ui_port}",
                "mode": self.state.mode,
            },
        )
        self._notify("T-Invest Scalper", "Bot started", self.state.mode)

        while not self.stop_event.is_set():
            self.last_cycle_id = str(uuid.uuid4())
            self.last_cycle_ts = time.time()
            now = datetime.now(self.s.timezone)
            cycle_api_start = self.client.api_calls_total

            try:
                with self.lock:
                    ensure_day(self.state, now)
                    if (
                        self.state.order_failure_cooldown_until_ts > 0
                        and time.time() >= self.state.order_failure_cooldown_until_ts
                    ):
                        self.state.order_failure_cooldown_until_ts = 0.0
                        self.state.consecutive_order_failures = 0
                        self._log_risk({"kind": "order_failure_cooldown_recovered"})
                    self._disk_guard(time.time())
                    self._latency_guard()
                    self._daily_loss_guard()
                    self._adaptive_scan_cap_update()

                    if time.time() - self.state.last_reconciliation_ts >= self.s.reconciliation_interval_sec:
                        self._reconcile()

                    self._refresh_universe_if_needed(time.time())

                    # Exit checks always run before entries.
                    self._check_exit(now)
                    self._execution_quality_guard()
                    self._entry_flow(now)

                    self._record_equity()
                    self.last_cycle_api_calls = max(0, self.client.api_calls_total - cycle_api_start)
                    self._api_budget_guard()

                    self.state_store.save(self.state)
                    self.db.save_state_snapshot(asdict(self.state))
                    self.heartbeat.touch(self.current_risk_mode)
                    self._backup_if_needed(time.time())

                self.last_success_ts = time.time()
            except ApiKillSwitchError as exc:
                self._activate_killswitch("api killswitch", exc)
                self.state_store.save(self.state)
                self.heartbeat.touch("KILL-SWITCH")
            except Exception as exc:
                self._activate_killswitch("unrecoverable exception", exc)
                self.state_store.save(self.state)
                self.heartbeat.touch("KILL-SWITCH")

            time.sleep(self.s.loop_interval_sec)

        self.logger.info("bot stopped", extra={"event": "shutdown"})

    def stop(self) -> None:
        self.stop_event.set()
        if self._closed_resources:
            return

        if self.s.flatten_on_shutdown_real and self.state.mode == RunMode.REAL.value:
            try:
                with self.lock:
                    if self._is_position_open():
                        pos = self.state.position
                        candles = self._candles_safe(pos.figi)
                        px = candles[-1].close if candles else max(0.0, pos.avg_price)
                        lot_size = self._get_lot_size(pos.figi)
                        res = self.execution.close_position(
                            state=self.state,
                            reason="shutdown_flatten",
                            lot_size=lot_size,
                            expected_price=px,
                            now=datetime.now(self.s.timezone),
                        )
                        self._record_order_outcome(res.ok, "shutdown_flatten", time.time())
                        self._log_order(
                            {
                                "action": "shutdown_flatten",
                                "ok": res.ok,
                                "figi": pos.figi,
                                "ticker": pos.ticker,
                                "requested_lots": res.requested_lots,
                                "filled_lots": res.filled_lots,
                                "avg_price": res.avg_price,
                                "status": res.status,
                                "order_id": res.order_id,
                            }
                        )
            except Exception as exc:
                self._log_error({"kind": "shutdown_flatten_failed", "error": str(exc)})

        try:
            self.state_store.save(self.state)
        except Exception:
            pass
        try:
            self.client.close()
        except Exception:
            pass
        try:
            self.db.close()
        except Exception:
            pass
        self._closed_resources = True


def main() -> None:
    load_dotenv()
    settings = load_settings()
    bot = TradingBot(settings)

    def _signal_handler(_sig, _frame):
        bot.stop()

    signal.signal(signal.SIGINT, _signal_handler)
    signal.signal(signal.SIGTERM, _signal_handler)

    try:
        bot.run()
    except SdkNotInstalledError as exc:
        print(str(exc))
    finally:
        bot.stop()


if __name__ == "__main__":
    main()
