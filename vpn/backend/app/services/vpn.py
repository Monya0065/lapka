"""VPN Provisioner Service."""
import base64
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import VPNNode, VPNProfile


PROFILE_TTL_DAYS = 90


class VPNProvisioner:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_profile(self, user_id: uuid.UUID, device_id: uuid.UUID) -> Optional[VPNProfile]:
        result = await self.session.execute(
            select(VPNProfile).where(
                VPNProfile.user_id == user_id,
                VPNProfile.device_id == device_id,
                VPNProfile.status == "active",
            )
        )
        return result.scalar_one_or_none()

    async def list_profiles(self, user_id: uuid.UUID) -> list[VPNProfile]:
        result = await self.session.execute(
            select(VPNProfile).where(VPNProfile.user_id == user_id)
        )
        return list(result.scalars().all())

    async def create_profile(self, user_id: uuid.UUID, device_id: uuid.UUID) -> VPNProfile:
        public_key = secrets.token_urlsafe(32)
        config_ref = f"config_{uuid.uuid4().hex[:16]}"
        
        profile = VPNProfile(
            user_id=user_id,
            device_id=device_id,
            public_key=public_key,
            config_ref=config_ref,
            status="ready",
            expires_at=datetime.utcnow() + timedelta(days=PROFILE_TTL_DAYS),
        )
        self.session.add(profile)
        await self.session.commit()
        await self.session.refresh(profile)
        return profile

    async def activate_profile(self, profile_id: uuid.UUID) -> Optional[VPNProfile]:
        result = await self.session.execute(
            select(VPNProfile).where(VPNProfile.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            profile.status = "active"
            await self.session.commit()
            await self.session.refresh(profile)
        return profile

    async def revoke_profile(self, profile_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(VPNProfile).where(VPNProfile.id == profile_id)
        )
        profile = result.scalar_one_or_none()
        if profile:
            profile.status = "revoked"
            await self.session.commit()
            return True
        return False

    async def get_node(self, region: Optional[str] = None) -> Optional[VPNNode]:
        query = select(VPNNode).where(VPNNode.status == "active")
        if region:
            query = query.where(VPNNode.region == region)
        query = query.order_by(VPNNode.health_score.desc()).limit(1)
        
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def list_nodes(self, region: Optional[str] = None) -> list[VPNNode]:
        query = select(VPNNode).where(VPNNode.status == "active")
        if region:
            query = query.where(VPNNode.region == region)
        
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def generate_wireguard_config(
        self, profile: VPNProfile, node: VPNNode, client_private_key: str
    ) -> str:
        config = f"""[Interface]
PrivateKey = {client_private_key}
Address = 10.0.0.2/32
DNS = 1.1.1.1

[Peer]
PublicKey = {node.public_key}
Endpoint = {node.endpoint}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
"""
        return config

    async def authorize_connect(
        self, user_id: uuid.UUID, device_id: uuid.UUID
    ) -> Optional[dict]:
        profile = await self.get_profile(user_id, device_id)
        if not profile or profile.status != "active":
            return None
            
        node = await self.get_node()
        if not node:
            return None
            
        assertion = secrets.token_urlsafe(32)
        
        return {
            "assertion": assertion,
            "node_endpoint": node.endpoint,
            "node_public_key": node.public_key,
            "ttl": 60,
        }