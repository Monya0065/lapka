from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any


@dataclass(slots=True)
class RuntimeMetrics:
    total_entries: int = 0
    total_exits: int = 0
    total_rejects: int = 0
    total_killswitch: int = 0
    total_api_retries: int = 0

    fill_requested_lots: int = 0
    fill_executed_lots: int = 0

    rolling_slippage_pct_sum: float = 0.0
    rolling_slippage_samples: int = 0


class MetricsRegistry:
    def __init__(self):
        self._lock = RLock()
        self._m = RuntimeMetrics()

    def inc(self, field_name: str, value: int = 1) -> None:
        with self._lock:
            current = getattr(self._m, field_name)
            setattr(self._m, field_name, current + value)

    def add_fill(self, requested: int, executed: int) -> None:
        with self._lock:
            self._m.fill_requested_lots += max(0, int(requested))
            self._m.fill_executed_lots += max(0, int(executed))

    def add_slippage_sample(self, slippage_pct: float) -> None:
        with self._lock:
            self._m.rolling_slippage_pct_sum += float(slippage_pct)
            self._m.rolling_slippage_samples += 1

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            fill_ratio = (
                self._m.fill_executed_lots / self._m.fill_requested_lots
                if self._m.fill_requested_lots > 0
                else 0.0
            )
            avg_slippage = (
                self._m.rolling_slippage_pct_sum / self._m.rolling_slippage_samples
                if self._m.rolling_slippage_samples > 0
                else 0.0
            )
            return {
                "total_entries": self._m.total_entries,
                "total_exits": self._m.total_exits,
                "total_rejects": self._m.total_rejects,
                "total_killswitch": self._m.total_killswitch,
                "total_api_retries": self._m.total_api_retries,
                "fill_ratio": fill_ratio,
                "avg_slippage_pct": avg_slippage,
            }

    def as_prometheus(self) -> str:
        s = self.snapshot()
        return "\n".join(
            [
                "# TYPE tinv_total_entries counter",
                f"tinv_total_entries {s['total_entries']}",
                "# TYPE tinv_total_exits counter",
                f"tinv_total_exits {s['total_exits']}",
                "# TYPE tinv_total_rejects counter",
                f"tinv_total_rejects {s['total_rejects']}",
                "# TYPE tinv_total_killswitch counter",
                f"tinv_total_killswitch {s['total_killswitch']}",
                "# TYPE tinv_total_api_retries counter",
                f"tinv_total_api_retries {s['total_api_retries']}",
                "# TYPE tinv_fill_ratio gauge",
                f"tinv_fill_ratio {s['fill_ratio']}",
                "# TYPE tinv_avg_slippage_pct gauge",
                f"tinv_avg_slippage_pct {s['avg_slippage_pct']}",
            ]
        ) + "\n"
