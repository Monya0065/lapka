from __future__ import annotations

import base64
import secrets
import threading
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
import uvicorn


class ModePayload(BaseModel):
    mode: str
    confirm_real: bool = False


class ConfigUpdatePayload(BaseModel):
    values: dict[str, Any]


class PaperCashPayload(BaseModel):
    amount_rub: float


def create_app(controller: Any) -> FastAPI:
    base_dir = Path(__file__).resolve().parent
    templates = Jinja2Templates(directory=str(base_dir / "templates"))

    app = FastAPI(title="tinv_scalper", version="1.0.0")
    app.mount("/static", StaticFiles(directory=str(base_dir / "static")), name="static")

    auth_enabled = bool(getattr(controller.s, "ui_basic_auth_enabled", False))
    auth_user = str(getattr(controller.s, "ui_basic_auth_user", ""))
    auth_password = str(getattr(controller.s, "ui_basic_auth_password", ""))
    auth_realm = 'Basic realm="tinv_scalper"'

    @app.middleware("http")
    async def basic_auth(request: Request, call_next):
        if not auth_enabled:
            return await call_next(request)
        if request.url.path in {"/health", "/ready", "/metrics"}:
            return await call_next(request)
        auth = request.headers.get("Authorization", "")
        ok = False
        if auth.lower().startswith("basic "):
            try:
                decoded = base64.b64decode(auth.split(" ", 1)[1]).decode("utf-8")
                user, pwd = decoded.split(":", 1)
                ok = secrets.compare_digest(user, auth_user) and secrets.compare_digest(pwd, auth_password)
            except Exception:
                ok = False
        if not ok:
            return Response(status_code=401, headers={"WWW-Authenticate": auth_realm}, content="Unauthorized")
        return await call_next(request)

    @app.get("/", response_class=HTMLResponse)
    async def index(request: Request):
        return templates.TemplateResponse("index.html", {"request": request})

    @app.get("/api/status")
    async def status() -> dict[str, Any]:
        return controller.ui_snapshot()

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return controller.health_snapshot()

    @app.get("/ready")
    async def ready() -> dict[str, Any]:
        return controller.ready_snapshot()

    @app.get("/metrics", response_class=PlainTextResponse)
    async def metrics() -> str:
        return controller.metrics_text()

    @app.get("/api/config")
    async def config_get() -> dict[str, Any]:
        return controller.config_snapshot()

    @app.post("/api/config/update")
    async def config_update(payload: ConfigUpdatePayload) -> dict[str, Any]:
        ok, reason = controller.command_config_update(payload.values)
        if not ok:
            raise HTTPException(status_code=400, detail=reason)
        return {"ok": True, "reason": reason}

    @app.post("/api/config/rollback")
    async def config_rollback() -> dict[str, Any]:
        ok, reason = controller.command_config_rollback()
        if not ok:
            raise HTTPException(status_code=400, detail=reason)
        return {"ok": True, "reason": reason}

    @app.post("/api/control/start")
    async def start() -> dict[str, Any]:
        controller.command_start()
        return {"ok": True}

    @app.post("/api/control/stop")
    async def stop() -> dict[str, Any]:
        controller.command_stop()
        return {"ok": True}

    @app.post("/api/control/panic")
    async def panic() -> dict[str, Any]:
        controller.command_panic()
        return {"ok": True}

    @app.post("/api/control/reset_daily")
    async def reset_daily() -> dict[str, Any]:
        controller.command_reset_daily()
        return {"ok": True}

    @app.post("/api/control/reset_killswitch")
    async def reset_killswitch() -> dict[str, Any]:
        ok, reason = controller.command_reset_killswitch()
        if not ok:
            raise HTTPException(status_code=409, detail=reason)
        return {"ok": True, "reason": reason}

    @app.post("/api/control/run_preflight")
    async def run_preflight() -> dict[str, Any]:
        ok, reason, payload = controller.command_run_preflight()
        return {"ok": ok, "reason": reason, "payload": payload}

    @app.post("/api/control/run_go_live_check")
    async def run_go_live_check() -> dict[str, Any]:
        ok, reason, payload = controller.command_run_go_live_check()
        return {"ok": ok, "reason": reason, "payload": payload}

    @app.post("/api/control/paper_cash")
    async def paper_cash(payload: PaperCashPayload) -> dict[str, Any]:
        ok, reason = controller.command_set_paper_cash(payload.amount_rub)
        if not ok:
            raise HTTPException(status_code=409, detail=reason)
        return {"ok": True, "reason": reason}

    @app.post("/api/control/mode")
    async def mode(payload: ModePayload) -> dict[str, Any]:
        mode_value = payload.mode.upper()
        if mode_value not in {"REAL", "DRY_RUN", "PAPER"}:
            raise HTTPException(status_code=400, detail="mode must be REAL, DRY_RUN, or PAPER")
        ok, reason = controller.command_set_mode(mode_value, payload.confirm_real)
        if not ok:
            raise HTTPException(status_code=409, detail=reason)
        return {"ok": True, "mode": mode_value}

    @app.post("/api/control/risk_preset/{preset}")
    async def risk_preset(preset: str) -> dict[str, Any]:
        ok, reason = controller.command_risk_preset(preset)
        if not ok:
            raise HTTPException(status_code=400, detail=reason)
        return {"ok": True, "preset": preset.upper()}

    return app


def start_ui_thread(controller: Any, host: str, port: int):
    app = create_app(controller)

    def runner() -> None:
        config = uvicorn.Config(app=app, host=host, port=port, log_level="warning")
        server = uvicorn.Server(config=config)
        server.run()

    t = threading.Thread(target=runner, name="ui-server", daemon=True)
    t.start()
    return t
