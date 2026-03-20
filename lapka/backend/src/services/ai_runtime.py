from __future__ import annotations

import inspect
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import (
    AIBudget,
    AIClinicOverride,
    AILimit,
    AIPrompt,
    AIPromptVersion,
    AIRolePolicy,
    AIRoute,
    AIUsageLog,
    Membership,
    MembershipStatus,
    RoleEnum,
    User,
)

DEFAULT_ROUTE_CONFIGS: dict[str, dict[str, Any]] = {
    "owner-triage": {
        "scenario_name": "Срочность владельца",
        "role_scope": "owner",
        "primary_provider_slug": "openai",
        "primary_model_key": "gpt-5-mini",
        "fallback_provider_slug": "anthropic",
        "fallback_model_key": "claude-3.7-sonnet",
        "policy_slug": "owner-safe-mode",
    },
    "doc-explain": {
        "scenario_name": "Объяснение документов",
        "role_scope": None,
        "primary_provider_slug": "openai",
        "primary_model_key": "gpt-5-mini",
        "fallback_provider_slug": "gemini",
        "fallback_model_key": "gemini-2.5-flash",
        "policy_slug": "document-explain-safe",
    },
    "vet-notes": {
        "scenario_name": "Структурирование заметок врача",
        "role_scope": "vet",
        "primary_provider_slug": "anthropic",
        "primary_model_key": "claude-3.7-sonnet",
        "fallback_provider_slug": "openai",
        "fallback_model_key": "gpt-5-mini",
        "policy_slug": "vet-internal-only",
    },
    "note-structure": {
        "scenario_name": "Структурирование клинических заметок",
        "role_scope": "vet",
        "primary_provider_slug": "anthropic",
        "primary_model_key": "claude-3.7-sonnet",
        "fallback_provider_slug": "openai",
        "fallback_model_key": "gpt-5-mini",
        "policy_slug": "vet-internal-only",
    },
    "visit-structure": {
        "scenario_name": "Структурирование визита по расшифровке",
        "role_scope": "vet",
        "primary_provider_slug": "anthropic",
        "primary_model_key": "claude-3.7-sonnet",
        "fallback_provider_slug": "openai",
        "fallback_model_key": "gpt-5-mini",
        "policy_slug": "vet-internal-only",
    },
    "audio-transcribe": {
        "scenario_name": "Транскрибация аудио визита",
        "role_scope": "vet",
        "primary_provider_slug": "openai",
        "primary_model_key": "gpt-5-mini",
        "fallback_provider_slug": "anthropic",
        "fallback_model_key": "claude-3.7-sonnet",
        "policy_slug": "vet-internal-only",
    },
    "lab-explain": {
        "scenario_name": "Объяснение лабораторного текста для врача",
        "role_scope": "vet",
        "primary_provider_slug": "gemini",
        "primary_model_key": "gemini-2.5-flash",
        "fallback_provider_slug": "openai",
        "fallback_model_key": "gpt-5-mini",
        "policy_slug": "lab-explain-vet-safe",
    },
    "protocol-completeness": {
        "scenario_name": "Проверка полноты протокола",
        "role_scope": "vet",
        "primary_provider_slug": "openai",
        "primary_model_key": "gpt-5-mini",
        "fallback_provider_slug": "anthropic",
        "fallback_model_key": "claude-3.7-sonnet",
        "policy_slug": "vet-internal-only",
    },
    "knowledge-search": {
        "scenario_name": "Поиск по знаниям и справочникам",
        "role_scope": "vet",
        "primary_provider_slug": "gemini",
        "primary_model_key": "gemini-2.5-flash",
        "fallback_provider_slug": "openai",
        "fallback_model_key": "gpt-5-mini",
        "policy_slug": "grounded-knowledge-only",
    },
}

DEFAULT_LIMITS = {
    "max_owner_requests_per_hour": 1600,
    "max_vet_requests_per_hour": 900,
    "pii_redaction": True,
    "prompt_audit": True,
    "fallback_mode": "strict",
}

DEFAULT_BUDGET = {
    "monthly_budget": 4800,
    "hard_limit": 6200,
    "currency": "USD",
    "current_spend": 0.0,
}

ROUTE_COST_HINTS = {
    "owner-triage": 0.006,
    "doc-explain": 0.009,
    "vet-notes": 0.012,
    "note-structure": 0.012,
    "visit-structure": 0.013,
    "audio-transcribe": 0.011,
    "lab-explain": 0.01,
    "protocol-completeness": 0.008,
    "knowledge-search": 0.010,
}


@dataclass
class AIRuntimeExecution:
    route_slug: str
    scenario_name: str
    clinic_id: str | None
    provider_slug: str
    model_key: str
    fallback_provider_slug: str | None
    fallback_model_key: str | None
    policy_slug: str | None
    prompt_title: str | None
    prompt_version: int | None
    role_scope: str
    pii_redaction: bool
    prompt_audit: bool
    fallback_mode: str
    estimated_cost: float
    metadata: dict[str, Any]


@dataclass
class AIRunResult:
    execution: AIRuntimeExecution
    result: Any
    latency_ms: int


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def default_ai_route_payloads() -> list[dict[str, Any]]:
    payloads: list[dict[str, Any]] = []
    for slug, config in DEFAULT_ROUTE_CONFIGS.items():
        payloads.append(
            {
                "id": None,
                "slug": slug,
                "scenario_key": slug,
                "scenario": config["scenario_name"],
                "role_scope": config.get("role_scope"),
                "primary": config["primary_provider_slug"],
                "primary_model": config["primary_model_key"],
                "fallback": config.get("fallback_provider_slug"),
                "fallback_model": config.get("fallback_model_key"),
                "policy": config.get("policy_slug"),
                "enabled": True,
            }
        )
    return payloads


def _json_safe(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


async def _infer_clinic_id(session: AsyncSession, current_user: User) -> str | None:
    # if the access token carried a clinic claim, trust it first
    if getattr(current_user, "clinic_id", None):
        return str(current_user.clinic_id)

    if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin, RoleEnum.network_admin}:
        return None

    # fall back to the earliest active membership if no claim present
    membership = await session.scalar(
        select(Membership)
        .where(Membership.user_id == current_user.id, Membership.status == MembershipStatus.active)
        .order_by(Membership.created_at.asc())
        .limit(1)
    )
    return str(membership.clinic_id) if membership else None


async def _load_route(session: AsyncSession, route_slug: str) -> AIRoute | None:
    return await session.scalar(
        select(AIRoute).where(
            (AIRoute.slug == route_slug) | (AIRoute.scenario_key == route_slug)
        )
    )


async def _load_prompt(session: AsyncSession, route_slug: str) -> tuple[str | None, int | None]:
    prompt = await session.scalar(select(AIPrompt).where(AIPrompt.route_slug == route_slug).limit(1))
    if not prompt:
        return None, None
    version = await session.scalar(
        select(AIPromptVersion)
        .where(AIPromptVersion.prompt_id == prompt.id, AIPromptVersion.is_active.is_(True))
        .order_by(AIPromptVersion.version_number.desc())
        .limit(1)
    )
    if not version:
        return prompt.name, None
    return version.title, version.version_number


async def _load_limits(session: AsyncSession, clinic_id: str | None) -> AILimit | None:
    if clinic_id:
        row = await session.scalar(
            select(AILimit).where(AILimit.scope_type == "clinic", AILimit.scope_key == clinic_id).limit(1)
        )
        if row:
            return row
    return await session.scalar(
        select(AILimit).where(AILimit.scope_type == "platform", AILimit.scope_key.is_(None)).limit(1)
    )


async def _load_budget(session: AsyncSession, clinic_id: str | None) -> AIBudget | None:
    if clinic_id:
        row = await session.scalar(
            select(AIBudget).where(AIBudget.scope_type == "clinic", AIBudget.scope_key == clinic_id).limit(1)
        )
        if row:
            return row
    return await session.scalar(
        select(AIBudget).where(AIBudget.scope_type == "platform", AIBudget.scope_key.is_(None)).limit(1)
    )


async def _load_clinic_override(session: AsyncSession, clinic_id: str | None, route_slug: str) -> AIClinicOverride | None:
    if not clinic_id:
        return None
    return await session.scalar(
        select(AIClinicOverride)
        .where(
            AIClinicOverride.clinic_id == clinic_id,
            AIClinicOverride.enabled.is_(True),
            (AIClinicOverride.route_slug == route_slug) | (AIClinicOverride.route_slug.is_(None)),
        )
        .order_by(AIClinicOverride.route_slug.desc())
        .limit(1)
    )


async def _load_role_override(session: AsyncSession, role: RoleEnum, route_slug: str) -> AIRolePolicy | None:
    return await session.scalar(
        select(AIRolePolicy)
        .where(
            AIRolePolicy.role == role.value,
            AIRolePolicy.enabled.is_(True),
            (AIRolePolicy.route_slug == route_slug) | (AIRolePolicy.route_slug.is_(None)),
        )
        .order_by(AIRolePolicy.route_slug.desc())
        .limit(1)
    )


async def _enforce_rate_limit(
    session: AsyncSession,
    *,
    actor_user_id: str | None,
    role: RoleEnum,
    max_owner_requests_per_hour: int,
    max_vet_requests_per_hour: int,
) -> None:
    if not actor_user_id:
        return

    limit = max_owner_requests_per_hour if role == RoleEnum.owner else max_vet_requests_per_hour
    if limit <= 0:
        return

    cutoff = _utcnow() - timedelta(hours=1)
    used = await session.scalar(
        select(func.coalesce(func.sum(AIUsageLog.request_count), 0)).where(
            AIUsageLog.actor_user_id == actor_user_id,
            AIUsageLog.created_at >= cutoff,
        )
    )
    if int(used or 0) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "AI_RATE_LIMIT", "message": "Лимит AI-запросов для роли исчерпан."},
        )


def _estimate_cost(route_slug: str, payload_size: int) -> float:
    base = ROUTE_COST_HINTS.get(route_slug, 0.008)
    size_factor = max(0.0, payload_size / 4000)
    return round(base + min(0.02, size_factor * 0.004), 4)


async def prepare_ai_execution(
    session: AsyncSession,
    *,
    current_user: User,
    route_slug: str,
    payload_size: int = 0,
    metadata: dict[str, Any] | None = None,
) -> AIRuntimeExecution:
    clinic_id = await _infer_clinic_id(session, current_user)
    route = await _load_route(session, route_slug)
    defaults = DEFAULT_ROUTE_CONFIGS.get(route_slug, DEFAULT_ROUTE_CONFIGS["vet-notes"])

    if route and not route.enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_ROUTE_DISABLED", "message": "Сценарий AI временно отключён."},
        )

    provider_slug = route.primary_provider_slug if route else defaults["primary_provider_slug"]
    model_key = route.primary_model_key if route else defaults["primary_model_key"]
    fallback_provider_slug = route.fallback_provider_slug if route else defaults["fallback_provider_slug"]
    fallback_model_key = route.fallback_model_key if route else defaults["fallback_model_key"]
    policy_slug = route.policy_slug if route else defaults["policy_slug"]
    scenario_name = route.scenario_name if route else defaults["scenario_name"]
    role_scope = route.role_scope if route and route.role_scope else current_user.role.value

    clinic_override = await _load_clinic_override(session, clinic_id, route_slug)
    if clinic_override:
        provider_slug = clinic_override.provider_slug or provider_slug
        model_key = clinic_override.model_key or model_key

    role_override = await _load_role_override(session, current_user.role, route_slug)
    if role_override:
        if not role_override.enabled:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "AI_POLICY_BLOCK", "message": "Сценарий AI недоступен для этой роли."},
            )
        provider_slug = role_override.provider_slug or provider_slug
        policy_slug = role_override.policy_slug or policy_slug

    limits = await _load_limits(session, clinic_id)
    limit_config = {
        "max_owner_requests_per_hour": limits.max_owner_requests_per_hour if limits else DEFAULT_LIMITS["max_owner_requests_per_hour"],
        "max_vet_requests_per_hour": limits.max_vet_requests_per_hour if limits else DEFAULT_LIMITS["max_vet_requests_per_hour"],
        "pii_redaction": limits.pii_redaction if limits else DEFAULT_LIMITS["pii_redaction"],
        "prompt_audit": limits.prompt_audit if limits else DEFAULT_LIMITS["prompt_audit"],
        "fallback_mode": limits.fallback_mode if limits else DEFAULT_LIMITS["fallback_mode"],
    }

    await _enforce_rate_limit(
        session,
        actor_user_id=str(current_user.id),
        role=current_user.role,
        max_owner_requests_per_hour=limit_config["max_owner_requests_per_hour"],
        max_vet_requests_per_hour=limit_config["max_vet_requests_per_hour"],
    )

    budget = await _load_budget(session, clinic_id)
    budget_limit = float(budget.hard_limit if budget else DEFAULT_BUDGET["hard_limit"])
    current_spend = float(budget.current_spend if budget else DEFAULT_BUDGET["current_spend"])
    estimated_cost = _estimate_cost(route_slug, payload_size)
    if budget_limit > 0 and (current_spend + estimated_cost) > budget_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "AI_BUDGET_EXCEEDED", "message": "Превышен бюджет AI-контура."},
        )

    prompt_title, prompt_version = await _load_prompt(session, route_slug)
    runtime_metadata = {
        "clinic_override": bool(clinic_override),
        "role_override": bool(role_override),
        "clinic_id": clinic_id,
        "payload_size": payload_size,
    }
    if metadata:
        runtime_metadata.update(_json_safe(metadata))

    return AIRuntimeExecution(
        route_slug=route.slug if route else route_slug,
        scenario_name=scenario_name,
        clinic_id=clinic_id,
        provider_slug=provider_slug,
        model_key=model_key,
        fallback_provider_slug=fallback_provider_slug,
        fallback_model_key=fallback_model_key,
        policy_slug=policy_slug,
        prompt_title=prompt_title,
        prompt_version=prompt_version,
        role_scope=role_scope,
        pii_redaction=limit_config["pii_redaction"],
        prompt_audit=limit_config["prompt_audit"],
        fallback_mode=limit_config["fallback_mode"],
        estimated_cost=estimated_cost,
        metadata=runtime_metadata,
    )


async def record_ai_usage(
    session: AsyncSession,
    *,
    current_user: User,
    execution: AIRuntimeExecution,
    status_label: str = "ok",
    latency_ms: int | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    usage_metadata = dict(execution.metadata)
    if metadata:
        usage_metadata.update(_json_safe(metadata))

    session.add(
        AIUsageLog(
            actor_user_id=current_user.id,
            clinic_id=execution.clinic_id,
            route_slug=execution.route_slug,
            provider_slug=execution.provider_slug,
            model_key=execution.model_key,
            role_scope=execution.role_scope,
            request_count=1,
            estimated_cost=execution.estimated_cost,
            status=status_label,
            latency_ms=latency_ms,
            metadata_json=usage_metadata,
        )
    )

    budget = await _load_budget(session, execution.clinic_id)
    if budget:
        budget.current_spend = round(float(budget.current_spend or 0.0) + execution.estimated_cost, 4)


async def execute_governed_ai(
    session: AsyncSession,
    *,
    current_user: User,
    route_slug: str,
    payload_size: int = 0,
    metadata: dict[str, Any] | None = None,
    runner,
    success_metadata: dict[str, Any] | None = None,
    failure_message: str = "Сценарий AI временно недоступен.",
) -> AIRunResult:
    execution = await prepare_ai_execution(
        session,
        current_user=current_user,
        route_slug=route_slug,
        payload_size=payload_size,
        metadata=metadata,
    )
    started = perf_counter()
    try:
        result = runner(execution)
        if inspect.isawaitable(result):
            result = await result
    except HTTPException as exc:
        await record_ai_usage(
            session,
            current_user=current_user,
            execution=execution,
            status_label="http_error",
            latency_ms=int((perf_counter() - started) * 1000),
            metadata={
                "http_status": exc.status_code,
                "error_detail": _json_safe(exc.detail),
            },
        )
        raise
    except Exception as exc:
        await record_ai_usage(
            session,
            current_user=current_user,
            execution=execution,
            status_label="runtime_error",
            latency_ms=int((perf_counter() - started) * 1000),
            metadata={"error_type": exc.__class__.__name__},
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "AI_RUNTIME_FAILED", "message": failure_message},
        ) from exc

    latency_ms = int((perf_counter() - started) * 1000)
    await record_ai_usage(
        session,
        current_user=current_user,
        execution=execution,
        latency_ms=latency_ms,
        metadata=success_metadata,
    )
    return AIRunResult(execution=execution, result=result, latency_ms=latency_ms)
