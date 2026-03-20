from pathlib import Path
from datetime import datetime, timezone
import json
import logging
from time import perf_counter
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
import redis.asyncio as redis
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from src.api.router import api_router
from src.core.config import get_settings
from src.core.metrics import record_request
from src.core.rate_limit import enforce_rate_limit
from src.core.sanitize import sanitize_payload
from src.schemas.common import HealthResponse

settings = get_settings()
app = FastAPI(title=settings.app_name, version="0.1.0")
Path("storage").mkdir(parents=True, exist_ok=True)

if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration

        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.sentry_environment,
            integrations=[FastApiIntegration()],
            traces_sample_rate=0.1,
            send_default_pii=False,
        )
        logger.info("Sentry initialized")
    except ImportError:
        pass
logger = logging.getLogger("lapka.api")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

def _allowed_origins() -> set[str]:
    base = {"http://localhost:3000", "http://127.0.0.1:3000"}
    extra = (settings.cors_origins or "").strip()
    if extra:
        for o in extra.split(","):
            o = o.strip()
            if o and o.startswith("http"):
                base.add(o)
    return base


ALLOWED_WEB_ORIGINS = _allowed_origins()
STATE_CHANGING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
CSRF_EXEMPT_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/refresh",
}


app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_WEB_ORIGINS),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Redis cache client
redis_client = redis.Redis.from_url(settings.redis_url or "redis://localhost:6379/0", decode_responses=True)

# Prometheus metrics
REQUEST_COUNT = Counter('http_requests_total', 'Total HTTP requests', ['method', 'endpoint', 'status'])
REQUEST_LATENCY = Histogram('http_request_duration_seconds', 'HTTP request latency', ['method', 'endpoint'])

@app.middleware("http")
async def cache_middleware(request: Request, call_next):
    """Cache GET requests for 5 minutes"""
    start_time = perf_counter()
    
    if request.method == "GET" and not request.url.path.startswith("/api/v1/auth"):
        cache_key = f"cache:{request.url.path}?{request.url.query}"
        
        # Try to get from cache
        cached_response = await redis_client.get(cache_key)
        if cached_response:
            REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status="200").inc()
            REQUEST_LATENCY.labels(method=request.method, endpoint=request.url.path).observe(perf_counter() - start_time)
            return JSONResponse(content=json.loads(cached_response), headers={"X-Cache": "HIT"})
        
        # Get response
        response = await call_next(request)
        
        # Cache successful GET responses
        if response.status_code == 200 and hasattr(response, 'body'):
            try:
                content = json.loads(response.body.decode())
                await redis_client.setex(cache_key, 300, json.dumps(content))  # 5 minutes
                response.headers["X-Cache"] = "MISS"
            except:
                pass  # Skip caching if not JSON
        
        REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status=str(response.status_code)).inc()
        REQUEST_LATENCY.labels(method=request.method, endpoint=request.url.path).observe(perf_counter() - start_time)
        return response
    
    # For non-cached requests
    response = await call_next(request)
    REQUEST_COUNT.labels(method=request.method, endpoint=request.url.path, status=str(response.status_code)).inc()
    REQUEST_LATENCY.labels(method=request.method, endpoint=request.url.path).observe(perf_counter() - start_time)
    return response

app.include_router(api_router)
app.mount("/storage", StaticFiles(directory="storage"), name="storage")


def _extract_origin(value: str | None) -> str | None:
    if not value:
        return None
    if value.startswith("http://") or value.startswith("https://"):
        parsed = urlparse(value)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}"
    return None


def _enforce_public_rate_limits(request: Request) -> None:
    path = request.url.path
    if path.startswith("/api/v1/public/"):
        enforce_rate_limit(request, scope="global.public", limit=180, window_sec=60)
    elif path.startswith("/api/v1/market/"):
        enforce_rate_limit(request, scope="global.market", limit=200, window_sec=60)
    elif path.startswith("/api/v1/lost-pets"):
        enforce_rate_limit(request, scope="global.lost_pets", limit=120, window_sec=60)


def _enforce_csrf(request: Request) -> None:
    if request.method not in STATE_CHANGING_METHODS:
        return

    path = request.url.path
    if not path.startswith("/api/v1/"):
        return
    if path.startswith("/api/v1/public/") or path in CSRF_EXEMPT_PATHS:
        return

    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        return

    origin = _extract_origin(request.headers.get("origin"))
    referer_origin = _extract_origin(request.headers.get("referer"))
    observed_origin = origin or referer_origin

    # Browser requests must originate from trusted frontend origins.
    if observed_origin and observed_origin not in ALLOWED_WEB_ORIGINS:
        raise HTTPException(
            status_code=403,
            detail={"code": "CSRF_FORBIDDEN_ORIGIN", "message": "Request origin is not allowed"},
        )

    # Require explicit anti-CSRF token for authenticated browser mutations.
    if observed_origin:
        csrf_token = (request.headers.get("x-csrf-token") or "").strip()
        if len(csrf_token) < 16:
            raise HTTPException(
                status_code=403,
                detail={"code": "CSRF_TOKEN_MISSING", "message": "CSRF token is required"},
            )


async def _sanitize_json_input(request: Request) -> None:
    if request.method not in STATE_CHANGING_METHODS:
        return

    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" not in content_type:
        return

    raw_body = await request.body()
    if not raw_body:
        return

    try:
        parsed = json.loads(raw_body)
    except json.JSONDecodeError:
        return

    sanitized = sanitize_payload(parsed)
    if sanitized == parsed:
        return

    new_body = json.dumps(sanitized, ensure_ascii=False).encode("utf-8")

    async def receive():
        return {"type": "http.request", "body": new_body, "more_body": False}

    request._receive = receive  # type: ignore[attr-defined]


def _apply_security_headers(path: str, response: Response) -> None:
    if not (path.startswith("/api/") or path == "/health"):
        return
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    )


@app.middleware("http")
async def observability_middleware(request, call_next):
    start = perf_counter()
    status_code = 500
    response = None
    try:
        _enforce_public_rate_limits(request)
        _enforce_csrf(request)
        await _sanitize_json_input(request)

        response = await call_next(request)
        status_code = response.status_code

        _apply_security_headers(request.url.path, response)

        return response
    except HTTPException as exc:
        status_code = exc.status_code
        response = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        _apply_security_headers(request.url.path, response)
        return response
    except Exception as exc:
        logger.exception(
            "unhandled_error",
            extra={"path": request.url.path, "method": request.method, "error": str(exc)},
        )
        raise
    finally:
        duration_ms = (perf_counter() - start) * 1000
        record_request(request.method, request.url.path, status_code, duration_ms)
        if response is not None:
            response.headers["X-Process-Time-Ms"] = f"{duration_ms:.2f}"
        logger.info(
            json.dumps(
                {
                    "event": "request.completed",
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": status_code,
                    "duration_ms": round(duration_ms, 2),
                },
                ensure_ascii=False,
            )
        )


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", service=settings.app_name, timestamp=datetime.now(timezone.utc))


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
