"""Devices router."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import DeviceClaimRequest, DeviceCreate, DeviceResponse
from app.services import auth_service, get_current_user_id
from app.services.device import DeviceService

router = APIRouter()


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    device_svc = DeviceService(session)
    devices = await device_svc.list_devices(user_id)
    return devices


@router.post("", response_model=DeviceResponse)
async def create_device(
    data: DeviceCreate,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    device_svc = DeviceService(session)
    device = await device_svc.create_device(user_id, data.platform, data.fingerprint, data.name)
    return device


@router.post("/claim", response_model=DeviceResponse)
async def claim_device(
    data: DeviceClaimRequest,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    device_svc = DeviceService(session)
    device = await device_svc.claim_device(user_id, data.token)
    if not device:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid claim token")
    return device


@router.delete("/{device_id}")
async def revoke_device(
    device_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    device_svc = DeviceService(session)
    ok = await device_svc.revoke_device(user_id, device_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return {"ok": True}