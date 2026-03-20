from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.signals import (
    CandlePoint,
    atr,
    bollinger_rebound_score,
    compute_score,
    has_candle_gaps,
    momentum,
    opening_range_breakout_score,
)


def make_trend_candles(n: int) -> list[CandlePoint]:
    out: list[CandlePoint] = []
    price = 100.0
    for i in range(n):
        o = price
        h = price * 1.002
        l = price * 0.998
        c = price * 1.001
        out.append(CandlePoint(open=o, high=h, low=l, close=c, ts=f"t{i}"))
        price = c
    return out


def test_momentum_positive_on_trend():
    candles = make_trend_candles(80)
    assert momentum(candles, 5) > 0
    assert momentum(candles, 60) > 0


def test_atr_non_zero():
    candles = make_trend_candles(80)
    assert atr(candles, 15) > 0


def test_score_degrades_with_bad_spread():
    candles = make_trend_candles(80)
    good = compute_score(candles, spread_pct=0.05, slippage_pct=0.05)
    bad = compute_score(candles, spread_pct=0.8, slippage_pct=0.6)
    assert good.total > bad.total


def test_has_candle_gaps_detects_large_gap():
    candles = [
        CandlePoint(open=1, high=1, low=1, close=1, ts="2026-02-16T10:00:00+00:00"),
        CandlePoint(open=1, high=1, low=1, close=1, ts="2026-02-16T10:01:00+00:00"),
        CandlePoint(open=1, high=1, low=1, close=1, ts="2026-02-16T10:05:00+00:00"),
    ]
    assert has_candle_gaps(candles)


def test_opening_range_breakout_score_positive_on_breakout():
    base = datetime(2026, 2, 16, 10, 5, tzinfo=timezone.utc)
    candles: list[CandlePoint] = []
    px = 100.0
    for i in range(30):
        if i < 15:
            h = 100.5
            l = 99.8
        else:
            h = px * 1.002
            l = px * 0.998
        c = px * 1.0015
        candles.append(
            CandlePoint(
                open=px,
                high=h,
                low=l,
                close=c,
                ts=(base + timedelta(minutes=i)).isoformat(),
            )
        )
        px = c

    score, rng = opening_range_breakout_score(
        candles=candles,
        now=base + timedelta(minutes=29),
        session_open=base,
        orb_minutes=15,
        breakout_buffer_pct=0.03,
        min_range_pct=0.05,
    )
    assert rng > 0
    assert score > 0


def test_bollinger_rebound_score_detects_rebound():
    candles: list[CandlePoint] = []
    base = datetime(2026, 2, 16, 10, 0, tzinfo=timezone.utc)
    closes = [100.0, 100.1, 100.2, 100.15, 100.0, 99.8, 99.6, 99.4, 99.7, 100.0, 100.2, 100.3, 100.35]
    for i, close in enumerate(closes):
        candles.append(
            CandlePoint(
                open=close * 0.999,
                high=close * 1.001,
                low=close * 0.998,
                close=close,
                ts=(base + timedelta(minutes=i)).isoformat(),
            )
        )

    score = bollinger_rebound_score(candles, period=10, stddev_mult=1.6, max_distance_pct=3.0)
    assert score > 0
