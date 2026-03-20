from __future__ import annotations

from datetime import datetime, timedelta
from math import sqrt
from dataclasses import dataclass
from statistics import mean


@dataclass(slots=True)
class CandlePoint:
    open: float
    high: float
    low: float
    close: float
    ts: str


@dataclass(slots=True)
class SignalMetrics:
    momentum_60m: float
    momentum_5m: float
    atr_15m: float
    noise_penalty: float


@dataclass(slots=True)
class SignalScore:
    total: float
    expected_net_edge: float
    metrics: SignalMetrics


def momentum(candles: list[CandlePoint], window: int) -> float:
    if len(candles) < window + 1:
        return 0.0
    start = candles[-window - 1].close
    end = candles[-1].close
    if start <= 0:
        return 0.0
    return (end - start) / start


def atr(candles: list[CandlePoint], period: int = 15) -> float:
    if len(candles) < period + 1:
        return 0.0
    tr_values: list[float] = []
    sample = candles[-(period + 1) :]
    for prev, cur in zip(sample, sample[1:]):
        tr = max(cur.high - cur.low, abs(cur.high - prev.close), abs(cur.low - prev.close))
        tr_values.append(tr)
    last = candles[-1].close
    if last <= 0:
        return 0.0
    return mean(tr_values) / last


def noise_penalty(candles: list[CandlePoint], period: int = 20) -> float:
    if len(candles) < period:
        return 1.0
    sample = candles[-period:]
    body = sum(abs(c.close - c.open) for c in sample)
    full = sum(max(c.high - c.low, 1e-9) for c in sample)
    smoothness = body / full
    return max(0.0, 1.0 - smoothness)


def compute_score(candles: list[CandlePoint], spread_pct: float, slippage_pct: float) -> SignalScore:
    m60 = momentum(candles, 60)
    m5 = momentum(candles, 5)
    atr15 = atr(candles, 15)
    noise = noise_penalty(candles, 20)

    spread_pen = spread_pct / 100.0
    slippage_pen = slippage_pct / 100.0

    expected = m5 + 0.5 * m60 - spread_pen - slippage_pen - 0.35 * noise
    total = expected + 0.2 * atr15

    return SignalScore(
        total=total,
        expected_net_edge=expected,
        metrics=SignalMetrics(
            momentum_60m=m60,
            momentum_5m=m5,
            atr_15m=atr15,
            noise_penalty=noise,
        ),
    )


def last_candle_return_pct(candles: list[CandlePoint]) -> float:
    if len(candles) < 2:
        return 0.0
    prev = candles[-2].close
    last = candles[-1].close
    if prev <= 0:
        return 0.0
    return ((last - prev) / prev) * 100.0


def has_candle_gaps(candles: list[CandlePoint], max_gap_sec: int = 130) -> bool:
    if len(candles) < 3:
        return False

    def parse_ts(ts: str) -> datetime:
        s = ts.replace("Z", "+00:00")
        return datetime.fromisoformat(s)

    for prev, cur in zip(candles, candles[1:]):
        try:
            dt_prev = parse_ts(prev.ts)
            dt_cur = parse_ts(cur.ts)
        except Exception:
            continue
        gap = (dt_cur - dt_prev).total_seconds()
        if gap > max_gap_sec:
            return True
    return False


def _safe_std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    m = mean(values)
    var = sum((x - m) ** 2 for x in values) / len(values)
    return sqrt(max(var, 0.0))


def bollinger_rebound_score(
    candles: list[CandlePoint],
    period: int = 20,
    stddev_mult: float = 2.0,
    max_distance_pct: float = 2.5,
) -> float:
    if len(candles) < period + 3:
        return 0.0

    closes = [c.close for c in candles[-period:]]
    mid = mean(closes)
    if mid <= 0:
        return 0.0

    sigma = _safe_std(closes)
    lower = mid - stddev_mult * sigma
    if lower <= 0:
        return 0.0

    prev = candles[-2].close
    last = candles[-1].close
    if prev <= 0 or last <= 0:
        return 0.0

    dist_pct = abs((last - mid) / mid) * 100.0
    if dist_pct > max_distance_pct:
        return 0.0

    touch_tol = mid * 0.0015

    # Preferred long setup: bounce from under lower band back toward mean.
    if prev <= (lower + touch_tol) < last:
        return max(0.0, (last - lower) / mid)

    # Secondary setup: recent touch of lower band and then reclaim midline.
    touched_lower = any(c.close <= (lower + touch_tol) for c in candles[-6:-1])
    if touched_lower and last > mid:
        return max(0.0, (last - mid) / mid * 0.8)

    return 0.0


def opening_range_breakout_score(
    candles: list[CandlePoint],
    now: datetime,
    session_open: datetime,
    orb_minutes: int = 15,
    breakout_buffer_pct: float = 0.03,
    min_range_pct: float = 0.08,
) -> tuple[float, float]:
    if len(candles) < max(12, orb_minutes):
        return 0.0, 0.0

    orb_minutes = max(3, int(orb_minutes))
    orb_end = session_open + timedelta(minutes=orb_minutes)
    if now < orb_end:
        return 0.0, 0.0

    def parse_ts(ts: str) -> datetime:
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(session_open.tzinfo)

    orb_slice: list[CandlePoint] = []
    for candle in candles:
        try:
            cdt = parse_ts(candle.ts)
        except Exception:
            continue
        if session_open <= cdt < orb_end:
            orb_slice.append(candle)

    if len(orb_slice) < max(3, orb_minutes // 3):
        return 0.0, 0.0

    rng_high = max(c.high for c in orb_slice)
    rng_low = min(c.low for c in orb_slice)
    mid = (rng_high + rng_low) / 2.0
    if mid <= 0:
        return 0.0, 0.0

    range_pct = ((rng_high - rng_low) / mid) * 100.0
    if range_pct < min_range_pct:
        return 0.0, range_pct

    last_close = candles[-1].close
    breakout_price = rng_high * (1.0 + breakout_buffer_pct / 100.0)
    if last_close <= breakout_price:
        return 0.0, range_pct

    strength = (last_close - breakout_price) / breakout_price
    return max(0.0, strength), range_pct
