"""WebSocket for real-time notifications."""
import asyncio
import json
import uuid
from typing import dict, Set
from fastapi import WebSocket, WebSocketDisconnect, Depends


class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, Set[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        
        self.active_connections[user_id].add(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id not in self.active_connections:
            return
        
        disconnected = set()
        
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        
        for conn in disconnected:
            self.disconnect(conn, user_id)

    async def broadcast(self, message: dict):
        for user_id, connections in self.active_connections.items():
            await self.send_personal_message(message, user_id)

    async def notify_subscription_expiring(self, user_id: str, days: int):
        await self.send_personal_message({
            "type": "subscription_expiring",
            "days": days,
            "message": f"Подписка истекает через {days} дней",
        }, user_id)

    async def notify_payment_success(self, user_id: str, amount: float, plan: str):
        await self.send_personal_message({
            "type": "payment_success",
            "amount": amount,
            "plan": plan,
            "message": f"Платёж {amount}₽ успешен",
        }, user_id)

    async def notify_device_connected(self, user_id: str, device_name: str):
        await self.send_personal_message({
            "type": "device_connected",
            "device": device_name,
            "message": f"{device_name} подключён",
        }, user_id)

    async def notify_maintenance(self, user_ids: list[str], start_time: str, duration: int):
        message = {
            "type": "maintenance",
            "start_time": start_time,
            "duration": duration,
            "message": f"Тех. обслуживание в {start_time}",
        }
        
        for user_id in user_ids:
            await self.send_personal_message(message, user_id)


manager = ConnectionManager()


async def websocket_auth(websocket: WebSocket) -> str:
    """Authenticate WebSocket connection."""
    token = websocket.query_params.get("token")
    
    if not token:
        await websocket.close(code=4001)
        raise Exception("Missing token")
    
    from jose import jwt
    from app.services import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except Exception:
        await websocket.close(code=4001)
        raise Exception("Invalid token")