from __future__ import annotations

from datetime import datetime, timedelta


def trading_session_allowed(now: datetime, start_hhmm, end_hhmm) -> bool:
    # MOEX stock market regular session: weekdays only.
    if now.weekday() >= 5:
        return False
    current = now.timetz().replace(tzinfo=None)
    return start_hhmm <= current <= end_hhmm


def in_no_trade_window(
    now: datetime,
    start_hhmm,
    end_hhmm,
    no_trade_minutes_after_open: int,
    no_trade_minutes_before_close: int,
) -> bool:
    base = now.replace(second=0, microsecond=0)
    open_ts = base.replace(hour=start_hhmm.hour, minute=start_hhmm.minute)
    close_ts = base.replace(hour=end_hhmm.hour, minute=end_hhmm.minute)

    if now < open_ts or now > close_ts:
        return True

    if now <= open_ts + timedelta(minutes=max(0, no_trade_minutes_after_open)):
        return True

    if now >= close_ts - timedelta(minutes=max(0, no_trade_minutes_before_close)):
        return True

    return False
