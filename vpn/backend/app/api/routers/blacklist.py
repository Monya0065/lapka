"""Blacklist router."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.services.blacklist import blacklist_service

router = APIRouter()


class BlockIPRequest(BaseModel):
    ip: str
    reason: str = ""
    duration: int = 86400


class BlockResponse(BaseModel):
    blocked: bool
    ip: str


@router.post("/block")
async def block_ip(
    data: BlockIPRequest,
    admin_id: uuid.UUID,
):
    """Block IP (admin only)."""
    await blacklist_service.block_ip(data.ip, data.duration, data.reason)
    return BlockResponse(blocked=True, ip=data.ip)


@router.post("/unblock")
async def unblock_ip(
    ip: str = Query(...),
    admin_id: uuid.UUID,
):
    """Unblock IP (admin only)."""
    await blacklist_service.unblock_ip(ip)
    return {"unblocked": True, "ip": ip}


@router.get("/check")
async def check_ip(
    ip: str = Query(...),
):
    """Check if IP is blocked."""
    is_blocked = await blacklist_service.is_blacklisted(ip)
    info = await blacklist_service.get_block_info(ip) if is_blocked else None
    
    return {
        "blocked": is_blocked,
        "info": info,
    }


@router.get("/list")
async def list_blocked():
    """List all blocked IPs (admin only)."""
    blocked = await blacklist_service.get_all_blocked()
    return {"items": blocked, "total": len(blocked)}