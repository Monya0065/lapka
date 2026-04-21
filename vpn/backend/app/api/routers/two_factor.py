"""2FA router."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.database import get_session
from app.services import auth_service
from app.services.two_factor import two_factor_service

router = APIRouter()


class TwoFactorSetupResponse(BaseModel):
    secret: str
    qr_uri: str


class TwoFactorVerifyRequest(BaseModel):
    code: str


class TwoFactorVerifyResponse(BaseModel):
    backup_codes: list[str]


class Enable2FAResponse(BaseModel):
    enabled: bool
    backup_codes: list[str]


@router.get("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(user_id: uuid.UUID = Depends(auth_service.get_current_user_id)):
    secret = await two_factor_service.generate_secret(str(user_id))
    qr_uri = await two_factor_service.get_provisioning_uri(str(user_id), f"user_{user_id}")
    return TwoFactorSetupResponse(secret=secret, qr_uri=qr_uri)


@router.post("/2fa/verify", response_model=TwoFactorVerifyResponse)
async def verify_2fa(
    data: TwoFactorVerifyRequest,
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    valid = await two_factor_service.verify_code(str(user_id), data.code)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid code")

    backup_codes = await two_factor_service.generate_backup_codes(str(user_id))
    return TwoFactorVerifyResponse(backup_codes=backup_codes)


@router.post("/2fa/enable", response_model=Enable2FAResponse)
async def enable_2fa(user_id: uuid.UUID = Depends(auth_service.get_current_user_id)):
    await two_factor_service.enable(str(user_id))
    backup_codes = await two_factor_service.generate_recovery_codes(str(user_id))
    return Enable2FAResponse(enabled=True, backup_codes=backup_codes)


@router.post("/2fa/disable")
async def disable_2fa(
    code: str = Query(...),
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    is_enabled = await two_factor_service.is_enabled(str(user_id))
    if not is_enabled:
        return {"disabled": False}

    if not await two_factor_service.verify_code(str(user_id), code):
        raise HTTPException(status_code=400, detail="Invalid code")

    await two_factor_service.disable(str(user_id))
    return {"disabled": True}


@router.get("/2fa/status")
async def get_2fa_status(user_id: uuid.UUID = Depends(auth_service.get_current_user_id)):
    is_enabled = await two_factor_service.is_enabled(str(user_id))
    return {"enabled": is_enabled}


@router.post("/2fa/recovery")
async def use_recovery_code(
    code: str = Query(...),
    user_id: uuid.UUID = Depends(auth_service.get_current_user_id),
):
    valid = await two_factor_service.verify_recovery_code(str(user_id), code)
    if not valid:
        raise HTTPException(status_code=400, detail="Invalid recovery code")
    return {"success": True}