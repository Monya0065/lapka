from __future__ import annotations

import json
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv


def _check_report_ok(path: Path, max_age_sec: int) -> tuple[bool, str]:
    if not path.exists():
        return False, "report_missing"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False, "report_invalid_json"
    if str(data.get("status", "")).lower() != "ok":
        return False, "report_status_not_ok"
    ts = str(data.get("ts", ""))
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception:
        return False, "report_ts_invalid"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - dt.astimezone(timezone.utc)).total_seconds()
    if age > max_age_sec:
        return False, "report_too_old"
    return True, f"ok age_sec={int(age)}"


def _check_writable_dir(path: Path) -> tuple[bool, str]:
    try:
        path.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(prefix="tinv_chk_", dir=path, delete=True):
            pass
        return True, "ok"
    except Exception as exc:
        return False, str(exc)


def main() -> int:
    load_dotenv()

    payload: dict[str, object] = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "status": "fail",
        "checks": [],
    }

    def add_check(name: str, ok: bool, detail: str = "") -> None:
        payload["checks"].append({"name": name, "ok": ok, "detail": detail})  # type: ignore[index]

    try:
        from app.config import load_settings
        from app.tbank_client import TBankClient
    except Exception as exc:
        add_check("imports", False, str(exc))
        print(json.dumps(payload, ensure_ascii=True))
        return 1

    try:
        s = load_settings()
        add_check("settings_load", True, "ok")
    except Exception as exc:
        add_check("settings_load", False, str(exc))
        print(json.dumps(payload, ensure_ascii=True))
        return 1

    out_file = Path(s.go_live_report_file)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    add_check("allow_real", bool(s.allow_real), "ALLOW_REAL must be true")
    add_check("token_present", bool(s.token), "TINV_TOKEN or keychain token")
    add_check("account_present", bool(s.account_id), "TINV_ACCOUNT_ID")

    pf_ok, pf_detail = _check_report_ok(Path(s.preflight_report_file), int(s.preflight_max_age_sec))
    add_check("preflight_report", pf_ok, pf_detail)

    runtime_path = Path(s.runtime_config_file)
    if runtime_path.exists():
        try:
            json.loads(runtime_path.read_text(encoding="utf-8"))
            add_check("runtime_config_json", True, "ok")
        except Exception as exc:
            add_check("runtime_config_json", False, str(exc))
    else:
        add_check("runtime_config_json", True, "file_missing_allowed")

    state_path = Path(s.state_file)
    if state_path.exists():
        try:
            st = json.loads(state_path.read_text(encoding="utf-8"))
            if bool(st.get("killswitched", False)):
                add_check("state_killswitch", False, "state.killswitched=true")
            else:
                add_check("state_killswitch", True, "ok")
        except Exception as exc:
            add_check("state_killswitch", False, f"state_parse_failed: {exc}")
    else:
        add_check("state_killswitch", True, "state_missing_allowed")

    free_mb = shutil.disk_usage(Path(".")).free / (1024.0 * 1024.0)
    add_check(
        "disk_free_mb",
        free_mb >= float(s.disk_guard_min_free_mb),
        f"free_mb={free_mb:.1f} threshold={s.disk_guard_min_free_mb}",
    )

    logs_ok, logs_detail = _check_writable_dir(Path(s.log_file).parent)
    add_check("logs_writable", logs_ok, logs_detail)
    bkp_ok, bkp_detail = _check_writable_dir(Path(s.backup_dir))
    add_check("backup_writable", bkp_ok, bkp_detail)

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
        add_check("api_portfolio", p.equity_rub >= 0, f"equity_rub={p.equity_rub:.2f}")
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

