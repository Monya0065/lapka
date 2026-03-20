from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import math
from typing import Any, Callable

from app.signals import CandlePoint
from app.slippage import BookLevel, OrderBookSnapshot


class ApiKillSwitchError(RuntimeError):
    pass


class SdkNotInstalledError(RuntimeError):
    pass


@dataclass(slots=True)
class ShareInfo:
    figi: str
    ticker: str
    lot: int
    currency: str
    exchange: str
    class_code: str
    api_trade_available_flag: bool
    buy_available_flag: bool
    sell_available_flag: bool
    trading_status: str


@dataclass(slots=True)
class PortfolioSnapshot:
    equity_rub: float


@dataclass(slots=True)
class PositionSnapshot:
    figi: str
    balance_lots: int
    average_price: float


@dataclass(slots=True)
class OrderStateSnapshot:
    order_id: str
    status: str
    requested_lots: int
    filled_lots: int
    execution_price: float


class TBankClient:
    def __init__(
        self,
        token: str,
        account_id: str,
        max_retry_errors: int,
        logger,
        on_retry: Callable[[], None] | None = None,
    ):
        self.token = token
        self.account_id = account_id
        self.max_retry_errors = max_retry_errors
        self.logger = logger
        self.on_retry = on_retry

        self._load_sdk()
        self._client_cm = self._sdk["Client"](self.token)
        self._client = self._client_cm.__enter__()

        self._latency_ms_ewma: float = 0.0
        self._ewma_alpha = 0.2
        self._api_calls_total: int = 0
        self._api_calls_window: deque[float] = deque()

    def _load_sdk(self) -> None:
        try:
            from t_tech.invest import (  # type: ignore[import-not-found]
                CandleInterval,
                Client,
                InstrumentStatus,
                OrderDirection,
                OrderType,
                Quotation,
            )
        except Exception as exc:  # pragma: no cover
            raise SdkNotInstalledError(
                "Install SDK: pip install t-tech-investments --index-url https://opensource.tbank.ru/api/v4/projects/238/packages/pypi/simple"
            ) from exc

        self._sdk = {
            "Client": Client,
            "CandleInterval": CandleInterval,
            "InstrumentStatus": InstrumentStatus,
            "OrderDirection": OrderDirection,
            "OrderType": OrderType,
            "Quotation": Quotation,
        }

    @property
    def latency_ms_ewma(self) -> float:
        return self._latency_ms_ewma

    @property
    def api_calls_total(self) -> int:
        return self._api_calls_total

    @property
    def api_calls_last_minute(self) -> int:
        now = time.time()
        while self._api_calls_window and now - self._api_calls_window[0] > 60.0:
            self._api_calls_window.popleft()
        return len(self._api_calls_window)

    def close(self) -> None:
        self._client_cm.__exit__(None, None, None)

    def _quote_to_float(self, value: Any) -> float:
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        if hasattr(value, "units") and hasattr(value, "nano"):
            return float(value.units) + float(value.nano) / 1_000_000_000.0
        return float(value)

    def _to_quotation(self, price: float):
        quotation = self._sdk["Quotation"]
        units = int(price)
        nano = int(round((price - units) * 1_000_000_000))
        if price < 0 and nano > 0:
            nano = -nano
        return quotation(units=units, nano=nano)

    def _enum_attr(self, enum_obj: Any, *candidates: str) -> Any:
        for name in candidates:
            if hasattr(enum_obj, name):
                return getattr(enum_obj, name)
        raise AttributeError(f"Enum value not found in {enum_obj}: {candidates}")

    def _parse_ts_sort_key(self, ts_value: str) -> datetime:
        try:
            dt = datetime.fromisoformat(str(ts_value).replace("Z", "+00:00"))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return datetime.min.replace(tzinfo=timezone.utc)

    def _record_latency(self, latency_ms: float) -> None:
        if self._latency_ms_ewma == 0:
            self._latency_ms_ewma = latency_ms
        else:
            self._latency_ms_ewma = self._ewma_alpha * latency_ms + (1 - self._ewma_alpha) * self._latency_ms_ewma

    def _is_retryable(self, message: str) -> bool:
        needle = message.upper()
        return any(x in needle for x in ["429", "RESOURCE_EXHAUSTED", "500", "502", "503", "504", "UNAVAILABLE"])

    def _is_auth_error(self, message: str) -> bool:
        needle = message.upper()
        return any(x in needle for x in ["UNAUTHENTICATED", "PERMISSION_DENIED", "401", "403"])

    def _call(self, fn: Callable[..., Any], **kwargs) -> Any:
        retries = 0
        while True:
            now = time.time()
            self._api_calls_total += 1
            self._api_calls_window.append(now)
            while self._api_calls_window and now - self._api_calls_window[0] > 60.0:
                self._api_calls_window.popleft()
            started = time.perf_counter()
            try:
                resp = fn(**kwargs)
                latency_ms = (time.perf_counter() - started) * 1000.0
                self._record_latency(latency_ms)
                return resp
            except Exception as exc:
                msg = str(exc)
                if self._is_auth_error(msg):
                    raise ApiKillSwitchError(f"auth error: {msg}") from exc
                if self._is_retryable(msg) and retries < self.max_retry_errors:
                    retries += 1
                    backoff = min(2.0, 0.25 * retries)
                    self.logger.warning(
                        "retryable API error",
                        extra={"event": "api_retry", "retries": retries, "error": msg, "backoff_sec": backoff},
                    )
                    if self.on_retry:
                        self.on_retry()
                    time.sleep(backoff)
                    continue
                if self._is_retryable(msg):
                    raise ApiKillSwitchError(f"repeated API 429/5xx: {msg}") from exc
                raise

    def _call_variants(self, fn: Callable[..., Any], variants: list[dict[str, Any]]) -> Any:
        last_exc: Exception | None = None
        for kwargs in variants:
            try:
                return self._call(fn, **kwargs)
            except TypeError as exc:
                last_exc = exc
                continue
        if last_exc:
            raise last_exc
        raise RuntimeError("no call variants passed")

    def list_shares(self) -> list[ShareInfo]:
        instrument_status = self._enum_attr(
            self._sdk["InstrumentStatus"],
            "INSTRUMENT_STATUS_BASE",
            "INSTRUMENT_STATUS_ALL",
        )
        resp = self._call(self._client.instruments.shares, instrument_status=instrument_status)
        shares = getattr(resp, "instruments", [])
        result: list[ShareInfo] = []
        for share in shares:
            result.append(
                ShareInfo(
                    figi=str(getattr(share, "figi", "")),
                    ticker=str(getattr(share, "ticker", "")),
                    lot=int(getattr(share, "lot", 1) or 1),
                    currency=str(getattr(share, "currency", "")).upper(),
                    exchange=str(getattr(share, "exchange", "")),
                    class_code=str(getattr(share, "class_code", "")),
                    api_trade_available_flag=bool(getattr(share, "api_trade_available_flag", False)),
                    buy_available_flag=bool(getattr(share, "buy_available_flag", False)),
                    sell_available_flag=bool(getattr(share, "sell_available_flag", False)),
                    trading_status=str(getattr(share, "trading_status", "")),
                )
            )
        return result

    def get_candles_1m_last_60m(self, figi: str) -> list[CandlePoint]:
        now = datetime.now(timezone.utc)
        from_ = now - timedelta(minutes=60)
        interval = self._enum_attr(
            self._sdk["CandleInterval"],
            "CANDLE_INTERVAL_1_MIN",
            "CANDLE_INTERVAL_ONE_MINUTE",
        )
        resp = self._call_variants(
            self._client.market_data.get_candles,
            [
                {"figi": figi, "from_": from_, "to": now, "interval": interval},
                {"instrument_id": figi, "from_": from_, "to": now, "interval": interval},
            ],
        )
        candles = getattr(resp, "candles", [])
        out: list[CandlePoint] = []
        for c in candles:
            o = self._quote_to_float(getattr(c, "open", 0.0))
            h = self._quote_to_float(getattr(c, "high", 0.0))
            l = self._quote_to_float(getattr(c, "low", 0.0))
            cl = self._quote_to_float(getattr(c, "close", 0.0))
            ts = str(getattr(c, "time", ""))

            if not ts:
                continue
            if not all(math.isfinite(x) for x in (o, h, l, cl)):
                continue
            if cl <= 0 or h <= 0 or l <= 0:
                continue
            out.append(
                CandlePoint(
                    open=o,
                    high=h,
                    low=l,
                    close=cl,
                    ts=ts,
                )
            )
        dedup: dict[str, CandlePoint] = {}
        for point in out:
            dedup[point.ts] = point
        out = list(dedup.values())
        out.sort(key=lambda x: self._parse_ts_sort_key(x.ts))
        return out

    def get_order_book(self, figi: str, depth: int = 20) -> OrderBookSnapshot:
        resp = self._call_variants(
            self._client.market_data.get_order_book,
            [{"figi": figi, "depth": depth}, {"instrument_id": figi, "depth": depth}],
        )
        bids = [
            BookLevel(price=self._quote_to_float(getattr(level, "price", 0.0)), quantity=int(getattr(level, "quantity", 0)))
            for level in getattr(resp, "bids", [])
        ]
        asks = [
            BookLevel(price=self._quote_to_float(getattr(level, "price", 0.0)), quantity=int(getattr(level, "quantity", 0)))
            for level in getattr(resp, "asks", [])
        ]
        return OrderBookSnapshot(bids=bids, asks=asks)

    def get_max_lots(self, figi: str, price: float, is_buy: bool = True) -> int:
        price_q = self._to_quotation(price)
        resp = self._call_variants(
            self._client.orders.get_max_lots,
            [
                {"account_id": self.account_id, "figi": figi, "price": price_q},
                {"account_id": self.account_id, "instrument_id": figi, "price": price_q},
                {"account_id": self.account_id, "figi": figi, "price": price_q, "is_buy": is_buy},
                {"account_id": self.account_id, "instrument_id": figi, "price": price_q, "is_buy": is_buy},
            ],
        )

        if is_buy:
            if hasattr(resp, "buy_limits") and hasattr(resp.buy_limits, "buy_max_lots"):
                return int(resp.buy_limits.buy_max_lots)
            if hasattr(resp, "buy_max_lots"):
                return int(resp.buy_max_lots)
        else:
            if hasattr(resp, "sell_limits") and hasattr(resp.sell_limits, "sell_max_lots"):
                return int(resp.sell_limits.sell_max_lots)
            if hasattr(resp, "sell_max_lots"):
                return int(resp.sell_max_lots)
        if hasattr(resp, "max_lots"):
            return int(resp.max_lots)
        return 0

    def post_order(
        self,
        figi: str,
        lots: int,
        buy: bool,
        order_id: str,
        order_type: str = "market",
        price: float | None = None,
    ) -> str:
        direction = self._enum_attr(
            self._sdk["OrderDirection"],
            "ORDER_DIRECTION_BUY" if buy else "ORDER_DIRECTION_SELL",
        )
        if order_type.lower() == "limit":
            order_type_value = self._enum_attr(self._sdk["OrderType"], "ORDER_TYPE_LIMIT")
        else:
            order_type_value = self._enum_attr(self._sdk["OrderType"], "ORDER_TYPE_MARKET")

        kwargs_common: dict[str, Any] = {
            "quantity": lots,
            "direction": direction,
            "account_id": self.account_id,
            "order_type": order_type_value,
            "order_id": order_id,
        }

        if order_type.lower() == "limit":
            if price is None or price <= 0:
                raise ValueError("limit order requires positive price")
            kwargs_common["price"] = self._to_quotation(price)

        resp = self._call_variants(
            self._client.orders.post_order,
            [
                {"figi": figi, **kwargs_common},
                {"instrument_id": figi, **kwargs_common},
            ],
        )
        return str(getattr(resp, "order_id", order_id))

    def get_order_state(self, order_id: str) -> OrderStateSnapshot:
        resp = self._call(self._client.orders.get_order_state, account_id=self.account_id, order_id=order_id)
        status = str(getattr(resp, "execution_report_status", getattr(resp, "order_execution_report_status", "UNKNOWN")))
        req = int(getattr(resp, "lots_requested", getattr(resp, "initial_order_lots", 0)))
        filled = int(getattr(resp, "lots_executed", getattr(resp, "executed_order_lots", 0)))

        price_raw = getattr(resp, "executed_order_price", None)
        if price_raw is None:
            price_raw = getattr(resp, "average_position_price", None)
        price_value = self._quote_to_float(price_raw)

        return OrderStateSnapshot(
            order_id=str(getattr(resp, "order_id", order_id)),
            status=status,
            requested_lots=req,
            filled_lots=filled,
            execution_price=price_value,
        )

    def get_orders(self) -> list[str]:
        resp = self._call(self._client.orders.get_orders, account_id=self.account_id)
        orders = getattr(resp, "orders", [])
        return [str(getattr(x, "order_id", "")) for x in orders if str(getattr(x, "order_id", ""))]

    def cancel_order(self, order_id: str) -> None:
        self._call(self._client.orders.cancel_order, account_id=self.account_id, order_id=order_id)

    def get_positions(self) -> list[PositionSnapshot]:
        resp = self._call(self._client.operations.get_positions, account_id=self.account_id)
        securities = getattr(resp, "securities", [])
        positions: list[PositionSnapshot] = []
        for s in securities:
            figi = str(getattr(s, "figi", ""))
            balance = int(getattr(s, "balance", 0))
            avg = self._quote_to_float(getattr(s, "average_position_price", 0.0))
            if figi:
                positions.append(PositionSnapshot(figi=figi, balance_lots=balance, average_price=avg))
        return positions

    def get_portfolio(self) -> PortfolioSnapshot:
        resp = self._call(self._client.operations.get_portfolio, account_id=self.account_id)
        amount = getattr(resp, "total_amount_portfolio", None)
        return PortfolioSnapshot(equity_rub=self._quote_to_float(amount))
