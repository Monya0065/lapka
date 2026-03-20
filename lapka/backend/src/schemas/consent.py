from datetime import datetime

from pydantic import BaseModel

from src.models import ConsentScope


class ConsentCreateRequest(BaseModel):
    pet_id: str
    clinic_id: str
    scope_level: ConsentScope
    expires_at: datetime | None = None


class ConsentPatchRequest(BaseModel):
    scope_level: ConsentScope | None = None
    expires_at: datetime | None = None


class ConsentOut(BaseModel):
    id: str
    pet_id: str
    owner_user_id: str
    clinic_id: str
    scope_level: ConsentScope
    issued_at: datetime
    expires_at: datetime | None
    revoked_at: datetime | None

    model_config = {"from_attributes": True}
