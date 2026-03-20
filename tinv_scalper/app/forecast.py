from __future__ import annotations

from dataclasses import dataclass
from math import exp, sqrt

from app.signals import CandlePoint


@dataclass(slots=True)
class ForecastOutput:
    expected_return: float
    confidence: float
    samples: int
    mae: float


def _safe_return(a: float, b: float) -> float:
    if a <= 0:
        return 0.0
    return (b - a) / a


def _window_volatility(closes: list[float], end_idx: int, window: int) -> float:
    if end_idx < 1:
        return 0.0
    start = max(1, end_idx - window + 1)
    rets: list[float] = []
    for i in range(start, end_idx + 1):
        rets.append(_safe_return(closes[i - 1], closes[i]))
    if len(rets) < 2:
        return abs(rets[0]) if rets else 0.0
    m = sum(rets) / len(rets)
    var = sum((x - m) ** 2 for x in rets) / len(rets)
    return sqrt(max(var, 0.0))


def _feature_vector(closes: list[float], i: int) -> list[float]:
    c = closes[i]
    r1 = _safe_return(closes[i - 1], c) if i >= 1 else 0.0
    r5 = _safe_return(closes[i - 5], c) if i >= 5 else r1
    r15 = _safe_return(closes[i - 15], c) if i >= 15 else r5
    r30 = _safe_return(closes[i - 30], c) if i >= 30 else r15
    vol5 = _window_volatility(closes, i, 5)
    vol15 = _window_volatility(closes, i, 15)
    momentum_div = r5 - r15
    return [r1, r5, r15, r30, vol5, vol15, momentum_div]


def _dot(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def train_and_forecast(
    candles: list[CandlePoint],
    horizon: int = 5,
    min_samples: int = 16,
    lr: float = 0.35,
    l2: float = 0.002,
    epochs: int = 8,
    max_abs_pred: float = 0.08,
) -> ForecastOutput:
    closes = [float(c.close) for c in candles if float(c.close) > 0]
    n = len(closes)
    if n < 40:
        return ForecastOutput(expected_return=0.0, confidence=0.5, samples=0, mae=1.0)

    start = max(30, horizon + 2)
    train_x: list[list[float]] = []
    train_y: list[float] = []
    for i in range(start, n - horizon):
        x = _feature_vector(closes, i)
        y = _safe_return(closes[i], closes[i + horizon])
        train_x.append(x)
        train_y.append(y)

    samples = len(train_x)
    if samples < min_samples:
        return ForecastOutput(expected_return=0.0, confidence=0.5, samples=samples, mae=1.0)

    dims = len(train_x[0])
    w = [0.0] * dims
    b = 0.0

    learn_rate = max(0.001, float(lr))
    reg = max(0.0, float(l2))
    rounds = max(1, int(epochs))
    for _ in range(rounds):
        for x, y in zip(train_x, train_y):
            pred = _dot(w, x) + b
            err = pred - y
            for j in range(dims):
                grad = err * x[j] + reg * w[j]
                w[j] -= learn_rate * grad
            b -= learn_rate * err

    abs_err = 0.0
    for x, y in zip(train_x, train_y):
        p = _dot(w, x) + b
        abs_err += abs(p - y)
    mae = abs_err / max(1, samples)

    cur_x = _feature_vector(closes, n - 1)
    pred = _dot(w, cur_x) + b
    pred = max(-max_abs_pred, min(max_abs_pred, pred))

    # Confidence rises when |prediction| is high relative to historical error.
    scale = max(1e-6, mae * 2.0)
    z = max(-20.0, min(20.0, pred / scale))
    conf = 1.0 / (1.0 + exp(-z))

    return ForecastOutput(expected_return=pred, confidence=conf, samples=samples, mae=mae)
