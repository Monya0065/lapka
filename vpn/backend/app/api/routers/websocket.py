"""WebSocket endpoint."""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from app.api.websocket import manager, websocket_auth

router = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time notifications."""
    try:
        user_id = await websocket_auth(websocket)
    except Exception:
        return
    
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                message = eval(data)
            except:
                message = {"type": "ping"}
            
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "subscribe":
                event = message.get("event")
                if event:
                    pass
            
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)