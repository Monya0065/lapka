"""VPN API routes for owner and platform management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import RoleEnum, User
from src.security.deps import get_current_user, require_roles

router = APIRouter(prefix="/vpn", tags=["vpn"])


class VpnSubscriptionOut(BaseModel):
    user_id: str
    status: str
    plan_code: str
    updated_at: str


class VpnPlanOut(BaseModel):
    code: str
    name: str
    price_rub: int
    device_limit: int
    features: list[str]


class VpnCheckoutCreate(BaseModel):
    provider: str = Field(default="yookassa")
    plan_code: str = Field(default="vpn_default")


class VpnCheckoutOut(BaseModel):
    checkout_id: str
    provider: str
    plan_code: str
    amount_rub: int
    status: str
    payment_url: str | None = None
    created_at: str


class VpnProfileOut(BaseModel):
    id: str
    user_id: str
    device_name: str
    wireguard_config: str | None
    created_at: str
    is_active: bool


class VpnDeviceLinkOut(BaseModel):
    id: str
    profile_id: str
    device_id: str
    device_name: str
    linked_at: str


class VpnWebhookEventOut(BaseModel):
    provider: str
    event_id: str
    checkout_id: str
    status: str
    amount_rub: int
    created_at: str


@router.get("/plans", response_model=list[VpnPlanOut])
async def list_vpn_plans(db: AsyncSession = Depends(get_db_session)) -> list[VpnPlanOut]:
    """List available VPN plans."""
    try:
        rows = await db.execute(text("SELECT code, name, price_rub, device_limit, features FROM vpn_plans ORDER BY price_rub"))
        plans = []
        for row in rows:
            features = row.features if isinstance(row.features, list) else []
            plans.append(VpnPlanOut(
                code=row.code,
                name=row.name,
                price_rub=row.price_rub,
                device_limit=row.device_limit,
                features=features,
            ))
        if not plans:
            raise Exception()
    except Exception:
        plans = [
            VpnPlanOut(code="basic_monthly", name="Базовый", price_rub=299, device_limit=3, features=["3 устройства", "Безлимит"]),
            VpnPlanOut(code="premium_monthly", name="Премиум", price_rub=599, device_limit=10, features=["10 устройств", "Приоритет"]),
        ]
    return plans


@router.get("/subscription", response_model=VpnSubscriptionOut | None)
async def get_my_vpn_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> VpnSubscriptionOut | None:
    """Get current user's VPN subscription."""
    try:
        row = await db.execute(
            text("""
                SELECT user_id, status, plan_code, updated_at 
                FROM vpn_subscriptions 
                WHERE user_id = :user_id
            """),
            {"user_id": str(current_user.id)},
        )
        result = row.fetchone()
        if not result:
            return None
        return VpnSubscriptionOut(
            user_id=result.user_id,
            status=result.status,
            plan_code=result.plan_code,
            updated_at=result.updated_at.isoformat(),
        )
    except Exception:
        return None


@router.post("/subscription/checkout", response_model=VpnCheckoutOut)
async def create_vpn_checkout(
    payload: VpnCheckoutCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> VpnCheckoutOut:
    """Create checkout for VPN subscription."""
    checkout_id = f"lapka_checkout_{current_user.id}"
    price_map = {"basic_monthly": 299, "premium_monthly": 599}
    price = price_map.get(payload.plan_code, 299)
    try:
        plan_row = await db.execute(
            text("SELECT price_rub FROM vpn_plans WHERE code = :plan_code"),
            {"plan_code": payload.plan_code},
        )
        plan = plan_row.fetchone()
        if plan:
            price = plan.price_rub
            try:
                await db.execute(
                    text("""
                        INSERT INTO vpn_checkouts (checkout_id, user_id, provider, plan_code, amount_rub, status)
                        VALUES (:checkout_id, :user_id, :provider, :plan_code, :amount_rub, 'pending')
                        ON CONFLICT (checkout_id) DO UPDATE SET status = 'pending'
                    """),
                    {
                        "checkout_id": checkout_id,
                        "user_id": str(current_user.id),
                        "provider": payload.provider,
                        "plan_code": payload.plan_code,
                        "amount_rub": price,
                    },
                )
                await db.commit()
            except Exception:
                pass
    except Exception:
        pass

    payment_url = f"/pay/{payload.provider}/{checkout_id}"

    return VpnCheckoutOut(
        checkout_id=checkout_id,
        provider=payload.provider,
        plan_code=payload.plan_code,
        amount_rub=price,
        status="pending",
        payment_url=payment_url,
    )


@router.get("/profiles", response_model=list[VpnProfileOut])
async def list_vpn_profiles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[VpnProfileOut]:
    """List user's VPN profiles."""
    try:
        rows = await db.execute(
            text("""
                SELECT id, user_id, device_name, wireguard_config, created_at, is_active
                FROM vpn_profiles
                WHERE user_id = :user_id
                ORDER BY created_at DESC
            """),
            {"user_id": str(current_user.id)},
        )
        profiles = []
        for row in rows:
            profiles.append(VpnProfileOut(
                id=str(row.id),
                user_id=row.user_id,
                device_name=row.device_name,
                wireguard_config=row.wireguard_config,
                created_at=row.created_at.isoformat(),
                is_active=row.is_active,
            ))
        return profiles
    except Exception as e:
        print(f"Error listing VPN profiles: {e}")
        return []


class CreateProfileRequest(BaseModel):
    device_name: str = Field(..., min_length=1, max_length=64)


@router.post("/profiles", response_model=VpnProfileOut)
async def create_vpn_profile(
    payload: CreateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> VpnProfileOut:
    """Create new VPN profile (device)."""
    device_name = payload.device_name
    profile_id = str(current_user.id)

    await db.execute(
        text("""
            INSERT INTO vpn_profiles (id, user_id, device_name, is_active)
            VALUES (:id, :user_id, :device_name, true)
            ON CONFLICT (id) DO UPDATE SET device_name = EXCLUDED.device_name
        """),
        {"id": profile_id, "user_id": str(current_user.id), "device_name": device_name},
    )
    await db.commit()

    row = await db.execute(
        text("SELECT id, user_id, device_name, wireguard_config, created_at, is_active FROM vpn_profiles WHERE id = :id"),
        {"id": profile_id},
    )
    result = row.fetchone()

    return VpnProfileOut(
        id=str(result.id),
        user_id=result.user_id,
        device_name=result.device_name,
        wireguard_config=result.wireguard_config,
        created_at=result.created_at.isoformat(),
        is_active=result.is_active,
    )


@router.delete("/profiles/{profile_id}")
async def delete_vpn_profile(
    profile_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Delete VPN profile."""
    await db.execute(
        text("DELETE FROM vpn_profiles WHERE id = :id AND user_id = :user_id"),
        {"id": profile_id, "user_id": str(current_user.id)},
    )
    await db.commit()
    return {"status": "deleted"}


@router.get("/checkouts", response_model=list[VpnCheckoutOut])
async def list_my_checkouts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[VpnCheckoutOut]:
    """List user's VPN checkouts."""
    rows = await db.execute(
        text("""
            SELECT checkout_id, provider, plan_code, amount_rub, status, created_at
            FROM vpn_checkouts
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 10
        """),
        {"user_id": str(current_user.id)},
    )
    checkouts = []
    for row in rows:
        checkouts.append(VpnCheckoutOut(
            checkout_id=row.checkout_id,
            provider=row.provider,
            plan_code=row.plan_code,
            amount_rub=row.amount_rub,
            status=row.status,
            payment_url=None,
            created_at=row.created_at.isoformat(),
        ))
    return checkouts


# Platform VPN routes (admin)

@router.get("/platform/subscriptions", response_model=list[VpnSubscriptionOut])
async def platform_list_subscriptions(
    status_filter: str | None = Query(None, alias="status"),
    limit: int = Query(50, le=100),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[VpnSubscriptionOut]:
    """List all VPN subscriptions (platform admin)."""
    query = text("SELECT user_id, status, plan_code, updated_at FROM vpn_subscriptions")
    if status_filter:
        query = text(f"{query} WHERE status = :status")
    query = text(f"{query} ORDER BY updated_at DESC LIMIT :limit")

    params = {"status": status_filter, "limit": limit} if status_filter else {"limit": limit}
    rows = await db.execute(query, params)

    subs = []
    for row in rows:
        subs.append(VpnSubscriptionOut(
            user_id=row.user_id,
            status=row.status,
            plan_code=row.plan_code,
            updated_at=row.updated_at.isoformat(),
        ))
    return subs


@router.get("/platform/webhook-events", response_model=list[VpnWebhookEventOut])
async def platform_list_webhook_events(
    limit: int = Query(50, le=100),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> list[VpnWebhookEventOut]:
    """List VPN webhook events (platform admin)."""
    rows = await db.execute(
        text("""
            SELECT provider, event_id, checkout_id, status, amount_rub, created_at
            FROM vpn_webhook_events
            ORDER BY created_at DESC
            LIMIT :limit
        """),
        {"limit": limit},
    )
    events = []
    for row in rows:
        events.append(VpnWebhookEventOut(
            provider=row.provider,
            event_id=row.event_id,
            checkout_id=row.checkout_id,
            status=row.status,
            amount_rub=row.amount_rub,
            created_at=row.created_at.isoformat(),
        ))
    return events


@router.post("/platform/reconcile")
async def platform_reconcile_billing(
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Reconcile billing: match checkouts with webhook events."""
    result = await db.execute(text("""
        UPDATE vpn_subscriptions
        SET status = 'active'
        WHERE user_id IN (
            SELECT c.user_id FROM vpn_checkouts c
            JOIN vpn_webhook_events w ON c.checkout_id = w.checkout_id
            WHERE w.status = 'captured' AND c.status = 'pending'
        )
    """))
    await db.commit()
    return {"status": "reconciled", "updated_count": result.rowcount}


@router.delete("/platform/maintenance/prune")
async def platform_prune_inactive(
    days: int = Query(90, ge=30, le=365),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Prune inactive VPN profiles older than specified days."""
    result = await db.execute(
        text("""
            DELETE FROM vpn_profiles
            WHERE is_active = false
            AND created_at < NOW() - INTERVAL ':days days'
        """),
        {"days": days},
    )
    await db.commit()
    return {"status": "pruned", "deleted_count": result.rowcount}


@router.get("/checkouts/{checkout_id}")
async def get_checkout_status(
    checkout_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    """Get checkout status by ID."""
    row = await db.execute(
        text("""
            SELECT checkout_id, provider, plan_code, amount_rub, status, created_at
            FROM vpn_checkouts
            WHERE checkout_id = :checkout_id AND user_id = :user_id
        """),
        {"checkout_id": checkout_id, "user_id": str(current_user.id)},
    )
    result = row.fetchone()
    if not result:
        raise HTTPException(status_code=404, detail="Checkout not found")
    return {
        "checkout_id": result.checkout_id,
        "provider": result.provider,
        "status": result.status,
        "amount_rub": result.amount_rub,
        "plan_code": result.plan_code,
        "created_at": result.created_at.isoformat(),
    }