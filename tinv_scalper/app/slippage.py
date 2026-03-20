from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class BookLevel:
    price: float
    quantity: int


@dataclass(slots=True)
class OrderBookSnapshot:
    bids: list[BookLevel]
    asks: list[BookLevel]


@dataclass(slots=True)
class SlippageEstimate:
    spread_pct: float
    slippage_pct: float
    vwap: float
    best_ask: float
    best_bid: float


@dataclass(slots=True)
class OrderBookDepthStats:
    bid_qty: int
    ask_qty: int
    bid_notional: float
    ask_notional: float
    bid_ask_ratio: float


def estimate_buy_slippage(orderbook: OrderBookSnapshot, target_lots: int, lot_size: int = 1) -> SlippageEstimate:
    if not orderbook.asks or not orderbook.bids:
        raise ValueError("orderbook invalid: one side is empty")

    best_ask = orderbook.asks[0].price
    best_bid = orderbook.bids[0].price
    if best_ask <= 0 or best_bid <= 0 or best_ask < best_bid:
        raise ValueError("orderbook invalid: best prices")

    spread_pct = ((best_ask - best_bid) / best_ask) * 100.0

    need = max(1, int(target_lots))
    lot = max(1, int(lot_size))
    left = need
    value = 0.0
    filled = 0

    for level in orderbook.asks:
        q = max(0, int(level.quantity))
        if q == 0:
            continue
        take = min(left, q)
        value += take * level.price * lot
        filled += take
        left -= take
        if left == 0:
            break

    if filled == 0:
        raise ValueError("orderbook invalid: no asks")

    vwap = value / max(1, filled * lot)
    slippage_pct = ((vwap - best_ask) / best_ask) * 100.0
    if left > 0:
        slippage_pct += 100.0

    return SlippageEstimate(
        spread_pct=spread_pct,
        slippage_pct=slippage_pct,
        vwap=vwap,
        best_ask=best_ask,
        best_bid=best_bid,
    )


def estimate_sell_slippage(orderbook: OrderBookSnapshot, target_lots: int, lot_size: int = 1) -> SlippageEstimate:
    if not orderbook.asks or not orderbook.bids:
        raise ValueError("orderbook invalid: one side is empty")

    best_ask = orderbook.asks[0].price
    best_bid = orderbook.bids[0].price
    if best_ask <= 0 or best_bid <= 0 or best_ask < best_bid:
        raise ValueError("orderbook invalid: best prices")

    spread_pct = ((best_ask - best_bid) / best_ask) * 100.0

    need = max(1, int(target_lots))
    lot = max(1, int(lot_size))
    left = need
    value = 0.0
    filled = 0

    for level in orderbook.bids:
        q = max(0, int(level.quantity))
        if q == 0:
            continue
        take = min(left, q)
        value += take * level.price * lot
        filled += take
        left -= take
        if left == 0:
            break

    if filled == 0:
        raise ValueError("orderbook invalid: no bids")

    vwap = value / max(1, filled * lot)
    slippage_pct = ((best_bid - vwap) / best_bid) * 100.0
    if left > 0:
        slippage_pct += 100.0

    return SlippageEstimate(
        spread_pct=spread_pct,
        slippage_pct=slippage_pct,
        vwap=vwap,
        best_ask=best_ask,
        best_bid=best_bid,
    )


def orderbook_depth_stats(orderbook: OrderBookSnapshot, levels: int = 5, lot_size: int = 1) -> OrderBookDepthStats:
    lvl = max(1, int(levels))
    lot = max(1, int(lot_size))
    bids = orderbook.bids[:lvl]
    asks = orderbook.asks[:lvl]

    bid_qty = sum(max(0, int(x.quantity)) for x in bids)
    ask_qty = sum(max(0, int(x.quantity)) for x in asks)
    bid_notional = sum(max(0, int(x.quantity)) * max(0.0, float(x.price)) * lot for x in bids)
    ask_notional = sum(max(0, int(x.quantity)) * max(0.0, float(x.price)) * lot for x in asks)

    ratio = bid_qty / max(1.0, float(ask_qty))
    return OrderBookDepthStats(
        bid_qty=bid_qty,
        ask_qty=ask_qty,
        bid_notional=bid_notional,
        ask_notional=ask_notional,
        bid_ask_ratio=ratio,
    )
