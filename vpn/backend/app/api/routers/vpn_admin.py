"""WireGuard provisioning admin router."""
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy import text

from app.database import get_session

router = APIRouter()


@router.get("/nodes")
async def list_nodes():
    """List all VPN nodes."""
    session = await get_session()
    result = await session.execute(text("SELECT * FROM vpn_nodes ORDER BY region"))
    nodes = []
    for row in result.fetchall():
        nodes.append({
            "id": str(row.id),
            "region": row.region,
            "endpoint": row.endpoint,
            "public_key": row.public_key,
            "status": row.status,
            "capacity": row.capacity,
            "health_score": row.health_score,
        })
    return nodes


@router.post("/nodes")
async def create_node(
    region: str = Query(...),
    endpoint: str = Query(...),
    public_key: str = Query(...),
):
    """Create new VPN node."""
    session = await get_session()
    node_id = uuid.uuid4()
    
    await session.execute(
        text("""
            INSERT INTO vpn_nodes (id, region, endpoint, public_key, status, capacity, health_score)
            VALUES (:id, :region, :endpoint, :public_key, 'active', 100, 100)
        """),
        {
            "id": str(node_id),
            "region": region,
            "endpoint": endpoint,
            "public_key": public_key,
        }
    )
    await session.commit()
    
    return {"id": str(node_id), "status": "created"}


@router.delete("/nodes/{node_id}")
async def delete_node(node_id: str):
    """Delete VPN node."""
    session = await get_session()
    await session.execute(
        text("DELETE FROM vpn_nodes WHERE id = :id"),
        {"id": node_id}
    )
    await session.commit()
    return {"status": "deleted"}


@router.get("/nodes/{node_id}/stats")
async def node_stats(node_id: str):
    """Get node stats."""
    session = await get_session()
    result = await session.execute(
        text("""
            SELECT 
                COUNT(*) as total_profiles,
                SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_profiles
            FROM vpn_profiles 
            WHERE node_id = :node_id
        """),
        {"node_id": node_id}
    )
    row = result.fetchone()
    return {
        "total_profiles": row.total_profiles or 0,
        "active_profiles": row.active_profiles or 0,
    }