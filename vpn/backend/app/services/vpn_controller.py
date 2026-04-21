from datetime import datetime
from typing import Optional
import asyncio
import random


class VPNNode:
    def __init__(
        self,
        id: str,
        name: str,
        country: str,
        city: str,
        ip_address: str,
        port: int = 51820,
        load: float = 0.0,
        max_users: int = 10000,
        status: str = "online",
    ):
        self.id = id
        self.name = name
        self.country = country
        self.city = city
        self.ip_address = ip_address
        self.port = port
        self.load = load
        self.max_users = max_users
        self.status = status
        self.users = 0
        self.bandwidth = 0
        self.latency = 0

    def is_available(self) -> bool:
        return self.status == "online" and self.load < 80

    @property
    def available_slots(self) -> int:
        return self.max_users - self.users

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "country": self.country,
            "city": self.city,
            "ip_address": self.ip_address,
            "port": self.port,
            "status": self.status,
            "users": self.users,
            "load": self.load,
            "bandwidth": self.bandwidth,
            "latency": self.latency,
        }


class VPNController:
    def __init__(self):
        self.nodes: dict[str, VPNNode] = {}
        self.load_threshold = 70
        self.max_users_per_node = 10000
        self._lock = asyncio.Lock()

    async def add_node(self, node: VPNNode) -> None:
        async with self._lock:
            self.nodes[node.id] = node

    async def remove_node(self, node_id: str) -> None:
        async with self._lock:
            self.nodes.pop(node_id, None)

    async def update_node_status(
        self,
        node_id: str,
        status: Optional[str] = None,
        load: Optional[float] = None,
        users: Optional[int] = None,
        bandwidth: Optional[int] = None,
        latency: Optional[float] = None,
    ) -> None:
        async with self._lock:
            if node_id in self.nodes:
                node = self.nodes[node_id]
                if status:
                    node.status = status
                if load is not None:
                    node.load = load
                if users is not None:
                    node.users = users
                if bandwidth is not None:
                    node.bandwidth = bandwidth
                if latency is not None:
                    node.latency = latency

    async def get_node(self, node_id: str) -> Optional[VPNNode]:
        return self.nodes.get(node_id)

    async def list_nodes(
        self,
        country: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[VPNNode]:
        async with self._lock:
            nodes = list(self.nodes.values())

        if country:
            nodes = [n for n in nodes if n.country == country]
        if status:
            nodes = [n for n in nodes if n.status == status]

        return sorted(nodes, key=lambda n: n.load)

    async def select_node(
        self,
        user_country: Optional[str] = None,
        required_scope: Optional[str] = None,
    ) -> Optional[VPNNode]:
        async with self._lock:
            available = [n for n in self.nodes.values() if n.is_available()]

        if not available:
            return None

        if user_country:
            region_nodes = [n for n in available if n.country == user_country]
            if region_nodes:
                available = region_nodes

        return min(available, key=lambda n: n.load)

    async def get_best_nodes(self, limit: int = 10) -> list[VPNNode]:
        async with self._lock:
            available = [n for n in self.nodes.values() if n.is_available()]

        return sorted(available, key=lambda n: n.load)[:limit]

    async def get_node_stats(self) -> dict:
        async with self._lock:
            total_users = sum(n.users for n in self.nodes.values())
            total_bandwidth = sum(n.bandwidth for n in self.nodes.values())
            online_nodes = sum(1 for n in self.nodes.values() if n.status == "online")
            avg_latency = (
                sum(n.latency for n in self.nodes.values()) / len(self.nodes)
                if self.nodes
                else 0
            )

        return {
            "total_nodes": len(self.nodes),
            "online_nodes": online_nodes,
            "total_users": total_users,
            "total_bandwidth": total_bandwidth,
            "average_latency": avg_latency,
            "timestamp": datetime.utcnow().isoformat(),
        }

    async def auto_scale(self) -> dict[str, int]:
        results = {"scaled_up": 0, "scaled_down": 0}

        regions = {}
        async with self._lock:
            for node in self.nodes.values():
                regions.setdefault(node.country, []).append(node)

        for country, nodes in regions.items():
            if not nodes:
                continue

            avg_load = sum(n.load for n in nodes) / len(nodes)

            if avg_load > 70 and len(nodes) < 100:
                results["scaled_up"] += 1
            elif avg_load < 30 and len(nodes) > 10:
                results["scaled_down"] += 1

        return results

    def get_nodes_by_region(self) -> dict[str, list[VPNNode]]:
        regions: dict[str, list[VPNNode]] = {}
        for node in self.nodes.values():
            regions.setdefault(node.country, []).append(node)
        return regions


controller = VPNController()