"""Admin audit log service."""
import uuid
from datetime import datetime
from typing import Optional
import redis.asyncio as redis


class AuditService:
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or "redis://redis:6379"
        self._redis: Optional[redis.Redis] = None

    async def _get_redis(self) -> redis.Redis:
        if self._redis is None:
            self._redis = await redis.from_url(self.redis_url)
        return self._redis

    async def log(
        self,
        admin_id: str,
        action: str,
        target_type: str,
        target_id: str,
        details: Optional[dict] = None,
    ):
        """Log admin action."""
        r = await self._get_redis()
        
        entry = {
            "id": str(uuid.uuid4()),
            "admin_id": admin_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": details or {},
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        await r.lpush(f"audit:{admin_id}", str(entry))
        await r.ltrim(f"audit:{admin_id}", 0, 999)
        
        await r.zadd(
            "audit_global",
            {str(entry): datetime.utcnow().timestamp()}
        )

    async def get_admin_logs(self, admin_id: str, limit: int = 100) -> list:
        """Get logs for specific admin."""
        r = await self._get_redis()
        
        logs = await r.lrange(f"audit:{admin_id}", 0, limit - 1)
        
        return [eval(log.decode()) for log in logs]

    async def get_recent_logs(self, limit: int = 100) -> list:
        """Get recent logs across all admins."""
        r = await self._get_redis()
        
        entries = await r.zrevrange(
            "audit_global",
            0,
            limit - 1,
            withscores=True
        )
        
        results = []
        for entry, score in entries:
            log = eval(entry.decode())
            log["timestamp"] = datetime.fromtimestamp(score).isoformat()
            results.append(log)
        
        return results

    async def search(
        self,
        admin_id: Optional[str] = None,
        action: Optional[str] = None,
        target_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
    ) -> list:
        """Search audit logs."""
        logs = await self.get_recent_logs(1000)
        
        results = []
        for log in logs:
            if admin_id and log.get("admin_id") != admin_id:
                continue
            if action and log.get("action") != action:
                continue
            if target_type and log.get("target_type") != target_type:
                continue
            
            log_time = datetime.fromisoformat(log["timestamp"])
            
            if start_date and log_time < start_date:
                continue
            if end_date and log_time > end_date:
                continue
            
            results.append(log)
        
        return results[:limit]

    async def get_stats(self) -> dict:
        """Get audit statistics."""
        r = await self._get_redis()
        
        admin_keys = await r.keys("audit:*")
        
        action_counts = {}
        for key in admin_keys:
            logs = await r.lrange(key, 0, -1)
            for log in logs:
                entry = eval(log.decode())
                action = entry.get("action", "unknown")
                action_counts[action] = action_counts.get(action, 0) + 1
        
        return {
            "total_actions": sum(action_counts.values()),
            "actions_by_type": action_counts,
            "total_admins": len(admin_keys),
        }


audit_service = AuditService()