from __future__ import annotations

import json
from pathlib import Path


def main() -> None:
    state_path = Path("state.json")
    if not state_path.exists():
        print("state.json not found")
        return

    data = json.loads(state_path.read_text(encoding="utf-8"))
    pos = data.get("position", {})

    print("Bot status:")
    print(f"  mode: {data.get('mode')}")
    print(f"  trading_enabled: {data.get('trading_enabled')}")
    print(f"  close_only_mode: {data.get('close_only_mode')}")
    print(f"  killswitched: {data.get('killswitched')}")
    print(f"  emergency_flatten: {data.get('emergency_flatten')}")
    print(f"  daily_realized_pnl_rub: {data.get('daily_realized_pnl_rub')}")
    print(f"  daily_peak_pnl_rub: {data.get('daily_peak_pnl_rub')}")
    print(f"  daily_slippage_pct_sum: {data.get('daily_slippage_pct_sum')}")
    print(f"  trades_today: {data.get('trades_today')}")
    print("Position:")
    print(f"  figi: {pos.get('figi')}")
    print(f"  ticker: {pos.get('ticker')}")
    print(f"  lots: {pos.get('lots')}")
    print(f"  avg_price: {pos.get('avg_price')}")
    print(f"  opened_at: {pos.get('opened_at')}")


if __name__ == "__main__":
    main()
