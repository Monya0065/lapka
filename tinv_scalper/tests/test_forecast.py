from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.forecast import train_and_forecast
from app.signals import CandlePoint


def make_trend_candles(n: int = 90) -> list[CandlePoint]:
    out: list[CandlePoint] = []
    base = datetime(2026, 2, 16, 10, 0, tzinfo=timezone.utc)
    price = 100.0
    for i in range(n):
        drift = 1.0006
        price = price * drift
        out.append(
            CandlePoint(
                open=price * 0.999,
                high=price * 1.001,
                low=price * 0.998,
                close=price,
                ts=(base + timedelta(minutes=i)).isoformat(),
            )
        )
    return out


def test_train_and_forecast_trend_positive():
    candles = make_trend_candles()
    fc = train_and_forecast(candles, horizon=5, min_samples=10, epochs=6)
    assert fc.samples > 0
    assert fc.expected_return > -0.02
    assert 0.0 <= fc.confidence <= 1.0
