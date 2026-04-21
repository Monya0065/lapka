"""Request ID tracing middleware."""
import uuid
import time
from contextvars import ContextVar
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


request_id_context: ContextVar[str] = ContextVar("request_id", default="")


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID")
        
        if not request_id:
            request_id = str(uuid.uuid4())
        
        request_id_context.set(request_id)
        
        request.state.request_id = request_id
        request.state.start_time = time.time()
        
        response = await call_next(request)
        
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Response-Time"] = str(int((time.time() - request.state.start_time) * 1000))
        
        return response


def get_request_id() -> str:
    """Get current request ID."""
    return request_id_context.get()


def get_trace_context() -> dict:
    """Get trace context for logging."""
    return {
        "request_id": get_request_id(),
        "timestamp": time.time(),
    }