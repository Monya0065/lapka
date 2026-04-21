"""VPN Node Health Check Service."""
import asyncio
import socket
from datetime import datetime, timedelta
from typing import Dict, List, Optional

import httpx
from sqlalchemy import text


class VPNNodeHealthChecker:
    """Health checker for VPN nodes."""
    
    def __init__(self, session):
        self.session = session
        self.health_threshold = 70
        self.timeout = 5
        
    async def check_all_nodes(self) -> List[Dict]:
        """Check health of all VPN nodes."""
        result = await self.session.execute(
            text("SELECT id, region, endpoint, status FROM vpn_nodes")
        )
        nodes = result.fetchall()
        
        results = []
        for node in nodes:
            health = await self._check_node(node.endpoint)
            results.append({
                "id": str(node.id),
                "region": node.region,
                "endpoint": node.endpoint,
                "status": node.status,
                "health_score": health["score"],
                "latency_ms": health["latency"],
                "online": health["online"],
                "checked_at": datetime.utcnow().isoformat(),
            })
            
            # Update node status in DB
            await self._update_node_health(
                node.id, 
                health["score"], 
                health["online"]
            )
            
        return results
    
    async def _check_node(self, endpoint: str) -> Dict:
        """Check single node health."""
        try:
            # Check if port is open (WireGuard UDP 51820)
            start = asyncio.get_event_loop().time()
            online = await self._check_port_open(endpoint.split(":")[0], 51820)
            latency = int((asyncio.get_event_loop().time() - start) * 1000)
            
            if not online:
                return {"score": 0, "latency": 0, "online": False}
            
            # Calculate score based on latency
            if latency < 30:
                score = 100
            elif latency < 100:
                score = 90
            elif latency < 200:
                score = 75
            else:
                score = 50
                
            return {"score": score, "latency": latency, "online": True}
            
        except Exception as e:
            return {"score": 0, "latency": 0, "online": False}
    
    async def _check_port_open(self, host: str, port: int) -> bool:
        """Check if port is open."""
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port),
                timeout=self.timeout
            )
            writer.close()
            await writer.wait_closed()
            return True
        except:
            return False
    
    async def _update_node_health(self, node_id, score: int, online: bool):
        """Update node health in database."""
        status = "active" if online else "inactive"
        await self.session.execute(
            text("""
                UPDATE vpn_nodes 
                SET health_score = :score, 
                    status = :status,
                    last_health_check = NOW()
                WHERE id = :id
            """),
            {"score": score, "status": status, "id": str(node_id)}
        )
        await self.session.commit()
    
    async def get_optimal_node(self, user_region: Optional[str] = None) -> Optional[Dict]:
        """Get optimal node for user."""
        query = """
            SELECT id, region, endpoint, public_key, health_score, capacity
            FROM vpn_nodes 
            WHERE status = 'active' 
            AND health_score >= :threshold
        """
        
        if user_region:
            query += " AND region = :region"
            result = await self.session.execute(
                text(query),
                {"threshold": self.health_threshold, "region": user_region}
            )
        else:
            result = await self.session.execute(
                text(query),
                {"threshold": self.health_threshold}
            )
        
        nodes = result.fetchall()
        if not nodes:
            return None
        
        # Sort by health score descending
        nodes = sorted(nodes, key=lambda n: n.health_score, reverse=True)
        
        return {
            "id": str(nodes[0].id),
            "region": nodes[0].region,
            "endpoint": nodes[0].endpoint,
            "public_key": nodes[0].public_key,
            "health_score": nodes[0].health_score,
        }


class NodeMonitor:
    """Background monitor for VPN nodes."""
    
    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.running = False
        
    async def start(self):
        """Start monitoring."""
        self.running = True
        while self.running:
            try:
                session = await self.session_factory()
                checker = VPNNodeHealthChecker(session)
                await checker.check_all_nodes()
                await session.close()
            except Exception as e:
                print(f"Health check error: {e}")
            
            await asyncio.sleep(60)  # Check every minute
    
    def stop(self):
        """Stop monitoring."""
        self.running = False