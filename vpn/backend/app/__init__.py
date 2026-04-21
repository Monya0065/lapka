"""VPN Backend Application."""
import os
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.api.routers import auth_router, billing_router, devices_router, vpn_router, health_router
from app.api.routers.telegram import router as telegram_router
from app.api.routers.vpn_admin import router as vpn_admin_router
from app.api.routers.admin import router as admin_router
from app.api.routers.wireguard import router as wireguard_router
from app.api.routers.two_factor import router as two_factor_router
from app.api.routers.social_auth import router as social_auth_router
from app.api.routers.push import router as push_router
from app.api.routers.upload import router as upload_router
from app.api.routers.blacklist import router as blacklist_router
from app.api.routers.websocket import router as websocket_router
from app.api.routers.v1 import router as version_router
from app.database import create_engine, create_pool
from app.services.logging import logger
from app.middleware import SecurityHeadersMiddleware
from app.middleware_trace import RequestIDMiddleware


limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_pool()
    logger.info("Application started")
    yield
    await create_engine().dispose()
    logger.info("Application shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Lapka VPN API",
        version="1.0.0",
        lifespan=lifespan,
    )
    
    app.state.limiter = limiter
    
    @app.middleware("http")
    async def logging_middleware(request: Request, call_next):
        start_time = time.time()
        
        response = await call_next(request)
        
        duration = (time.time() - start_time) * 1000
        path = request.url.path
        status = response.status_code
        
        logger.log_request(
            method=request.method,
            path=path,
            status_code=status,
            duration_ms=duration,
        )
        
        return response
    
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        logger.warning(f"Rate limit exceeded: {request.client.host}")
        raise HTTPException(
            status_code=429,
            detail="Слишком много запросов. Попробуйте позже."
        )
    
    app.add_middleware(SecurityHeadersMiddleware)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["https://lapka.ru", "https://www.lapka.ru"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
    app.include_router(billing_router, prefix="/api/billing", tags=["billing"])
    app.include_router(devices_router, prefix="/api/devices", tags=["devices"])
    app.include_router(vpn_router, prefix="/api/vpn", tags=["vpn"])
    app.include_router(health_router, tags=["health"])
    app.include_router(telegram_router, prefix="/api/telegram", tags=["telegram"])
    app.include_router(vpn_admin_router, prefix="/api/admin/vpn", tags=["vpn_admin"])
    app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
    app.include_router(wireguard_router, prefix="/api/vpn", tags=["wireguard"])
    app.include_router(two_factor_router, prefix="/api/auth", tags=["2fa"])
    app.include_router(social_auth_router, prefix="/api/auth/oauth", tags=["oauth"])
    app.include_router(push_router, prefix="/api/push", tags=["push"])
    app.include_router(upload_router, prefix="/api/upload", tags=["upload"])
    app.include_router(blacklist_router, prefix="/api/admin/blacklist", tags=["blacklist"])
    app.include_router(websocket_router, prefix="/api", tags=["websocket"])
    app.include_router(version_router, prefix="/api", tags=["version"])
    
    app.add_middleware(RequestIDMiddleware)
    
    return app


app = create_app()