from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from threading import Lock
from time import time


@dataclass
class MetricsState:
    started_at: float = field(default_factory=time)
    total_requests: int = 0
    total_errors: int = 0
    status_counts: dict[str, int] = field(default_factory=dict)
    route_counts: dict[str, int] = field(default_factory=dict)
    recent_durations_ms: deque[float] = field(default_factory=lambda: deque(maxlen=500))


_state = MetricsState()
_lock = Lock()


def record_request(method: str, path: str, status_code: int, duration_ms: float) -> None:
    status_key = str(status_code)
    route_key = f"{method.upper()} {path}"
    with _lock:
        _state.total_requests += 1
        if status_code >= 400:
            _state.total_errors += 1
        _state.status_counts[status_key] = _state.status_counts.get(status_key, 0) + 1
        _state.route_counts[route_key] = _state.route_counts.get(route_key, 0) + 1
        _state.recent_durations_ms.append(float(duration_ms))


def get_metrics_snapshot() -> dict:
    with _lock:
        durations = list(_state.recent_durations_ms)
        avg_duration = sum(durations) / len(durations) if durations else 0.0
        p95_duration = 0.0
        if durations:
            sorted_durations = sorted(durations)
            idx = min(len(sorted_durations) - 1, int(round(0.95 * (len(sorted_durations) - 1))))
            p95_duration = sorted_durations[idx]

        top_routes = sorted(
            _state.route_counts.items(),
            key=lambda item: item[1],
            reverse=True,
        )[:20]

        return {
            "uptime_sec": round(time() - _state.started_at, 2),
            "total_requests": _state.total_requests,
            "total_errors": _state.total_errors,
            "status_counts": dict(_state.status_counts),
            "avg_duration_ms": round(avg_duration, 2),
            "p95_duration_ms": round(p95_duration, 2),
            "top_routes": [{"route": route, "count": count} for route, count in top_routes],
        }

