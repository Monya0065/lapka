from app.api.routers.auth import router as auth_router
from app.api.routers.billing import router as billing_router
from app.api.routers.devices import router as devices_router
from app.api.routers.vpn import router as vpn_router
from app.api.routers.health import router as health_router

__all__ = ["auth_router", "billing_router", "devices_router", "vpn_router", "health_router"]