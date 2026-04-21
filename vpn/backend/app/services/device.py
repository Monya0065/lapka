"""Device Service."""
import hashlib
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Device, DeviceClaimToken


MAX_DEVICES = 5


class DeviceService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_devices(self, user_id: uuid.UUID) -> list[Device]:
        result = await self.session.execute(
            select(Device).where(Device.user_id == user_id)
        )
        return list(result.scalars().all())

    async def get_device(self, device_id: uuid.UUID) -> Optional[Device]:
        result = await self.session.execute(
            select(Device).where(Device.id == device_id)
        )
        return result.scalar_one_or_none()

    async def create_device(
        self, user_id: uuid.UUID, platform: str, fingerprint: str, name: Optional[str] = None
    ) -> Device:
        fingerprint_hash = hashlib.sha256(fingerprint.encode()).hexdigest()
        
        result = await self.session.execute(
            select(Device).where(
                Device.user_id == user_id,
                Device.fingerprint_hash == fingerprint_hash,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            return existing
            
        device = Device(
            user_id=user_id,
            platform=platform,
            fingerprint_hash=fingerprint_hash,
            name=name,
            status="pending_claim",
        )
        self.session.add(device)
        await self.session.commit()
        await self.session.refresh(device)
        return device

    async def claim_device(self, user_id: uuid.UUID, claim_token: str) -> Optional[Device]:
        token_hash = hashlib.sha256(claim_token.encode()).hexdigest()
        
        result = await self.session.execute(
            select(DeviceClaimToken).where(
                DeviceClaimToken.user_id == user_id,
                DeviceClaimToken.token_hash == token_hash,
                DeviceClaimToken.expires_at > datetime.utcnow(),
                DeviceClaimToken.used_at.is_(None),
            )
        )
        token = result.scalar_one_or_none()
        if not token:
            return None
            
        token.used_at = datetime.utcnow()
        
        if token.device_id:
            device = await self.get_device(token.device_id)
            if device:
                device.status = "active"
                device.claimed_at = datetime.utcnow()
                await self.session.commit()
                return device
            
        device_count = await self.session.execute(
            select(Device).where(
                Device.user_id == user_id,
                Device.status == "active",
            )
        )
        if len(list(device_count.scalars().all())) >= MAX_DEVICES:
            raise ValueError("Device limit reached")
            
        device = Device(
            user_id=user_id,
            platform="unknown",
            fingerprint_hash="pending",
            status="active",
            claimed_at=datetime.utcnow(),
        )
        self.session.add(device)
        await self.session.commit()
        await self.session.refresh(device)
        return device

    async def revoke_device(self, user_id: uuid.UUID, device_id: uuid.UUID) -> bool:
        device = await self.get_device(device_id)
        if not device or device.user_id != user_id:
            return False
            
        device.status = "revoked"
        device.revoked_at = datetime.utcnow()
        await self.session.commit()
        return True

    async def create_claim_token(self, user_id: uuid.UUID) -> str:
        token = secrets.token_urlsafe(16)
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        
        claim = DeviceClaimToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        self.session.add(claim)
        await self.session.commit()
        return token