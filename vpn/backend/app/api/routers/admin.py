"""Admin router for user management."""
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException, Query, Header, Depends
from sqlalchemy import text

from app.database import get_session

router = APIRouter()


async def get_current_admin(authorization: str = Header(None)) -> uuid.UUID:
    """Verify admin token."""
    from jose import jwt
    from app.services import SECRET_KEY, ALGORITHM
    
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    token = authorization.replace("Bearer ", "")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = uuid.UUID(payload["sub"])
        
        session = await get_session()
        result = await session.execute(
            text("SELECT role FROM users WHERE id = :id"),
            {"id": str(user_id)}
        )
        user = result.fetchone()
        if not user or user.role != "admin":
            raise HTTPException(status_code=403, detail="Admin only")
        return user_id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/users")
async def list_users(
    search: str = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """List all users with pagination."""
    session = await get_session()
    offset = (page - 1) * limit
    
    count_sql = "SELECT COUNT(*) as total FROM users"
    if search:
        count_sql += " WHERE email ILIKE :search"
    
    count_result = await session.execute(text(count_sql), {"search": f"%{search}%"})
    total = count_result.fetchone().total
    
    if search:
        result = await session.execute(
            text("""
                SELECT u.id, u.email, u.role, u.created_at, u.mfa_enabled, u.email_verified,
                       s.status as subscription_status, s.plan_id
                FROM users u
                LEFT JOIN subscriptions s ON s.user_id = u.id
                WHERE u.email ILIKE :search
                ORDER BY u.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"search": f"%{search}%", "limit": limit, "offset": offset}
        )
    else:
        result = await session.execute(
            text("""
                SELECT u.id, u.email, u.role, u.created_at, u.mfa_enabled, u.email_verified,
                       s.status as subscription_status, s.plan_id
                FROM users u
                LEFT JOIN subscriptions s ON s.user_id = u.id
                ORDER BY u.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"limit": limit, "offset": offset}
        )
    
    users = []
    for row in result.fetchall():
        users.append({
            "id": str(row.id),
            "email": row.email,
            "role": row.role,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "mfa_enabled": row.mfa_enabled,
            "email_verified": row.email_verified,
            "subscription_status": row.subscription_status,
            "plan_id": row.plan_id,
        })
    
    return {
        "items": users,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
    }


@router.get("/users/{user_id}")
async def get_user(
    user_id: str,
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """Get user details."""
    session = await get_session()
    result = await session.execute(
        text("""
            SELECT u.*, s.status as subscription_status, s.plan_id, s.renew_at
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            WHERE u.id = :user_id
        """),
        {"user_id": user_id}
    )
    user = result.fetchone()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": str(user.id),
        "email": user.email,
        "role": user.role,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "mfa_enabled": user.mfa_enabled,
        "email_verified": user.email_verified,
        "subscription_status": user.subscription_status,
        "plan_id": user.plan_id,
        "renew_at": user.renew_at.isoformat() if user.renew_at else None,
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str,
    role: str = Query(None),
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """Update user."""
    session = await get_session()
    
    if role:
        await session.execute(
            text("UPDATE users SET role = :role WHERE id = :id"),
            {"role": role, "id": user_id}
        )
    
    await session.commit()
    return {"ok": True}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """Delete user."""
    session = await get_session()
    
    await session.execute(text("DELETE FROM sessions WHERE user_id = :id"), {"id": user_id})
    await session.execute(text("DELETE FROM devices WHERE user_id = :id"), {"id": user_id})
    await session.execute(text("DELETE FROM subscriptions WHERE user_id = :id"), {"id": user_id})
    await session.execute(text("DELETE FROM users WHERE id = :id"), {"id": user_id})
    
    await session.commit()
    return {"ok": True}


@router.get("/subscriptions")
async def list_subscriptions(
    status: str = Query(None),
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """List all subscriptions."""
    session = await get_session()
    
    if status:
        result = await session.execute(
            text("""
                SELECT s.*, u.email
                FROM subscriptions s
                JOIN users u ON u.id = s.user_id
                WHERE s.status = :status
                ORDER BY s.created_at DESC
                LIMIT 100
            """),
            {"status": status}
        )
    else:
        result = await session.execute(
            text("""
                SELECT s.*, u.email
                FROM subscriptions s
                JOIN users u ON u.id = s.user_id
                ORDER BY s.created_at DESC
                LIMIT 100
            """)
        )
    
    subs = []
    for row in result.fetchall():
        subs.append({
            "id": str(row.id),
            "user_id": str(row.user_id),
            "email": row.email,
            "plan_id": row.plan_id,
            "status": row.status,
            "provider": row.provider,
            "renew_at": row.renew_at.isoformat() if row.renew_at else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    return subs


@router.get("/payments")
async def list_payments(
    status: str = Query(None),
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """List all payments."""
    session = await get_session()
    
    if status:
        result = await session.execute(
            text("""
                SELECT p.*, u.email
                FROM payments p
                JOIN users u ON u.id = p.user_id
                WHERE p.status = :status
                ORDER BY p.created_at DESC
                LIMIT 100
            """),
            {"status": status}
        )
    else:
        result = await session.execute(
            text("""
                SELECT p.*, u.email
                FROM payments p
                JOIN users u ON u.id = p.user_id
                ORDER BY p.created_at DESC
                LIMIT 100
            """)
        )
    
    payments = []
    for row in result.fetchall():
        payments.append({
            "id": str(row.id),
            "user_id": str(row.user_id),
            "email": row.email,
            "provider": row.provider,
            "amount": row.amount,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    return payments


@router.get("/stats")
async def get_stats(admin_id: uuid.UUID = Depends(get_current_admin)):
    """Get system stats."""
    session = await get_session()
    
    users_result = await session.execute(text("SELECT COUNT(*) FROM users"))
    users_count = users_result.scalar()
    
    subs_result = await session.execute(text("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"))
    active_subs = subs_result.scalar()
    
    devices_result = await session.execute(text("SELECT COUNT(*) FROM devices"))
    devices_count = devices_result.scalar()
    
    payments_result = await session.execute(
        text("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'succeeded'")
    )
    total_revenue = payments_result.scalar()
    
    return {
        "total_users": users_count,
        "active_subscriptions": active_subs,
        "total_devices": devices_count,
        "total_revenue": total_revenue,
    }


@router.get("/logs")
async def get_logs(
    limit: int = Query(100),
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """Get audit logs."""
    session = await get_session()
    result = await session.execute(
        text("SELECT * FROM audit_events ORDER BY created_at DESC LIMIT :limit"),
        {"limit": limit}
    )
    logs = []
    for row in result.fetchall():
        logs.append({
            "id": str(row.id),
            "action": row.action,
            "entity": row.entity,
            "entity_id": str(row.entity_id) if row.entity_id else None,
            "actor_id": str(row.actor_id) if row.actor_id else None,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        })
    return logs


@router.get("/settings")
async def get_settings(admin_id: uuid.UUID = Depends(get_current_admin)):
    """Get system settings."""
    return {
        "pricing": {
            "trial_days": 7,
            "monthly_price": 299,
            "yearly_price": 2490,
        },
        "vpn": {
            "wireguard_port": 51820,
            "max_devices": 5,
        },
        "features": {
            "telegram_enabled": True,
            "email_verification": True,
            "paid_subscriptions": True,
        }
    }


@router.patch("/settings/pricing")
async def update_pricing(
    trial_days: int = Query(None),
    monthly_price: int = Query(None),
    yearly_price: int = Query(None),
    admin_id: uuid.UUID = Depends(get_current_admin),
):
    """Update pricing."""
    # In production, save to database
    return {"status": "updated"}