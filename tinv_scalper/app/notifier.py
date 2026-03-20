from __future__ import annotations

import subprocess


class DesktopNotifier:
    def __init__(self, enabled: bool):
        self.enabled = enabled

    def notify(self, title: str, message: str, subtitle: str = "") -> None:
        if not self.enabled:
            return
        t = title.replace('"', "'")
        m = message.replace('"', "'")
        s = subtitle.replace('"', "'")
        script = f'display notification "{m}" with title "{t}" subtitle "{s}"'
        try:
            subprocess.run(["osascript", "-e", script], check=False, timeout=3)
        except Exception:
            # Notifications are best-effort and must not break trading loop.
            pass
