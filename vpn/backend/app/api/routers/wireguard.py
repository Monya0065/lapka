"""WireGuard configuration generator."""
import base64
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import text

from app.database import get_session

router = APIRouter()


def generate_wireguard_keys():
    """Generate WireGuard key pair."""
    private_key = base64.b64encode(secrets.token_bytes(32)).decode()
    public_key = base64.b64encode(secrets.token_bytes(32)).decode()
    return private_key, public_key


def generate_wireguard_config(
    private_key: str,
    node_ip: str,
    node_public_key: str,
    allowed_ips: str = "0.0.0.0/0, ::/0",
) -> str:
    """Generate WireGuard config file."""
    return f"""[Interface]
PrivateKey = {private_key}
Address = 10.0.0.2/32
DNS = 1.1.1.1, 8.8.8.8

[Peer]
PublicKey = {node_public_key}
Endpoint = {node_ip}:51820
AllowedIPs = {allowed_ips}
PersistentKeepalive = 25
"""


@router.post("/profiles/generate")
async def generate_profile(
    device_id: str = Query(...),
    user_id: str = Query(...),
):
    """Generate WireGuard profile for device."""
    session = await get_session()
    
    result = await session.execute(
        text("""
            SELECT * FROM devices WHERE id = :device_id AND user_id = :user_id
        """),
        {"device_id": device_id, "user_id": user_id}
    )
    device = result.fetchone()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    
    result = await session.execute(
        text("""
            SELECT * FROM vpn_nodes WHERE status = 'active' ORDER BY health_score DESC LIMIT 1
        """),
    )
    node = result.fetchone()
    if not node:
        raise HTTPException(status_code=503, detail="No nodes available")
    
    private_key, public_key = generate_wireguard_keys()
    profile_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=90)
    
    await session.execute(
        text("""
            INSERT INTO vpn_profiles (id, user_id, device_id, node_id, public_key, config_ref, status, expires_at)
            VALUES (:id, :user_id, :device_id, :node_id, :public_key, :config_ref, 'active', :expires_at)
        """),
        {
            "id": profile_id,
            "user_id": user_id,
            "device_id": device_id,
            "node_id": str(node.id),
            "public_key": public_key,
            "config_ref": f"wg_{profile_id[:8]}",
            "expires_at": expires_at,
        }
    )
    await session.commit()
    
    config = generate_wireguard_config(
        private_key=private_key,
        node_ip=node.endpoint.split(":")[0],
        node_public_key=node.public_key,
    )
    
    return {
        "profile_id": profile_id,
        "config": config,
        "expires_at": expires_at.isoformat(),
        "node": {
            "region": node.region,
            "endpoint": node.endpoint,
        },
    }


@router.get("/profiles/{profile_id}/config")
async def get_profile_config(
    profile_id: str,
    user_id: str = Query(...),
):
    """Get WireGuard config for profile."""
    session = await get_session()
    
    result = await session.execute(
        text("""
            SELECT p.*, n.endpoint, n.public_key as node_public_key
            FROM vpn_profiles p
            LEFT JOIN vpn_nodes n ON p.node_id = n.id
            WHERE p.id = :profile_id AND p.user_id = :user_id AND p.status = 'active'
        """),
        {"profile_id": profile_id, "user_id": user_id}
    )
    profile = result.fetchone()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    
    private_key, public_key = generate_wireguard_keys()
    
    config = generate_wireguard_config(
        private_key=private_key,
        node_ip=profile.endpoint.split(":")[0],
        node_public_key=profile.node_public_key,
    )
    
    return {
        "config": config,
        "expires_at": profile.expires_at.isoformat() if profile.expires_at else None,
    }


@router.post("/connect/authorize")
async def authorize_connect(
    device_id: str = Query(...),
    user_id: str = Query(...),
):
    """Authorize VPN connection and return session token."""
    session = await get_session()
    
    result = await session.execute(
        text("""
            SELECT p.* FROM vpn_profiles p
            WHERE p.device_id = :device_id AND p.user_id = :user_id AND p.status = 'active'
        """),
        {"device_id": device_id, "user_id": user_id}
    )
    profile = result.fetchone()
    if not profile:
        raise HTTPException(status_code=403, detail="No active profile")
    
    node_result = await session.execute(
        text("SELECT * FROM vpn_nodes WHERE id = :node_id"),
        {"node_id": str(profile.node_id)}
    )
    node = node_result.fetchone()
    
    assertion = secrets.token_urlsafe(32)
    
    return {
        "assertion": assertion,
        "node_endpoint": node.endpoint if node else None,
        "node_public_key": node.public_key if node else None,
        "ttl": 60,
    }