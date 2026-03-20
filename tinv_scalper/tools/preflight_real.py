from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


def main() -> int:
    load_dotenv()
    out_file = Path(os.getenv("PREFLIGHT_REPORT_FILE", "logs/preflight_real.json"))
    out_file.parent.mkdir(parents=True, exist_ok=True)

    payload: dict[str, object] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "status": "fail",
        "checks": [],
    }

    def add_check(name: str, ok: bool, detail: str = "") -> None:
        payload["checks"].append({"name": name, "ok": ok, "detail": detail})  # type: ignore[index]

    token = os.getenv("TINV_TOKEN", "")
    account = os.getenv("TINV_ACCOUNT_ID", "")
    allow_real = os.getenv("ALLOW_REAL", "false").strip().lower() in {"1", "true", "yes", "on"}
    add_check("token_present", bool(token), "TINV_TOKEN must be set (or keychain via app config)")
    add_check("account_present", bool(account), "TINV_ACCOUNT_ID must be set")
    add_check("allow_real", allow_real, "ALLOW_REAL should be true")

    try:
        from app.config import load_settings
        from app.tbank_client import TBankClient
    except Exception as exc:
        add_check("imports", False, str(exc))
        out_file.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
        print(json.dumps(payload, ensure_ascii=True))
        return 1

    try:
        s = load_settings()
        add_check("settings_load", True, "ok")
    except Exception as exc:
        add_check("settings_load", False, str(exc))
        out_file.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
        print(json.dumps(payload, ensure_ascii=True))
        return 1

    client = None
    try:
        client = TBankClient(
            token=s.token,
            account_id=s.account_id,
            max_retry_errors=2,
            logger=type("L", (), {"warning": lambda *a, **k: None})(),
        )
        p = client.get_portfolio()
        pos = client.get_positions()
        add_check("api_portfolio", p.equity_rub >= 0, f"equity_rub={p.equity_rub}")
        add_check("api_positions", True, f"positions={len(pos)}")
    except Exception as exc:
        add_check("api_connectivity", False, str(exc))
    finally:
        if client is not None:
            try:
                client.close()
            except Exception:
                pass

    checks = payload["checks"]  # type: ignore[assignment]
    ok = all(bool(x.get("ok")) for x in checks)  # type: ignore[union-attr]
    payload["status"] = "ok" if ok else "fail"

    out_file.write_text(json.dumps(payload, ensure_ascii=True, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=True))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
