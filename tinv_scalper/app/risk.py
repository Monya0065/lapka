from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.state import BotState, hour_key


@dataclass(slots=True)
class SizingResult:
    max_lots_broker: int
    lots_by_risk: int
    lots_by_notional: int
    chosen_lots: int
    effective_leverage: float
    risk_multiplier: float


@dataclass(slots=True)
class RiskDecision:
    allowed: bool
    reason: str


class RiskEngine:
    def __init__(self, settings):
        self.s = settings

    def _drawdown_from_peak(self, state: BotState) -> float:
        if state.daily_peak_pnl_rub <= state.daily_realized_pnl_rub:
            return 0.0
        return state.daily_realized_pnl_rub - state.daily_peak_pnl_rub

    def dynamic_risk_multiplier(self, state: BotState, instrument_profile: str = "STANDARD") -> float:
        # Scale risk down under stress and under low-liquidity profiles.
        mult = 1.0
        if state.consecutive_losses >= max(1, self.s.max_consecutive_losses - 1):
            mult *= 0.5
        dd = self._drawdown_from_peak(state)
        if dd <= self.s.max_daily_drawdown_rub * 0.5:
            mult *= 0.6

        profile = instrument_profile.upper()
        if profile == "THIN":
            mult *= 0.5
        elif profile == "STANDARD":
            mult *= 0.8

        return max(0.15, min(1.0, mult))

    def check_entry_allowed(
        self,
        state: BotState,
        now: datetime,
        now_ts: float,
        trading_session_ok: bool,
        figi: str,
    ) -> RiskDecision:
        if state.killswitched:
            return RiskDecision(False, "KILL-SWITCH")
        if not state.trading_enabled:
            return RiskDecision(False, "STOPPED")
        if state.close_only_mode:
            return RiskDecision(False, "CLOSE-ONLY")
        if state.daily_realized_pnl_rub <= self.s.daily_loss_limit_rub:
            return RiskDecision(False, "DAILY-LOSS")
        if self._drawdown_from_peak(state) <= self.s.max_daily_drawdown_rub:
            return RiskDecision(False, "DAILY-DRAWDOWN")
        if state.trades_today >= self.s.max_trades_per_day:
            return RiskDecision(False, "TRADES-LIMIT-DAY")
        hkey = hour_key(now)
        if state.trades_by_hour.get(hkey, 0) >= self.s.max_trades_per_hour:
            return RiskDecision(False, "TRADES-LIMIT-HOUR")
        if state.daily_slippage_pct_sum >= self.s.max_daily_slippage_pct:
            return RiskDecision(False, "SLIPPAGE-LIMIT")
        if state.cooldown_until_ts > now_ts:
            return RiskDecision(False, "TRADE-COOLDOWN")
        if state.losses_cooldown_until_ts > now_ts:
            return RiskDecision(False, "LOSS-COOLDOWN")
        if state.order_failure_cooldown_until_ts > now_ts:
            return RiskDecision(False, "ORDER-FAIL-COOLDOWN")
        if state.paused_by_volatility_until_ts > now_ts:
            return RiskDecision(False, "VOLATILITY-PAUSE")
        if not trading_session_ok:
            return RiskDecision(False, "SESSION-CLOSED")
        max_notional_day = float(getattr(self.s, "max_notional_per_day_rub", 1e18))
        max_notional_hour = float(getattr(self.s, "max_notional_per_hour_rub", 1e18))
        if state.notional_traded_today_rub >= max_notional_day:
            return RiskDecision(False, "NOTIONAL-LIMIT-DAY")
        if state.notional_by_hour_rub.get(hkey, 0.0) >= max_notional_hour:
            return RiskDecision(False, "NOTIONAL-LIMIT-HOUR")

        sym_pnl = state.symbol_realized_pnl_rub.get(figi, 0.0)
        if sym_pnl <= self.s.max_loss_per_symbol_rub:
            return RiskDecision(False, "SYMBOL-LOSS-LIMIT")

        banned_until = state.symbol_banned_until_ts.get(figi, 0.0)
        if banned_until > now_ts:
            return RiskDecision(False, "SYMBOL-BAN")

        return RiskDecision(True, "RUNNING")

    def size_position(
        self,
        equity_rub: float,
        entry_price: float,
        lot_size: int,
        stop_loss_pct: float,
        max_lots_broker: int,
        risk_multiplier: float,
    ) -> SizingResult:
        if entry_price <= 0:
            raise ValueError("entry_price must be positive")
        if lot_size <= 0:
            raise ValueError("lot_size must be positive")
        if stop_loss_pct <= 0:
            raise ValueError("stop_loss_pct must be positive")

        risk_budget = equity_rub * self.s.risk_per_trade_pct * max(0.0, risk_multiplier)
        risk_per_lot = entry_price * lot_size * (stop_loss_pct / 100.0)
        lots_by_risk = int(risk_budget / max(risk_per_lot, 1e-9))

        lot_notional = entry_price * lot_size
        lots_by_notional = int(self.s.max_position_rub / max(lot_notional, 1e-9))
        lots_by_leverage = int((equity_rub * self.s.max_leverage) / max(lot_notional, 1e-9))

        chosen = min(
            max(0, int(max_lots_broker)),
            max(0, int(lots_by_risk)),
            max(0, int(self.s.max_lots_cap)),
            max(0, int(lots_by_notional)),
            max(0, int(lots_by_leverage)),
        )

        notional = chosen * lot_notional
        effective_lev = (notional / equity_rub) if equity_rub > 0 else 0.0

        return SizingResult(
            max_lots_broker=max(0, int(max_lots_broker)),
            lots_by_risk=max(0, int(lots_by_risk)),
            lots_by_notional=max(0, int(lots_by_notional)),
            chosen_lots=max(0, int(chosen)),
            effective_leverage=max(0.0, effective_lev),
            risk_multiplier=max(0.0, risk_multiplier),
        )

    def on_trade_closed(self, state: BotState, figi: str, pnl_rub: float, slippage_pct: float, now: datetime) -> None:
        state.trades_today += 1
        hkey = hour_key(now)
        state.trades_by_hour[hkey] = state.trades_by_hour.get(hkey, 0) + 1

        state.daily_realized_pnl_rub += pnl_rub
        state.daily_peak_pnl_rub = max(state.daily_peak_pnl_rub, state.daily_realized_pnl_rub)
        state.daily_slippage_pct_sum += max(0.0, slippage_pct)

        state.symbol_realized_pnl_rub[figi] = state.symbol_realized_pnl_rub.get(figi, 0.0) + pnl_rub
        state.last_exit_ts_by_symbol[figi] = now.timestamp()
        state.cooldown_until_ts = now.timestamp() + self.s.cooldown_after_trade_sec

        if pnl_rub < 0:
            state.consecutive_losses += 1
        else:
            state.consecutive_losses = 0
            state.symbol_failed_entries[figi] = 0

        if state.consecutive_losses >= self.s.max_consecutive_losses:
            state.losses_cooldown_until_ts = now.timestamp() + self.s.cooldown_after_losses_sec

    def on_partial_close(self, state: BotState, figi: str, pnl_rub: float, slippage_pct: float) -> None:
        # Partial realization contributes to daily PnL/slippage and symbol limits,
        # but does not advance round-trip counters/cooldowns.
        state.daily_realized_pnl_rub += pnl_rub
        state.daily_peak_pnl_rub = max(state.daily_peak_pnl_rub, state.daily_realized_pnl_rub)
        state.daily_slippage_pct_sum += max(0.0, slippage_pct)
        state.symbol_realized_pnl_rub[figi] = state.symbol_realized_pnl_rub.get(figi, 0.0) + pnl_rub

    def on_notional_executed(self, state: BotState, notional_rub: float, now: datetime) -> None:
        value = max(0.0, float(notional_rub))
        state.notional_traded_today_rub += value
        hkey = hour_key(now)
        state.notional_by_hour_rub[hkey] = state.notional_by_hour_rub.get(hkey, 0.0) + value

    def on_entry_failed(self, state: BotState, figi: str, now_ts: float) -> None:
        fails = state.symbol_failed_entries.get(figi, 0) + 1
        state.symbol_failed_entries[figi] = fails
        if fails >= self.s.max_failed_entries_per_symbol:
            state.symbol_banned_until_ts[figi] = now_ts + self.s.symbol_ban_seconds

    def detect_abnormal_candle(self, candle_return_pct: float, state: BotState, now_ts: float) -> bool:
        if abs(candle_return_pct) < self.s.abnormal_candle_pct:
            return False
        state.paused_by_volatility_until_ts = now_ts + self.s.abnormal_pause_sec
        return True
