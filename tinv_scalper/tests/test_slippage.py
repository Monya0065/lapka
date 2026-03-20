from __future__ import annotations

from app.slippage import BookLevel, OrderBookSnapshot, orderbook_depth_stats


def test_orderbook_depth_stats_basic():
    book = OrderBookSnapshot(
        bids=[BookLevel(price=100.0, quantity=50), BookLevel(price=99.9, quantity=30)],
        asks=[BookLevel(price=100.1, quantity=40), BookLevel(price=100.2, quantity=20)],
    )
    st = orderbook_depth_stats(book, levels=2)
    assert st.bid_qty == 80
    assert st.ask_qty == 60
    assert st.bid_notional > 0
    assert st.ask_notional > 0
    assert st.bid_ask_ratio > 1.0


def test_orderbook_depth_stats_scales_with_lot_size():
    book = OrderBookSnapshot(
        bids=[BookLevel(price=100.0, quantity=10)],
        asks=[BookLevel(price=101.0, quantity=10)],
    )
    st1 = orderbook_depth_stats(book, levels=1, lot_size=1)
    st10 = orderbook_depth_stats(book, levels=1, lot_size=10)
    assert st10.bid_notional == st1.bid_notional * 10
    assert st10.ask_notional == st1.ask_notional * 10
