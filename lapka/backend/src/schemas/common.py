from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: datetime
