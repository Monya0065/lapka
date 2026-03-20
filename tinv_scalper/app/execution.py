from __future__ import annotations

import time
import uuid
from dataclasses import dataclass
from datetime import datetime

from app.config import RunMode
from app.state import BotState, PositionState, add_marker
from app.tbank_client import OrderStateSnapshot, TBankClient


@dataclass(slots=True)
class ExecutionResult:
    ok: bool
    order_id: str
    requested_lots: int
    filled_lots: int
    avg_price: float
    status: str
    message: str


class ExecutionEngine:
    def __init__(self, settings, client: TBankClient, logger):
        self.s = settings
        self.client = client
        self.logger = logger

    def _is_filled(self, status: str) -> bool:
        st = status.upper()
        return "FILL" in st

    def _is_rejected(self, status: str) -> bool:
        st = status.upper()
        for token in ["REJECT", "CANCEL", "UNSPECIFIED", "FAIL"]:
            if token in st:
                return True
        return False

    def _poll_order(self, order_id: str) -> OrderStateSnapshot:
        deadline = time.time() + self.s.order_fill_timeout_sec
        while time.time() <= deadline:
            state = self.client.get_order_state(order_id)
            if self._is_filled(state.status) or self._is_rejected(state.status):
                return state
            time.sleep(1)

        self.client.cancel_order(order_id)
        return self.client.get_order_state(order_id)

    def _reconcile_position(self, figi: str) -> tuple[int, float]:
        positions = self.client.get_positions()
        for pos in positions:
            if pos.figi == figi:
                return max(0, int(pos.balance_lots)), max(0.0, float(pos.average_price))
        return 0, 0.0

    def _post_with_fallback(
        self,
        figi: str,
        lots: int,
        buy: bool,
        ref_price: float,
    ) -> tuple[str, OrderStateSnapshot]:
        aggr = self.s.limit_order_aggr_bps / 10_000.0
        limit_price = ref_price * (1 + aggr if buy else 1 - aggr)

        lid = str(uuid.uuid4())
        self.logger.info(
            "post limit",
            extra={
                "event": "order_request",
                "side": "BUY" if buy else "SELL",
                "figi": figi,
                "lots": lots,
                "order_type": "limit",
                "limit_price": limit_price,
                "order_id": lid,
            },
        )
        self.client.post_order(figi=figi, lots=lots, buy=buy, order_id=lid, order_type="limit", price=limit_price)
        state = self._poll_order(lid)
        if self._is_filled(state.status):
            return lid, state

        mid = str(uuid.uuid4())
        self.logger.info(
            "limit fallback to market",
            extra={
                "event": "order_request",
                "side": "BUY" if buy else "SELL",
                "figi": figi,
                "lots": max(0, lots - state.filled_lots),
                "order_type": "market",
                "order_id": mid,
            },
        )
        remain = max(0, lots - state.filled_lots)
        if remain == 0:
            return lid, state

        self.client.post_order(figi=figi, lots=remain, buy=buy, order_id=mid, order_type="market")
        mstate = self._poll_order(mid)
        return mid, mstate

    def _split_lots(self, total_lots: int, slices_override: int | None = None) -> list[int]:
        slices_cfg = self.s.order_slices if slices_override is None else slices_override
        slices = max(1, min(int(slices_cfg), total_lots))
        base = total_lots // slices
        rem = total_lots % slices
        out = []
        for i in range(slices):
            out.append(base + (1 if i < rem else 0))
        return [x for x in out if x > 0]

    def _paper_fee(self, notional_rub: float) -> float:
        return max(0.0, notional_rub) * (self.s.commission_bps / 10_000.0)

    def open_long(
        self,
        state: BotState,
        figi: str,
        ticker: str,
        lots: int,
        lot_size: int,
        expected_price: float,
        now: datetime,
        slices_override: int | None = None,
    ) -> ExecutionResult:
        mode = RunMode(state.mode)
        if lots <= 0:
            return ExecutionResult(False, "", 0, 0, 0.0, "REJECT", "lots <= 0")

        if mode in {RunMode.DRY_RUN, RunMode.PAPER}:
            if mode == RunMode.PAPER:
                notional = lots * lot_size * expected_price
                state.paper_cash_rub -= notional + self._paper_fee(notional)
            state.position = PositionState(
                figi=figi,
                ticker=ticker,
                lots=lots,
                avg_price=expected_price,
                peak_price=expected_price,
                breakeven_armed=False,
                tp1_done=False,
                opened_at=now.isoformat(),
            )
            add_marker(state, "entry", figi, expected_price, now)
            return ExecutionResult(True, f"SIM-{uuid.uuid4()}", lots, lots, expected_price, "SIM_FILL", "simulated")

        requested = lots
        child_ids: list[str] = []
        for chunk in self._split_lots(lots, slices_override=slices_override):
            oid, ostate = self._post_with_fallback(figi=figi, lots=chunk, buy=True, ref_price=expected_price)
            child_ids.append(oid)
            if self._is_rejected(ostate.status) and ostate.filled_lots <= 0:
                break

        filled_lots, avg_price = self._reconcile_position(figi)
        if filled_lots <= 0:
            return ExecutionResult(
                False,
                child_ids[-1] if child_ids else "",
                requested,
                0,
                0.0,
                "REJECT",
                "entry mismatch: no broker position",
            )

        state.position = PositionState(
            figi=figi,
            ticker=ticker,
            lots=filled_lots,
            avg_price=avg_price if avg_price > 0 else expected_price,
            peak_price=avg_price if avg_price > 0 else expected_price,
            breakeven_armed=False,
            tp1_done=False,
            opened_at=now.isoformat(),
        )
        add_marker(state, "entry", figi, state.position.avg_price, now)

        return ExecutionResult(
            True,
            child_ids[-1] if child_ids else "",
            requested,
            filled_lots,
            state.position.avg_price,
            "FILLED",
            "entry filled",
        )

    def close_position(
        self,
        state: BotState,
        reason: str,
        lot_size: int,
        expected_price: float,
        now: datetime,
        slices_override: int | None = None,
    ) -> ExecutionResult:
        if state.position.lots <= 0 or not state.position.figi:
            return ExecutionResult(True, "", 0, 0, 0.0, "EMPTY", "nothing to close")

        figi = state.position.figi
        lots = state.position.lots
        mode = RunMode(state.mode)

        if mode in {RunMode.DRY_RUN, RunMode.PAPER}:
            if mode == RunMode.PAPER:
                notional = lots * lot_size * expected_price
                state.paper_cash_rub += notional - self._paper_fee(notional)
            add_marker(state, "exit", figi, expected_price, now)
            result = ExecutionResult(True, f"SIM-{uuid.uuid4()}", lots, lots, expected_price, "SIM_FILL", reason)
            state.position = PositionState()
            return result

        requested = lots
        child_ids: list[str] = []
        for chunk in self._split_lots(lots, slices_override=slices_override):
            oid, ostate = self._post_with_fallback(figi=figi, lots=chunk, buy=False, ref_price=expected_price)
            child_ids.append(oid)
            if self._is_rejected(ostate.status) and ostate.filled_lots <= 0:
                break

        remaining, _ = self._reconcile_position(figi)
        filled = max(0, requested - remaining)

        if remaining > 0:
            return ExecutionResult(
                False,
                child_ids[-1] if child_ids else "",
                requested,
                filled,
                expected_price,
                "PARTIAL",
                "partial close, position still open",
            )

        add_marker(state, "exit", figi, expected_price, now)
        state.position = PositionState()
        return ExecutionResult(True, child_ids[-1] if child_ids else "", requested, filled, expected_price, "FILLED", reason)

    def close_lots(
        self,
        state: BotState,
        lots_to_close: int,
        reason: str,
        lot_size: int,
        expected_price: float,
        now: datetime,
        slices_override: int | None = None,
    ) -> ExecutionResult:
        if state.position.lots <= 0 or not state.position.figi:
            return ExecutionResult(True, "", 0, 0, 0.0, "EMPTY", "nothing to close")

        if lots_to_close <= 0:
            return ExecutionResult(False, "", 0, 0, 0.0, "REJECT", "lots_to_close <= 0")

        if lots_to_close >= state.position.lots:
            return self.close_position(
                state=state,
                reason=reason,
                lot_size=lot_size,
                expected_price=expected_price,
                now=now,
                slices_override=slices_override,
            )

        figi = state.position.figi
        ticker = state.position.ticker
        prev_lots = state.position.lots
        prev_avg = state.position.avg_price
        prev_opened_at = state.position.opened_at
        prev_peak = state.position.peak_price
        prev_tp1_done = state.position.tp1_done
        prev_be = state.position.breakeven_armed
        mode = RunMode(state.mode)

        requested = min(lots_to_close, prev_lots)
        if mode in {RunMode.DRY_RUN, RunMode.PAPER}:
            if mode == RunMode.PAPER:
                notional = requested * lot_size * expected_price
                state.paper_cash_rub += notional - self._paper_fee(notional)
            remaining = prev_lots - requested
            if remaining <= 0:
                add_marker(state, "exit", figi, expected_price, now)
                state.position = PositionState()
            else:
                add_marker(state, "partial_exit", figi, expected_price, now)
                state.position = PositionState(
                    figi=figi,
                    ticker=ticker,
                    lots=remaining,
                    avg_price=prev_avg,
                    peak_price=max(prev_peak, expected_price),
                    breakeven_armed=prev_be,
                    tp1_done=prev_tp1_done,
                    opened_at=prev_opened_at,
                )
            return ExecutionResult(True, f"SIM-{uuid.uuid4()}", requested, requested, expected_price, "SIM_FILL", reason)

        child_ids: list[str] = []
        for chunk in self._split_lots(requested, slices_override=slices_override):
            oid, ostate = self._post_with_fallback(figi=figi, lots=chunk, buy=False, ref_price=expected_price)
            child_ids.append(oid)
            if self._is_rejected(ostate.status) and ostate.filled_lots <= 0:
                break

        remaining, avg_after = self._reconcile_position(figi)
        filled = max(0, prev_lots - remaining)
        if filled <= 0:
            return ExecutionResult(
                False,
                child_ids[-1] if child_ids else "",
                requested,
                0,
                expected_price,
                "REJECT",
                "partial close mismatch: no fill",
            )

        if remaining <= 0:
            add_marker(state, "exit", figi, expected_price, now)
            state.position = PositionState()
            return ExecutionResult(
                True,
                child_ids[-1] if child_ids else "",
                requested,
                min(filled, requested),
                expected_price,
                "FILLED",
                reason,
            )

        add_marker(state, "partial_exit", figi, expected_price, now)
        state.position = PositionState(
            figi=figi,
            ticker=ticker,
            lots=remaining,
            avg_price=avg_after if avg_after > 0 else prev_avg,
            peak_price=max(prev_peak, expected_price),
            breakeven_armed=prev_be,
            tp1_done=prev_tp1_done,
            opened_at=prev_opened_at,
        )
        return ExecutionResult(
            True,
            child_ids[-1] if child_ids else "",
            requested,
            min(filled, requested),
            expected_price,
            "PARTIAL_FILLED",
            reason,
        )
