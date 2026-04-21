"""VPN router."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import ConnectAuthorizeResponse, ProfileResponse, VPNConfigResponse
from app.services import auth_service, get_current_user_id
from app.services.vpn import VPNProvisioner

router = APIRouter()


@router.get("/profiles", response_model=list[ProfileResponse])
async def list_profiles(
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    provisioner = VPNProvisioner(session)
    profiles = await provisioner.list_profiles(user_id)
    return profiles


@router.post("/profiles", response_model=ProfileResponse)
async def create_profile(
    device_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    provisioner = VPNProvisioner(session)
    profile = await provisioner.create_profile(user_id, device_id)
    await provisioner.activate_profile(profile.id)
    return profile


@router.get("/connect/authorize", response_model=ConnectAuthorizeResponse)
async def authorize_connect(
    device_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    provisioner = VPNProvisioner(session)
    result = await provisioner.authorize_connect(user_id, device_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No active profile")
    return result


@router.get("/profiles/{profile_id}/config", response_model=VPNConfigResponse)
async def get_config(
    profile_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    from sqlalchemy import select
    from app.models import VPNProfile
    
    result = await session.execute(
        select(VPNProfile).where(
            VPNProfile.id == profile_id,
            VPNProfile.user_id == user_id,
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    
    provisioner = VPNProvisioner(session)
    node = await provisioner.get_node()
    if not node:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="No nodes available")
    
    client_private_key = "sample_key"
    config = await provisioner.generate_wireguard_config(profile, node, client_private_key)
    
    return VPNConfigResponse(config=config, expires_at=profile.expires_at)


@router.delete("/profiles/{profile_id}")
async def revoke_profile(
    profile_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    session: AsyncSession = Depends(get_session),
):
    provisioner = VPNProvisioner(session)
    ok = await provisioner.revoke_profile(profile_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Profile not found")
    return {"ok": True}