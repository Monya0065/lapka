"""Pydantic schemas."""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserResponse(BaseModel):
    id: str
    email: str
    mfa_enabled: bool
    role: str = "user"
    created_at: datetime

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class DeviceCreate(BaseModel):
    platform: str = Field(..., pattern="^(ios|android|macos|windows)$")
    fingerprint: str
    name: Optional[str] = None


class DeviceResponse(BaseModel):
    id: str
    platform: str
    fingerprint_hash: str
    name: Optional[str]
    status: str
    claimed_at: Optional[datetime]
    revoked_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceClaimRequest(BaseModel):
    token: str


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    plan_id: str
    provider: str
    status: str
    renew_at: Optional[datetime]
    grace_until: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class CheckoutCreateRequest(BaseModel):
    plan_id: str = Field(default="monthly")
    provider: str = Field(default="yookassa", pattern="^(yookassa|cloudpayments|tbank)$")


class CheckoutResponse(BaseModel):
    checkout_id: str
    payment_url: str


class PaymentStatusResponse(BaseModel):
    checkout_id: str
    status: str
    amount: int


class ConnectAuthorizeResponse(BaseModel):
    assertion: str
    node_endpoint: str
    node_public_key: str
    ttl: int = 60


class ProfileResponse(BaseModel):
    id: str
    config_ref: str
    status: str
    expires_at: Optional[datetime]

    class Config:
        from_attributes = True


class VPNConfigResponse(BaseModel):
    config: str
    expires_at: datetime