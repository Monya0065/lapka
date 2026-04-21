"""API Versioning."""
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse
from packaging import version


router = APIRouter()


API_VERSIONS = {
    "v1": {
        "version": "1.0.0",
        "deprecated": False,
        "sunset_date": None,
    },
    "v2": {
        "version": "2.0.0",
        "deprecated": False,
        "sunset_date": None,
    },
}


@router.get("/version")
async def get_api_version():
    """Get current API version."""
    return {
        "current": "v1",
        "supported": list(API_VERSIONS.keys()),
        "versions": API_VERSIONS,
    }


@router.get("/v1/health")
async def v1_health():
    """V1 health check."""
    return {"status": "ok", "version": "v1", "api_version": "1.0.0"}


@router.get("/v2/health")
async def v2_health():
    """V2 health check."""
    return {"status": "ok", "version": "v2", "api_version": "2.0.0"}


class VersioningMiddleware:
    def __init__(self, app):
        self.app = app
    
    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        
        path = scope.get("path", "")
        
        if path.startswith("/api/v"):
            await self.app(scope, receive, send)
            return
        
        request_id = scope.get("headers", []).get(b"x-request-id")
        
        scope["path"] = f"/api/v1{path}"
        
        await self.app(scope, receive, send)


def check_version_deprecation(api_version: str) -> dict:
    """Check if version is deprecated."""
    if api_version not in API_VERSIONS:
        return {
            "deprecated": True,
            "message": f"API version {api_version} not found",
        }
    
    info = API_VERSIONS[api_version]
    
    if info.get("deprecated"):
        return {
            "deprecated": True,
            "message": f"API version {api_version} deprecated",
            "sunset_date": info.get("sunset_date"),
        }
    
    return {"deprecated": False}