from __future__ import annotations

import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import case, delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    AIBudget,
    AIClinicOverride,
    AILimit,
    AIModel,
    AIPolicy,
    AIProvider,
    AIPrompt,
    AIPromptVersion,
    AIRolePolicy,
    AIRoute,
    AITenantOverride,
    AIUsageLog,
    Clinic,
    RoleEnum,
)
from src.security.deps import require_roles
from src.services.audit import log_audit
from src.services.ai_runtime import default_ai_route_payloads

router = APIRouter(prefix="/platform/ai", tags=["platform-ai"])


class PlatformAIProviderPayload(BaseModel):
    id: str | None = None
    slug: str
    name: str
    status: str = "active"
    provider_type: str = "remote"
    routing: str = ""
    fallback: str | None = None
    default_model: str | None = None
    models: list[str] = Field(default_factory=list)
    capabilities: list[str] = Field(default_factory=list)


class PlatformAIRoutePayload(BaseModel):
    id: str | None = None
    slug: str
    scenario_key: str
    scenario: str
    role_scope: str | None = None
    primary: str
    primary_model: str | None = None
    fallback: str | None = None
    fallback_model: str | None = None
    policy: str | None = None
    enabled: bool = True


class PlatformAIOverridePayload(BaseModel):
    id: str | None = None
    source_type: str
    level: str
    target: str
    mode: str
    provider: str | None = None
    model_key: str | None = None
    route_slug: str | None = None
    tenant_key: str | None = None
    clinic_id: str | None = None
    role: str | None = None
    enabled: bool = True


class PlatformAIGuardrailsPayload(BaseModel):
    monthlyBudget: int = 0
    hardLimit: int = 0
    currency: str = "USD"
    maxOwnerRequestsPerHour: int = 0
    maxVetRequestsPerHour: int = 0
    piiRedaction: bool = True
    promptAudit: bool = True
    fallbackMode: str = "strict"


class PlatformAIControlPlaneUpdate(BaseModel):
    providers: list[PlatformAIProviderPayload] = Field(default_factory=list)
    routing: list[PlatformAIRoutePayload] = Field(default_factory=list)
    overrides: list[PlatformAIOverridePayload] = Field(default_factory=list)
    guardrails: PlatformAIGuardrailsPayload


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _parse_uuid(raw: str | None, field_name: str) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": f"Invalid {field_name}"},
        ) from exc


def _role_label(role: str | None) -> str:
    labels = {
        "owner": "Владелец",
        "vet": "Ветеринарный врач",
        "clinic_admin": "Администратор клиники",
        "network_admin": "Платформа",
    }
    return labels.get(str(role or ""), str(role or ""))


async def _ensure_platform_budget(session: AsyncSession) -> AIBudget:
    row = await session.scalar(select(AIBudget).where(AIBudget.scope_type == "platform", AIBudget.scope_key.is_(None)))
    if row:
        return row
    row = AIBudget(scope_type="platform", scope_key=None, monthly_budget=4800, hard_limit=6200, currency="USD")
    session.add(row)
    await session.flush()
    return row


async def _ensure_platform_limit(session: AsyncSession) -> AILimit:
    row = await session.scalar(select(AILimit).where(AILimit.scope_type == "platform", AILimit.scope_key.is_(None)))
    if row:
        return row
    row = AILimit(
        scope_type="platform",
        scope_key=None,
        max_owner_requests_per_hour=1600,
        max_vet_requests_per_hour=900,
        prompt_audit=True,
        pii_redaction=True,
        fallback_mode="strict",
    )
    session.add(row)
    await session.flush()
    return row


async def _serialize_providers(session: AsyncSession) -> list[dict]:
    providers = (
        await session.scalars(select(AIProvider).order_by(AIProvider.created_at.asc(), AIProvider.slug.asc()))
    ).all()
    models = (await session.scalars(select(AIModel).order_by(AIModel.provider_id.asc(), AIModel.created_at.asc()))).all()
    grouped_models: dict[uuid.UUID, list[AIModel]] = {}
    for model in models:
        grouped_models.setdefault(model.provider_id, []).append(model)

    payload: list[dict] = []
    for provider in providers:
        provider_models = grouped_models.get(provider.id, [])
        ordered_model_keys = [model.model_key for model in provider_models]
        payload.append(
            {
                "id": str(provider.id),
                "slug": provider.slug,
                "name": provider.name,
                "status": provider.status,
                "provider_type": provider.provider_type,
                "routing": provider.routing_summary or "",
                "fallback": provider.fallback_model_key,
                "default_model": provider.default_model_key,
                "models": ordered_model_keys,
                "capabilities": list(provider.capabilities_json or []),
            }
        )
    return payload


async def _serialize_routes(session: AsyncSession) -> list[dict]:
    rows = (await session.scalars(select(AIRoute).order_by(AIRoute.created_at.asc(), AIRoute.slug.asc()))).all()
    policies = {
        row.slug: row.name
        for row in (await session.scalars(select(AIPolicy).order_by(AIPolicy.slug.asc()))).all()
    }
    serialized = {
        row.slug: {
            "id": str(row.id),
            "slug": row.slug,
            "scenario_key": row.scenario_key,
            "scenario": row.scenario_name,
            "role_scope": row.role_scope,
            "primary": row.primary_provider_slug,
            "primary_model": row.primary_model_key,
            "fallback": row.fallback_provider_slug,
            "fallback_model": row.fallback_model_key,
            "policy": policies.get(row.policy_slug, row.policy_slug),
            "enabled": row.enabled,
        }
        for row in rows
    }
    for default_payload in default_ai_route_payloads():
        serialized.setdefault(default_payload["slug"], default_payload)
    return list(serialized.values())


async def _serialize_overrides(session: AsyncSession) -> list[dict]:
    clinics = {row.id: row.name for row in (await session.scalars(select(Clinic))).all()}
    payload: list[dict] = []

    tenant_rows = (
        await session.scalars(select(AITenantOverride).order_by(AITenantOverride.created_at.asc()))
    ).all()
    for row in tenant_rows:
        payload.append(
            {
                "id": str(row.id),
                "source_type": "tenant",
                "level": "Платформа",
                "target": row.metadata_json.get("target_label") or row.tenant_key,
                "mode": row.mode_label,
                "provider": row.provider_slug,
                "model_key": row.model_key,
                "route_slug": row.route_slug,
                "tenant_key": row.tenant_key,
                "enabled": row.enabled,
            }
        )

    clinic_rows = (
        await session.scalars(select(AIClinicOverride).order_by(AIClinicOverride.created_at.asc()))
    ).all()
    for row in clinic_rows:
        payload.append(
            {
                "id": str(row.id),
                "source_type": "clinic",
                "level": "Клиника",
                "target": row.metadata_json.get("target_label") or clinics.get(row.clinic_id, "Клиника"),
                "mode": row.mode_label,
                "provider": row.provider_slug,
                "model_key": row.model_key,
                "route_slug": row.route_slug,
                "clinic_id": str(row.clinic_id),
                "enabled": row.enabled,
            }
        )

    role_rows = (
        await session.scalars(select(AIRolePolicy).order_by(AIRolePolicy.created_at.asc()))
    ).all()
    for row in role_rows:
        payload.append(
            {
                "id": str(row.id),
                "source_type": "role",
                "level": "Роль",
                "target": row.metadata_json.get("target_label") or _role_label(row.role),
                "mode": row.mode_label,
                "provider": row.provider_slug,
                "route_slug": row.route_slug,
                "role": row.role,
                "enabled": row.enabled,
            }
        )

    return payload


async def _serialize_guardrails(session: AsyncSession) -> dict:
    budget = await _ensure_platform_budget(session)
    limit = await _ensure_platform_limit(session)
    return {
        "monthlyBudget": budget.monthly_budget,
        "hardLimit": budget.hard_limit,
        "currency": budget.currency,
        "maxOwnerRequestsPerHour": limit.max_owner_requests_per_hour,
        "maxVetRequestsPerHour": limit.max_vet_requests_per_hour,
        "piiRedaction": limit.pii_redaction,
        "promptAudit": limit.prompt_audit,
        "fallbackMode": limit.fallback_mode,
    }


async def _serialize_prompt_library(session: AsyncSession) -> list[dict]:
    prompts = (await session.scalars(select(AIPrompt).order_by(AIPrompt.slug.asc()))).all()
    prompt_ids = [row.id for row in prompts]
    if not prompt_ids:
        return []
    versions = (
        await session.scalars(
            select(AIPromptVersion)
            .where(AIPromptVersion.prompt_id.in_(prompt_ids), AIPromptVersion.is_active.is_(True))
            .order_by(AIPromptVersion.created_at.desc())
        )
    ).all()
    active_versions: dict[uuid.UUID, AIPromptVersion] = {}
    for version in versions:
        active_versions.setdefault(version.prompt_id, version)
    return [
        {
            "id": str(prompt.id),
            "slug": prompt.slug,
            "name": prompt.name,
            "route_slug": prompt.route_slug,
            "active_version": active_versions.get(prompt.id).version_number if active_versions.get(prompt.id) else None,
            "active_title": active_versions.get(prompt.id).title if active_versions.get(prompt.id) else None,
        }
        for prompt in prompts
    ]


async def _serialize_usage_summary(session: AsyncSession) -> dict:
    cutoff = _utcnow() - timedelta(days=30)
    totals = (
        await session.execute(
            select(
                func.coalesce(func.sum(AIUsageLog.request_count), 0),
                func.coalesce(func.sum(AIUsageLog.estimated_cost), 0.0),
                func.coalesce(func.sum(case((AIUsageLog.status != "ok", 1), else_=0)), 0),
            ).where(AIUsageLog.created_at >= cutoff)
        )
    ).one()
    top_routes = (
        await session.execute(
            select(AIUsageLog.route_slug, func.coalesce(func.sum(AIUsageLog.request_count), 0).label("requests"))
            .where(AIUsageLog.created_at >= cutoff)
            .group_by(AIUsageLog.route_slug)
            .order_by(func.sum(AIUsageLog.request_count).desc())
            .limit(5)
        )
    ).all()
    return {
        "window_days": 30,
        "requests": int(totals[0] or 0),
        "estimated_cost": float(totals[1] or 0),
        "error_count": int(totals[2] or 0),
        "top_routes": [
            {"route_slug": row[0], "requests": int(row[1] or 0)}
            for row in top_routes
            if row[0]
        ],
    }


async def _serialize_recent_usage(session: AsyncSession) -> list[dict]:
    clinic_rows = (await session.scalars(select(Clinic))).all()
    clinics_by_id = {str(row.id): row for row in clinic_rows}
    route_rows = (await session.scalars(select(AIRoute))).all()
    scenario_by_slug = {
        row.slug: row.scenario_name for row in route_rows
    }
    for slug, config in default_ai_route_payloads_map().items():
        scenario_by_slug.setdefault(slug, config["scenario"])

    rows = (
        await session.scalars(
            select(AIUsageLog)
            .order_by(AIUsageLog.created_at.desc())
            .limit(40)
        )
    ).all()

    status_labels = {
        "ok": "Успешно",
        "policy_violation": "Заблокировано политикой",
        "http_error": "Ошибка сценария",
        "runtime_error": "Сбой runtime",
    }

    payload: list[dict] = []
    for row in rows:
        clinic = clinics_by_id.get(str(row.clinic_id)) if row.clinic_id else None
        metadata = row.metadata_json or {}
        payload.append(
            {
                "id": str(row.id),
                "created_at": row.created_at.isoformat() if row.created_at else None,
                "route_slug": row.route_slug,
                "scenario": scenario_by_slug.get(row.route_slug, row.route_slug or "AI-сценарий"),
                "clinic_id": str(row.clinic_id) if row.clinic_id else None,
                "clinic_name": clinic.name if clinic else "Платформа",
                "provider_slug": row.provider_slug,
                "model_key": row.model_key,
                "role_scope": _role_label(row.role_scope),
                "status": row.status,
                "status_label": status_labels.get(row.status, row.status or "—"),
                "latency_ms": row.latency_ms,
                "estimated_cost": float(row.estimated_cost or 0.0),
                "fallback_used": bool(metadata.get("fallback_used")),
                "blocked": bool(metadata.get("blocked")) or row.status == "policy_violation",
            }
        )
    return payload


async def _serialize_route_health(session: AsyncSession) -> list[dict]:
    cutoff = _utcnow() - timedelta(days=14)
    route_rows = (await session.scalars(select(AIRoute).order_by(AIRoute.created_at.asc(), AIRoute.slug.asc()))).all()
    defaults = default_ai_route_payloads_map()
    usage_rows = (
        await session.execute(
            select(
                AIUsageLog.route_slug,
                func.coalesce(func.sum(AIUsageLog.request_count), 0).label("requests"),
                func.coalesce(func.sum(AIUsageLog.estimated_cost), 0.0).label("cost"),
                func.coalesce(func.avg(AIUsageLog.latency_ms), 0).label("latency"),
                func.coalesce(func.sum(case((AIUsageLog.status != "ok", 1), else_=0)), 0).label("issues"),
                func.max(AIUsageLog.created_at).label("last_seen"),
            )
            .where(AIUsageLog.created_at >= cutoff)
            .group_by(AIUsageLog.route_slug)
        )
    ).all()
    usage_by_slug = {row[0]: row for row in usage_rows if row[0]}

    route_payloads: list[dict] = []
    seen_slugs: set[str] = set()
    for route in route_rows:
        seen_slugs.add(route.slug)
        usage = usage_by_slug.get(route.slug)
        route_payloads.append(
            {
                "route_slug": route.slug,
                "scenario": route.scenario_name,
                "role_scope": _role_label(route.role_scope),
                "provider_slug": route.primary_provider_slug,
                "fallback_provider_slug": route.fallback_provider_slug,
                "requests": int((usage[1] if usage else 0) or 0),
                "estimated_cost": float((usage[2] if usage else 0.0) or 0.0),
                "avg_latency_ms": int(round(float((usage[3] if usage else 0) or 0))),
                "issue_count": int((usage[4] if usage else 0) or 0),
                "last_seen": usage[5].isoformat() if usage and usage[5] else None,
            }
        )

    for slug, config in defaults.items():
        if slug in seen_slugs:
            continue
        usage = usage_by_slug.get(slug)
        route_payloads.append(
            {
                "route_slug": slug,
                "scenario": config["scenario"],
                "role_scope": _role_label(config.get("role_scope")),
                "provider_slug": config["primary"],
                "fallback_provider_slug": config.get("fallback"),
                "requests": int((usage[1] if usage else 0) or 0),
                "estimated_cost": float((usage[2] if usage else 0.0) or 0.0),
                "avg_latency_ms": int(round(float((usage[3] if usage else 0) or 0))),
                "issue_count": int((usage[4] if usage else 0) or 0),
                "last_seen": usage[5].isoformat() if usage and usage[5] else None,
            }
        )
    route_payloads.sort(key=lambda row: (-row["requests"], row["scenario"]))
    return route_payloads


async def _serialize_clinic_usage(session: AsyncSession) -> list[dict]:
    cutoff = _utcnow() - timedelta(days=30)
    clinic_rows = (await session.scalars(select(Clinic).order_by(Clinic.name.asc()))).all()
    override_counts = {
        row[0]: int(row[1] or 0)
        for row in (
            await session.execute(
                select(AIClinicOverride.clinic_id, func.count(AIClinicOverride.id))
                .group_by(AIClinicOverride.clinic_id)
            )
        ).all()
    }
    usage_rows = {
        row[0]: row
        for row in (
            await session.execute(
                select(
                    AIUsageLog.clinic_id,
                    func.coalesce(func.sum(AIUsageLog.request_count), 0).label("requests"),
                    func.coalesce(func.sum(AIUsageLog.estimated_cost), 0.0).label("cost"),
                    func.coalesce(func.sum(case((AIUsageLog.status != "ok", 1), else_=0)), 0).label("errors"),
                )
                .where(AIUsageLog.created_at >= cutoff, AIUsageLog.clinic_id.is_not(None))
                .group_by(AIUsageLog.clinic_id)
            )
        ).all()
    }
    payload: list[dict] = []
    for clinic in clinic_rows:
        usage = usage_rows.get(clinic.id)
        payload.append(
            {
                "clinic_id": str(clinic.id),
                "clinic_name": clinic.name,
                "city": clinic.city,
                "requests": int((usage[1] if usage else 0) or 0),
                "estimated_cost": float((usage[2] if usage else 0.0) or 0.0),
                "errors": int((usage[3] if usage else 0) or 0),
                "overrides": override_counts.get(clinic.id, 0),
            }
        )
    return payload


async def _serialize_override_summary(session: AsyncSession) -> list[dict]:
    clinics = {row.id: row.name for row in (await session.scalars(select(Clinic))).all()}
    payload: list[dict] = []

    tenant_rows = (await session.scalars(select(AITenantOverride).order_by(AITenantOverride.created_at.asc()))).all()
    for row in tenant_rows:
        payload.append(
            {
                "id": str(row.id),
                "level": "Платформа",
                "target": row.metadata_json.get("target_label") or row.tenant_key,
                "route_slug": row.route_slug or "all",
                "provider_slug": row.provider_slug or "inherit",
                "model_key": row.model_key or "inherit",
                "mode_label": row.mode_label,
                "enabled": row.enabled,
            }
        )

    clinic_rows = (await session.scalars(select(AIClinicOverride).order_by(AIClinicOverride.created_at.asc()))).all()
    for row in clinic_rows:
        payload.append(
            {
                "id": str(row.id),
                "level": "Клиника",
                "target": row.metadata_json.get("target_label") or clinics.get(row.clinic_id, "Клиника"),
                "route_slug": row.route_slug or "all",
                "provider_slug": row.provider_slug or "inherit",
                "model_key": row.model_key or "inherit",
                "mode_label": row.mode_label,
                "enabled": row.enabled,
            }
        )

    role_rows = (await session.scalars(select(AIRolePolicy).order_by(AIRolePolicy.created_at.asc()))).all()
    for row in role_rows:
        payload.append(
            {
                "id": str(row.id),
                "level": "Роль",
                "target": row.metadata_json.get("target_label") or _role_label(row.role),
                "route_slug": row.route_slug or "all",
                "provider_slug": row.provider_slug or "inherit",
                "model_key": "inherit",
                "mode_label": row.mode_label,
                "enabled": row.enabled,
            }
        )
    return payload


async def _serialize_clinics(session: AsyncSession) -> list[dict]:
    rows = (await session.scalars(select(Clinic).order_by(Clinic.name.asc()))).all()
    return [{"id": str(row.id), "name": row.name, "city": row.city} for row in rows]


def default_ai_route_payloads_map() -> dict[str, dict]:
    return {row["slug"]: row for row in default_ai_route_payloads()}


@router.get("/control-plane")
async def get_control_plane(
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    payload = {
        "providers": await _serialize_providers(db),
        "routing": await _serialize_routes(db),
        "overrides": await _serialize_overrides(db),
        "guardrails": await _serialize_guardrails(db),
        "prompts": await _serialize_prompt_library(db),
        "usage_summary": await _serialize_usage_summary(db),
        "recent_usage": await _serialize_recent_usage(db),
        "route_health": await _serialize_route_health(db),
        "clinic_usage": await _serialize_clinic_usage(db),
        "override_summary": await _serialize_override_summary(db),
        "clinics": await _serialize_clinics(db),
    }
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="platform.ai_control_plane.view",
        target_type="ai_control_plane",
        target_id=None,
    )
    await db.commit()
    return payload


def _sync_provider_models(provider: AIProvider, provider_payload: PlatformAIProviderPayload) -> list[AIModel]:
    rows: list[AIModel] = []
    models = list(dict.fromkeys(provider_payload.models))
    if provider_payload.default_model and provider_payload.default_model not in models:
        models.insert(0, provider_payload.default_model)
    if provider_payload.fallback and provider_payload.fallback not in models:
        models.append(provider_payload.fallback)
    for index, model_key in enumerate(models):
        rows.append(
            AIModel(
                provider_id=provider.id,
                model_key=model_key,
                display_name=model_key,
                status="active",
                context_window=None,
                supports_json_mode=True,
                supports_vision="vision" in model_key.lower(),
                supports_audio="audio" in model_key.lower(),
                is_default=model_key == provider_payload.default_model or (index == 0 and provider_payload.default_model is None),
                is_fallback=model_key == provider_payload.fallback,
                metadata_json={},
            )
        )
    return rows


def _slugify(value: str, fallback: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return slug or fallback


def _resolve_provider_model(provider_payload: PlatformAIProviderPayload, explicit: str | None, fallback_to_fallback: bool = False) -> str:
    if explicit:
        return explicit
    if provider_payload.default_model:
        return provider_payload.default_model
    if provider_payload.models:
        return provider_payload.models[0]
    if fallback_to_fallback and provider_payload.fallback:
        return provider_payload.fallback
    if provider_payload.fallback:
        return provider_payload.fallback
    return f"{provider_payload.slug}-default"


@router.put("/control-plane")
async def update_control_plane(
    payload: PlatformAIControlPlaneUpdate,
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    guardrails = payload.guardrails
    if any(
        value < 0
        for value in (
            guardrails.monthlyBudget,
            guardrails.hardLimit,
            guardrails.maxOwnerRequestsPerHour,
            guardrails.maxVetRequestsPerHour,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "BAD_REQUEST",
                "message": "Guardrail limits must be non-negative.",
            },
        )

    clinic_rows = (await db.scalars(select(Clinic).order_by(Clinic.name.asc()))).all()
    clinics_by_id = {str(row.id): row for row in clinic_rows}
    clinics_by_name = {row.name.lower(): row for row in clinic_rows}

    await db.execute(delete(AIModel))
    await db.execute(delete(AIRoute))
    await db.execute(delete(AIPolicy))
    await db.execute(delete(AITenantOverride))
    await db.execute(delete(AIClinicOverride))
    await db.execute(delete(AIRolePolicy))
    await db.execute(delete(AIProvider))
    await db.flush()

    providers_by_slug: dict[str, PlatformAIProviderPayload] = {}
    for provider_payload in payload.providers:
        slug = provider_payload.slug.strip()
        if not slug:
            continue
        providers_by_slug[slug] = provider_payload
        provider = AIProvider(
            slug=slug,
            name=provider_payload.name,
            provider_type=provider_payload.provider_type or ("local" if slug == "local" else "remote"),
            status=provider_payload.status or "active",
            routing_summary=provider_payload.routing or "",
            capabilities_json=list(provider_payload.capabilities or []),
            default_model_key=_resolve_provider_model(provider_payload, provider_payload.default_model),
            fallback_model_key=_resolve_provider_model(provider_payload, provider_payload.fallback, fallback_to_fallback=True),
            is_local=(provider_payload.provider_type == "local" or slug == "local"),
        )
        db.add(provider)
        await db.flush()
        for model in _sync_provider_models(provider, provider_payload):
            db.add(model)

    seen_policy_slugs: set[str] = set()
    policy_slug_by_name: dict[str, str] = {}
    for route_payload in payload.routing:
        policy_name = (route_payload.policy or "").strip()
        if not policy_name:
            continue
        key = policy_name.lower()
        if key in policy_slug_by_name:
            continue
        slug = _slugify(policy_name, "policy")
        if slug in seen_policy_slugs:
            index = 2
            while f"{slug}-{index}" in seen_policy_slugs:
                index += 1
            slug = f"{slug}-{index}"
        seen_policy_slugs.add(slug)
        policy_slug_by_name[key] = slug
        db.add(
            AIPolicy(
                slug=slug,
                name=policy_name,
                description=policy_name,
                role_scope=route_payload.role_scope,
                guardrails_json={},
            )
        )
    await db.flush()

    for route_payload in payload.routing:
        provider_payload = providers_by_slug.get(route_payload.primary)
        if not provider_payload and providers_by_slug:
            provider_payload = next(iter(providers_by_slug.values()))
        if not provider_payload:
            continue

        fallback_payload = providers_by_slug.get(route_payload.fallback or "")
        primary_slug = provider_payload.slug
        fallback_slug = fallback_payload.slug if fallback_payload else (route_payload.fallback or None)
        primary_model = _resolve_provider_model(provider_payload, route_payload.primary_model)
        fallback_model = (
            _resolve_provider_model(fallback_payload, route_payload.fallback_model, fallback_to_fallback=True)
            if fallback_payload
            else route_payload.fallback_model
        )

        db.add(
            AIRoute(
                slug=route_payload.slug or _slugify(route_payload.scenario_key or route_payload.scenario, "route"),
                scenario_key=route_payload.scenario_key,
                scenario_name=route_payload.scenario,
                role_scope=route_payload.role_scope,
                primary_provider_slug=primary_slug,
                primary_model_key=primary_model,
                fallback_provider_slug=fallback_slug,
                fallback_model_key=fallback_model,
                policy_slug=policy_slug_by_name.get((route_payload.policy or "").strip().lower()),
                enabled=route_payload.enabled,
                metadata_json={},
            )
        )

    for override_payload in payload.overrides:
        source_type = (override_payload.source_type or "").strip().lower()
        common_metadata = {"target_label": override_payload.target}
        if source_type == "tenant":
            db.add(
                AITenantOverride(
                    tenant_key=override_payload.tenant_key or _slugify(override_payload.target or "platform", "platform"),
                    route_slug=override_payload.route_slug,
                    provider_slug=override_payload.provider,
                    model_key=override_payload.model_key,
                    mode_label=override_payload.mode,
                    enabled=override_payload.enabled,
                    metadata_json=common_metadata,
                )
            )
            continue

        if source_type == "clinic":
            clinic = clinics_by_id.get(str(override_payload.clinic_id or "")) if override_payload.clinic_id else None
            if not clinic and override_payload.target:
                clinic = clinics_by_name.get(override_payload.target.strip().lower())
            if not clinic:
                clinic = clinic_rows[0] if clinic_rows else None
            if clinic:
                db.add(
                    AIClinicOverride(
                        clinic_id=clinic.id,
                        route_slug=override_payload.route_slug,
                        provider_slug=override_payload.provider,
                        model_key=override_payload.model_key,
                        mode_label=override_payload.mode,
                        enabled=override_payload.enabled,
                        metadata_json=common_metadata,
                    )
                )
            continue

        if source_type == "role":
            role_value = override_payload.role or {
                "владелец": "owner",
                "ветеринарный врач": "vet",
                "администратор клиники": "clinic_admin",
                "платформа": "network_admin",
            }.get((override_payload.target or "").strip().lower(), "owner")
            db.add(
                AIRolePolicy(
                    role=role_value,
                    policy_slug=None,
                    route_slug=override_payload.route_slug,
                    provider_slug=override_payload.provider,
                    mode_label=override_payload.mode,
                    enabled=override_payload.enabled,
                    metadata_json=common_metadata,
                )
            )

    budget = await _ensure_platform_budget(db)
    budget.monthly_budget = payload.guardrails.monthlyBudget
    budget.hard_limit = payload.guardrails.hardLimit
    budget.currency = payload.guardrails.currency or "USD"

    limit = await _ensure_platform_limit(db)
    limit.max_owner_requests_per_hour = payload.guardrails.maxOwnerRequestsPerHour
    limit.max_vet_requests_per_hour = payload.guardrails.maxVetRequestsPerHour
    limit.prompt_audit = payload.guardrails.promptAudit
    limit.pii_redaction = payload.guardrails.piiRedaction
    limit.fallback_mode = payload.guardrails.fallbackMode or "strict"

    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="platform.ai_control_plane.update",
        target_type="ai_control_plane",
        target_id=None,
        metadata={
            "providers": len(payload.providers),
            "routes": len(payload.routing),
            "overrides": len(payload.overrides),
        },
    )
    await db.commit()

    return {
        "providers": await _serialize_providers(db),
        "routing": await _serialize_routes(db),
        "overrides": await _serialize_overrides(db),
        "guardrails": await _serialize_guardrails(db),
        "prompts": await _serialize_prompt_library(db),
        "usage_summary": await _serialize_usage_summary(db),
        "recent_usage": await _serialize_recent_usage(db),
        "route_health": await _serialize_route_health(db),
        "clinic_usage": await _serialize_clinic_usage(db),
        "override_summary": await _serialize_override_summary(db),
        "clinics": await _serialize_clinics(db),
    }
