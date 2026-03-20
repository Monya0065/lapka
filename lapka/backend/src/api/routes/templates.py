from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.sanitize import sanitize_list, sanitize_text
from src.db.session import get_db_session
from src.models import Clinic, RoleEnum, Template, User
from src.security.deps import get_current_user, require_clinic_membership, require_roles
from src.services.audit import log_audit

router = APIRouter(prefix="", tags=["templates"])

SYSTEM_SCOPES = {"clinic", "branch"}
ALL_SCOPES = {"clinic", "branch", "personal"}
ALL_STATUSES = {"draft", "published", "archived"}
ALL_VISIBILITY = {"private", "clinic", "branch", "platform"}


class TemplateCreateRequest(BaseModel):
    template_type: str = Field(min_length=2)
    name: str = Field(min_length=2)
    body: str = Field(min_length=3)
    scope: str = "clinic"
    specialty: str | None = None
    visibility: str = "clinic"
    status: str = "draft"
    scenario_tags: list[str] = Field(default_factory=list)
    source_template_id: str | None = None


class TemplatePatchRequest(BaseModel):
    name: str | None = None
    body: str | None = None
    specialty: str | None = None
    visibility: str | None = None
    status: str | None = None
    scenario_tags: list[str] | None = None
    is_default: bool | None = None


class TemplateCloneRequest(BaseModel):
    name: str | None = None
    scope: str | None = None
    status: str = "draft"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _author_label(row: Template) -> str:
    if row.scope == "branch":
        return "Филиал"
    if row.scope == "personal":
        return "Врач"
    return "Клиника"


def _scope_label(scope: str) -> str:
    return {
        "clinic": "Клиника",
        "branch": "Филиал",
        "personal": "Личный врач",
        "system": "Платформа",
    }.get(scope or "", scope or "—")


def _status_label(status_value: str) -> str:
    return {
        "draft": "Черновик",
        "published": "Опубликован",
        "archived": "Архив",
    }.get(status_value or "", status_value or "—")


def _specialty_label(value: str | None) -> str:
    return {
        "general": "Общая практика",
        "therapy": "Терапия",
        "surgery": "Хирургия",
        "dermatology": "Дерматология",
        "cardiology": "Кардиология",
        "neurology": "Неврология",
        "anesthesia": "Анестезиология",
        "inpatient": "Стационар",
    }.get(value or "", value or "—")


def _serialize(row: Template, *, author_name: str | None = None) -> dict:
    return {
        "id": str(row.id),
        "clinic_id": str(row.clinic_id),
        "template_type": row.template_type,
        "name": row.name,
        "body": row.body,
        "scope": row.scope,
        "specialty": row.specialty,
        "visibility": row.visibility,
        "status": row.status,
        "version": row.version,
        "scenario_tags": list(row.scenario_tags_json or []),
        "created_by": str(row.created_by),
        "source_template_id": str(row.source_template_id) if row.source_template_id else None,
        "is_default": row.is_default,
        "usage_count": row.usage_count,
        "last_used_at": row.last_used_at,
        "author": _author_label(row),
        "author_name": author_name or "Команда клиники",
        "scope_label": _scope_label(row.scope),
        "status_label": _status_label(row.status),
        "specialty_label": _specialty_label(row.specialty),
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def _validate_scope(scope: str) -> str:
    safe = sanitize_text(scope, max_len=32).lower()
    if safe not in ALL_SCOPES:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Некорректный уровень шаблона"})
    return safe


def _validate_status(status_value: str) -> str:
    safe = sanitize_text(status_value, max_len=32).lower()
    if safe not in ALL_STATUSES:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Некорректный статус шаблона"})
    return safe


def _validate_visibility(value: str) -> str:
    safe = sanitize_text(value, max_len=32).lower()
    if safe not in ALL_VISIBILITY:
        raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Некорректная видимость шаблона"})
    return safe


def _validate_template_payload(body: str, name: str) -> tuple[str, str]:
    safe_name = sanitize_text(name, max_len=255)
    safe_body = sanitize_text(body, max_len=20000)
    if not safe_name.strip() or not safe_body.strip():
        raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Шаблон должен содержать название и текст"})
    return safe_name, safe_body


def _validate_scenario_tags(tags: list[str] | None) -> list[str]:
    return sanitize_list(tags or [], max_items=16, max_len=64)


async def _load_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    return await session.scalar(select(User).where(User.id == user_id))


async def _can_view_template(session: AsyncSession, row: Template, current_user) -> bool:
    await require_clinic_membership(session, user_id=current_user.id, clinic_id=row.clinic_id)
    if row.scope != "personal":
        return True
    return current_user.role in {RoleEnum.network_admin} or row.created_by == current_user.id


async def _assert_manage_permissions(session: AsyncSession, row: Template | None, *, current_user, clinic_id: uuid.UUID, scope: str) -> None:
    await require_clinic_membership(session, user_id=current_user.id, clinic_id=clinic_id)

    if current_user.role == RoleEnum.network_admin:
        return

    if scope == "personal":
        if current_user.role not in {RoleEnum.vet, RoleEnum.clinic_admin}:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Недостаточно прав для личного шаблона"})
        if row and row.created_by != current_user.id and current_user.role != RoleEnum.clinic_admin:
            raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Можно управлять только своими личными шаблонами"})
        return

    if current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Изменение этого уровня шаблонов доступно только клинике"})


async def _unset_defaults(
    session: AsyncSession,
    *,
    clinic_id: uuid.UUID,
    scope: str,
    template_type: str,
    specialty: str | None,
    created_by: uuid.UUID | None = None,
) -> None:
    rows = (
        await session.scalars(
            select(Template).where(
                Template.clinic_id == clinic_id,
                Template.scope == scope,
                Template.template_type == template_type,
                Template.deleted_at.is_(None),
            )
        )
    ).all()
    for row in rows:
        if specialty and row.specialty != specialty:
            continue
        if scope == "personal" and created_by and row.created_by != created_by:
            continue
        row.is_default = False


@router.get("/clinics/{clinic_id}/templates")
async def list_templates(
    clinic_id: str,
    scope: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = uuid.UUID(clinic_id)
    if current_user.role == RoleEnum.owner:
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Владелец не управляет шаблонами клиники"})

    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
    q = (
        select(Template)
        .where(Template.clinic_id == clinic_uuid, Template.deleted_at.is_(None))
        .order_by(Template.is_default.desc(), Template.updated_at.desc())
        .limit(300)
    )
    if scope:
        q = q.where(Template.scope == _validate_scope(scope))

    rows = (await db.scalars(q)).all()
    users = (
        await db.scalars(select(User).where(User.id.in_([row.created_by for row in rows] if rows else [])))
    ).all()
    user_by_id = {row.id: row for row in users}
    visible_rows = []
    for row in rows:
        if await _can_view_template(db, row, current_user):
            author = user_by_id.get(row.created_by)
            visible_rows.append(_serialize(row, author_name=author.full_name if author else None))
    return visible_rows


@router.get("/clinics/{clinic_id}/templates/suggestions")
async def suggest_templates(
    clinic_id: str,
    scenario: str | None = Query(default=None),
    specialty: str | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    clinic_uuid = uuid.UUID(clinic_id)
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
    rows = (
        await db.scalars(
            select(Template)
            .where(
                Template.clinic_id == clinic_uuid,
                Template.deleted_at.is_(None),
                Template.status != "archived",
            )
            .order_by(Template.is_default.desc(), Template.usage_count.desc(), Template.updated_at.desc())
            .limit(200)
        )
    ).all()
    safe_scenario = sanitize_text(scenario or "", max_len=64).lower()
    safe_specialty = sanitize_text(specialty or "", max_len=64).lower()
    users = (
        await db.scalars(select(User).where(User.id.in_([row.created_by for row in rows] if rows else [])))
    ).all()
    user_by_id = {row.id: row for row in users}
    result = []
    for row in rows:
        if not await _can_view_template(db, row, current_user):
            continue
        if safe_specialty and (row.specialty or "").lower() not in {"", safe_specialty}:
            continue
        tags = [str(tag).lower() for tag in (row.scenario_tags_json or [])]
        if safe_scenario and tags and safe_scenario not in tags:
            continue
        author = user_by_id.get(row.created_by)
        result.append(_serialize(row, author_name=author.full_name if author else None))
    return result[:20]


@router.post("/clinics/{clinic_id}/templates", status_code=status.HTTP_201_CREATED)
async def create_template(
    clinic_id: str,
    payload: TemplateCreateRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinic_uuid = uuid.UUID(clinic_id)
    scope = _validate_scope(payload.scope)
    await _assert_manage_permissions(db, None, current_user=current_user, clinic_id=clinic_uuid, scope=scope)
    safe_name, safe_body = _validate_template_payload(payload.body, payload.name)

    row = Template(
        clinic_id=clinic_uuid,
        template_type=sanitize_text(payload.template_type, max_len=64),
        name=safe_name,
        body=safe_body,
        scope=scope,
        specialty=sanitize_text(payload.specialty or "", max_len=64) or None,
        visibility=_validate_visibility(payload.visibility),
        status=_validate_status(payload.status),
        version=1,
        source_template_id=uuid.UUID(payload.source_template_id) if payload.source_template_id else None,
        scenario_tags_json=_validate_scenario_tags(payload.scenario_tags),
        created_by=current_user.id,
    )
    db.add(row)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(clinic_uuid),
        action="template.create",
        target_type="template",
        target_id=str(row.id),
        metadata={"scope": scope},
    )
    await db.commit()
    await db.refresh(row)
    author = await _load_user(db, row.created_by)
    return _serialize(row, author_name=author.full_name if author else None)


@router.patch("/templates/{template_id}")
async def patch_template(
    template_id: str,
    payload: TemplatePatchRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})

    await _assert_manage_permissions(db, row, current_user=current_user, clinic_id=row.clinic_id, scope=row.scope)

    if payload.name is not None:
        row.name = sanitize_text(payload.name, max_len=255)
    if payload.body is not None:
        safe_body = sanitize_text(payload.body, max_len=20000)
        if not safe_body.strip():
            raise HTTPException(status_code=422, detail={"code": "VALIDATION", "message": "Template body is required"})
        row.body = safe_body
    if payload.specialty is not None:
        row.specialty = sanitize_text(payload.specialty, max_len=64) or None
    if payload.visibility is not None:
        row.visibility = _validate_visibility(payload.visibility)
    if payload.status is not None:
        row.status = _validate_status(payload.status)
    if payload.scenario_tags is not None:
        row.scenario_tags_json = _validate_scenario_tags(payload.scenario_tags)
    if payload.is_default is not None:
        if payload.is_default:
            await _unset_defaults(
                db,
                clinic_id=row.clinic_id,
                scope=row.scope,
                template_type=row.template_type,
                specialty=row.specialty,
                created_by=row.created_by,
            )
        row.is_default = payload.is_default

    row.version = int(row.version or 1) + 1
    row.updated_at = _utcnow()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="template.update",
        target_type="template",
        target_id=str(row.id),
        metadata={"scope": row.scope},
    )
    await db.commit()
    await db.refresh(row)
    author = await _load_user(db, row.created_by)
    return _serialize(row, author_name=author.full_name if author else None)


@router.post("/templates/{template_id}/clone", status_code=status.HTTP_201_CREATED)
async def clone_template(
    template_id: str,
    payload: TemplateCloneRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    source = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not source:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})

    if not await _can_view_template(db, source, current_user):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Template is not available"})

    target_scope = _validate_scope(payload.scope or source.scope)
    await _assert_manage_permissions(db, None, current_user=current_user, clinic_id=source.clinic_id, scope=target_scope)

    clone = Template(
        clinic_id=source.clinic_id,
        template_type=source.template_type,
        name=sanitize_text(payload.name or f"{source.name} — копия", max_len=255),
        body=source.body,
        scope=target_scope,
        specialty=source.specialty,
        visibility=source.visibility,
        status=_validate_status(payload.status),
        version=1,
        source_template_id=source.id,
        scenario_tags_json=list(source.scenario_tags_json or []),
        created_by=current_user.id,
    )
    db.add(clone)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(source.clinic_id),
        action="template.clone",
        target_type="template",
        target_id=str(clone.id),
        metadata={"source_template_id": str(source.id), "scope": target_scope},
    )
    await db.commit()
    await db.refresh(clone)
    author = await _load_user(db, clone.created_by)
    return _serialize(clone, author_name=author.full_name if author else None)


@router.post("/templates/{template_id}/publish")
async def publish_template(
    template_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})
    await _assert_manage_permissions(db, row, current_user=current_user, clinic_id=row.clinic_id, scope=row.scope)
    row.status = "published"
    row.updated_at = _utcnow()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="template.publish",
        target_type="template",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    author = await _load_user(db, row.created_by)
    return _serialize(row, author_name=author.full_name if author else None)


@router.post("/templates/{template_id}/archive")
async def archive_template(
    template_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})
    await _assert_manage_permissions(db, row, current_user=current_user, clinic_id=row.clinic_id, scope=row.scope)
    row.status = "archived"
    row.updated_at = _utcnow()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="template.archive",
        target_type="template",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    author = await _load_user(db, row.created_by)
    return _serialize(row, author_name=author.full_name if author else None)


@router.post("/templates/{template_id}/set-default")
async def set_default_template(
    template_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})
    await _assert_manage_permissions(db, row, current_user=current_user, clinic_id=row.clinic_id, scope=row.scope)

    await _unset_defaults(
        db,
        clinic_id=row.clinic_id,
        scope=row.scope,
        template_type=row.template_type,
        specialty=row.specialty,
        created_by=row.created_by,
    )
    row.is_default = True
    row.updated_at = _utcnow()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="template.set_default",
        target_type="template",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    return _serialize(row)


@router.post("/templates/{template_id}/track-use")
async def track_template_use(
    template_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})
    if not await _can_view_template(db, row, current_user):
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Template is not available"})
    row.usage_count = int(row.usage_count or 0) + 1
    row.last_used_at = _utcnow()
    row.updated_at = _utcnow()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="template.use",
        target_type="template",
        target_id=str(row.id),
    )
    await db.commit()
    await db.refresh(row)
    author = await _load_user(db, row.created_by)
    return {"status": "tracked", "template": _serialize(row, author_name=author.full_name if author else None)}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Template).where(Template.id == uuid.UUID(template_id), Template.deleted_at.is_(None)))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Template not found"})

    await _assert_manage_permissions(db, row, current_user=current_user, clinic_id=row.clinic_id, scope=row.scope)

    row.deleted_at = _utcnow()
    row.updated_at = _utcnow()
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(row.clinic_id),
        action="template.delete",
        target_type="template",
        target_id=str(row.id),
    )
    await db.commit()
    return {"status": "deleted"}


@router.get("/platform/templates/overview")
async def platform_templates_overview(
    current_user=Depends(require_roles(RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    clinics = (await db.scalars(select(Clinic).order_by(Clinic.name.asc()))).all()
    clinic_by_id = {row.id: row for row in clinics}
    templates = (
        await db.scalars(
            select(Template)
            .where(Template.deleted_at.is_(None))
            .order_by(Template.updated_at.desc())
        )
    ).all()
    users = (
        await db.scalars(select(User).where(User.id.in_([row.created_by for row in templates] if templates else [])))
    ).all()
    user_by_id = {row.id: row for row in users}

    scope_counts = {scope: 0 for scope in ALL_SCOPES}
    status_counts = {status: 0 for status in ALL_STATUSES}
    type_counts: dict[str, int] = {}
    clinic_usage: dict[uuid.UUID, dict] = {}
    recent_updates: list[dict] = []
    top_templates: list[dict] = []
    recommended_updates: list[dict] = []
    doctors_using: set[uuid.UUID] = set()

    for row in templates:
        scope_counts[row.scope] = scope_counts.get(row.scope, 0) + 1
        status_counts[row.status] = status_counts.get(row.status, 0) + 1
        type_counts[row.template_type] = type_counts.get(row.template_type, 0) + 1
        if int(row.usage_count or 0) > 0:
            doctors_using.add(row.created_by)

        clinic_stats = clinic_usage.setdefault(
            row.clinic_id,
            {
                "clinic_id": str(row.clinic_id),
                "clinic_name": clinic_by_id.get(row.clinic_id).name if clinic_by_id.get(row.clinic_id) else "Клиника",
                "templates": 0,
                "published": 0,
                "defaults": 0,
                "usage_count": 0,
                "personal": 0,
                "branch": 0,
                "doctors_using": set(),
            },
        )
        clinic_stats["templates"] += 1
        clinic_stats["usage_count"] += int(row.usage_count or 0)
        clinic_stats["doctors_using"].add(row.created_by)
        if row.status == "published":
            clinic_stats["published"] += 1
        if row.is_default:
            clinic_stats["defaults"] += 1
        if row.scope == "personal":
            clinic_stats["personal"] += 1
        if row.scope == "branch":
            clinic_stats["branch"] += 1

        if len(recent_updates) < 12:
            author = user_by_id.get(row.created_by)
            recent_updates.append(
                {
                    "id": str(row.id),
                    "name": row.name,
                    "clinic_name": clinic_stats["clinic_name"],
                    "scope": row.scope,
                    "status": row.status,
                    "updated_at": row.updated_at,
                    "author_name": author.full_name if author else "Команда клиники",
                }
            )

    top_rows = sorted(templates, key=lambda row: (int(row.usage_count or 0), row.updated_at or _utcnow()), reverse=True)[:10]
    for row in top_rows:
        author = user_by_id.get(row.created_by)
        top_templates.append(
            {
                "id": str(row.id),
                "name": row.name,
                "clinic_name": clinic_by_id.get(row.clinic_id).name if clinic_by_id.get(row.clinic_id) else "Клиника",
                "scope": row.scope,
                "status": row.status,
                "usage_count": int(row.usage_count or 0),
                "author_name": author.full_name if author else "Команда клиники",
                "specialty": row.specialty or "general",
                "is_default": row.is_default,
                "recommended_updates": "Да" if int(row.usage_count or 0) >= 10 and row.status != "published" else "Нет",
            }
        )

    for row in sorted(
        templates,
        key=lambda item: (int(item.usage_count or 0), item.updated_at or _utcnow()),
        reverse=True,
    ):
        stale = row.updated_at and (_utcnow() - row.updated_at).days >= 45
        high_use = int(row.usage_count or 0) >= 8
        if high_use or (stale and row.status == "published"):
            author = user_by_id.get(row.created_by)
            recommended_updates.append(
                {
                    "id": str(row.id),
                    "name": row.name,
                    "clinic_name": clinic_by_id.get(row.clinic_id).name if clinic_by_id.get(row.clinic_id) else "Клиника",
                    "scope": row.scope,
                    "status": row.status,
                    "usage_count": int(row.usage_count or 0),
                    "author_name": author.full_name if author else "Команда клиники",
                    "reason": "Высокое использование и требуется освежить контент" if high_use else "Шаблон давно не обновлялся",
                }
            )
        if len(recommended_updates) >= 8:
            break

    return {
        "summary": {
            "templates": len(templates),
            "clinics": len({row.clinic_id for row in templates}),
            "published": status_counts.get("published", 0),
            "defaults": sum(1 for row in templates if row.is_default),
            "usage_total": sum(int(row.usage_count or 0) for row in templates),
            "doctors_using": len(doctors_using),
            "recommended_updates": len(recommended_updates),
        },
        "scope_counts": scope_counts,
        "status_counts": status_counts,
        "type_counts": type_counts,
        "clinic_usage": sorted(
            [
                {
                    **row,
                    "doctors_using": len(row["doctors_using"]),
                }
                for row in clinic_usage.values()
            ],
            key=lambda row: (row["published"], row["usage_count"], row["templates"]),
            reverse=True,
        ),
        "top_templates": top_templates,
        "recent_updates": recent_updates,
        "recommended_updates": recommended_updates,
    }
