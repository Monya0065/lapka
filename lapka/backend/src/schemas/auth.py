from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from src.models import RoleEnum


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)
    phone: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str
    clinic_id: UUID | None = None  # optional clinic context for vets/clinic_admins


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class SelectClinicRequest(BaseModel):
    clinic_id: UUID


class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    phone: str | None
    role: RoleEnum
    clinic_id: UUID | None = None  # current clinic context, if any
    created_at: datetime

    model_config = {"from_attributes": True}
