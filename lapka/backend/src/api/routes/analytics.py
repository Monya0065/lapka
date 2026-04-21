from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Appointment,
    AppointmentStatus,
    AuditEvent,
    Clinic,
    Invoice,
    InvoiceStatus,
    Membership,
    MembershipStatus,
    RoleEnum,
    User,
    Visit,
    VisitStatus,
)
from src.security.deps import get_current_user, require_clinic_membership, require_roles

router = APIRouter(prefix="/analytics", tags=["analytics"])

OWNER_FUNNEL_STEPS = (
    "triage_open",
    "map_open",
    "clinic_open",
    "booking_open",
    "booking_submit",
)


class OwnerFunnelTrackIn(BaseModel):
    step: str
    source: str | None = None
    path: str | None = None
    clinic_id: str | None = None
    pet_id: str | None = None
    session_id: str | None = Field(default=None, max_length=128)


class OwnerFunnelRate(BaseModel):
    from_step: str
    to_step: str
    rate: float


class OwnerFunnelSummaryOut(BaseModel):
    period_days: int
    totals: dict[str, int]
    conversion_rates: list[OwnerFunnelRate]
    by_source: list[dict[str, str | int | float]]


class OwnerFunnelPlatformSummaryOut(BaseModel):
    period_days: int
    totals: dict[str, int]
    unique_owners: int
    by_source: list[dict[str, str | int | float]]


class OwnerFunnelPlaybookStatusIn(BaseModel):
    source: str = Field(min_length=1, max_length=128)
    status: str = Field(min_length=1, max_length=32)
    due_in_days: int | None = Field(default=None, ge=0, le=90)
    assignee_user_id: str | None = Field(default=None, max_length=64)
    assignee_label: str | None = Field(default=None, max_length=255)
    reason: str | None = Field(default=None, max_length=64)


class OwnerFunnelPlaybookBulkStatusIn(BaseModel):
    sources: list[str] = Field(min_length=1, max_length=500)
    status: str = Field(min_length=1, max_length=32)
    due_in_days: int | None = Field(default=None, ge=0, le=90)
    assignee_user_id: str | None = Field(default=None, max_length=64)
    assignee_label: str | None = Field(default=None, max_length=255)


class OwnerFunnelPlaybookStatusOut(BaseModel):
    source: str
    status: str
    due_in_days: int | None = None
    due_at: datetime | None = None
    is_overdue: bool = False
    assignee_user_id: str | None = None
    assignee_label: str | None = None
    updated_at: datetime
    updated_by_user_id: str | None = None


class OwnerFunnelPlaybookDigestOut(BaseModel):
    period_days: int
    completed_count: int
    in_progress_count: int
    planned_count: int
    overdue_count: int
    avg_days_to_done: float
    previous_completed_count: int
    previous_overdue_count: int
    completed_delta_pct: float
    overdue_delta_pct: float


class OwnerFunnelPlaybookHistoryItemOut(BaseModel):
    source: str
    status: str
    due_in_days: int | None = None
    assignee_user_id: str | None = None
    assignee_label: str | None = None
    reason: str | None = None
    updated_at: datetime
    updated_by_user_id: str | None = None


class OwnerFunnelPlaybookExportAuditOut(BaseModel):
    kind: str
    period_days: int
    only_overdue: bool
    assignee_user_id: str | None = None
    include_history: bool | None = None
    history_limit: int | None = None
    exported_at: datetime
    exported_by_user_id: str | None = None


class OwnerFunnelPlaybookExportRiskOut(BaseModel):
    period_days: int
    total_exports: int
    management_exports: int
    overdue_only_exports: int
    unique_exporters: int
    management_share_pct: float
    overdue_share_pct: float
    risk_level: str
    risk_reasons: list[str]


class OwnerFunnelPlaybookExportEscalationOut(BaseModel):
    ok: bool
    created: bool
    source: str
    status: str
    reason: str | None = None


class OwnerFunnelSystemTasksSummaryOut(BaseModel):
    period_days: int
    total_tasks: int
    in_progress_count: int
    done_count: int
    planned_count: int
    overdue_count: int
    avg_days_to_done: float


class OwnerFunnelSystemTaskHistoryItemOut(BaseModel):
    source: str
    status: str
    due_in_days: int | None = None
    assignee_user_id: str | None = None
    assignee_label: str | None = None
    reason: str | None = None
    updated_at: datetime
    updated_by_user_id: str | None = None


class OwnerFunnelSystemTaskReasonAnalyticsOut(BaseModel):
    period_days: int
    total_updates: int
    quick_done_count: int
    quick_postpone_count: int
    by_reason: list[dict[str, str | int]]


class OwnerFunnelSystemTaskSlaRiskOut(BaseModel):
    period_days: int
    total_open_tasks: int
    projected_overdue_7d: int
    overdue_now: int
    risk_level: str
    top_risky_sources: list[str]


class OwnerFunnelSystemTaskSlaRecommendationsOut(BaseModel):
    period_days: int
    generated_at: datetime
    recommendations: list[dict[str, str | int]]


class OwnerFunnelSystemTaskSlaRecommendationFeedbackIn(BaseModel):
    source: str
    action: Literal["ack", "snooze", "restore"]
    snooze_days: int | None = Field(default=None, ge=1, le=30)


class OwnerFunnelSystemTaskSlaRecommendationFeedbackOut(BaseModel):
    ok: bool
    source: str
    action: str
    snooze_until: datetime | None = None


class OwnerFunnelSystemTaskSlaAlertClickOut(BaseModel):
    ok: bool
    clicked_at: datetime


class OwnerFunnelSystemTaskSlaLifecycleOut(BaseModel):
    period_days: int
    total_feedback_events: int
    active_count: int
    acked_count: int
    snoozed_count: int
    restored_events: int
    active_delta_vs_prev: int
    acked_delta_vs_prev: int
    snoozed_delta_vs_prev: int
    restored_delta_vs_prev: int
    alert_cta_clicks: int
    alert_response_rate_pct: float
    alert_response_by_level: list[dict[str, str | int | float]]
    alert_follow_up_by_level: list[dict[str, str | int | float]]
    alert_follow_up_latency_by_level: list[dict[str, str | int | float]]
    latency_risk_level: str
    latency_risk_reason: str | None = None
    latency_auto_action: str | None = None


def _parse_due_at(raw_due_at: str | None) -> datetime | None:
    if not isinstance(raw_due_at, str) or not raw_due_at:
        return None
    try:
        return datetime.fromisoformat(raw_due_at.replace("Z", "+00:00"))
    except ValueError:
        return None


def _target_submit_rate_for_source(source: str) -> int:
    value = str(source or "unknown").lower()
    if "map" in value:
        return 45
    if "clinic" in value:
        return 50
    if "triage" in value or "sos" in value:
        return 42
    if "dashboard" in value or "services" in value:
        return 48
    return 40


async def _audit_playbook_export(
    db: AsyncSession,
    current_user: User,
    export_kind: str,
    *,
    period_days: int,
    only_overdue: bool,
    assignee_user_id: str | None,
    include_history: bool | None = None,
    history_limit: int | None = None,
) -> None:
    db.add(
        AuditEvent(
            actor_user_id=current_user.id,
            clinic_id=None,
            action="owner_funnel.playbook_export",
            target_type="owner_funnel_playbook_export",
            target_id=export_kind,
            metadata_json={
                "kind": export_kind,
                "period_days": period_days,
                "only_overdue": only_overdue,
                "assignee_user_id": assignee_user_id,
                "include_history": include_history,
                "history_limit": history_limit,
            },
        )
    )
    await db.commit()


@router.post("/owner-funnel/track")
async def track_owner_funnel_step(
    payload: OwnerFunnelTrackIn,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.owner)),
) -> dict:
    if payload.step not in OWNER_FUNNEL_STEPS:
        raise HTTPException(status_code=422, detail="INVALID_FUNNEL_STEP")

    clinic_uuid = None
    if payload.clinic_id:
        try:
            clinic_uuid = uuid.UUID(payload.clinic_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="INVALID_CLINIC_ID")

    event = AuditEvent(
        actor_user_id=current_user.id,
        clinic_id=clinic_uuid,
        action=f"owner_funnel.{payload.step}",
        target_type="owner_funnel",
        target_id=str(current_user.id),
        metadata_json={
            "step": payload.step,
            "source": payload.source,
            "path": payload.path,
            "clinic_id": payload.clinic_id,
            "pet_id": payload.pet_id,
            "session_id": payload.session_id,
        },
    )
    db.add(event)
    await db.commit()
    return {"ok": True}


@router.get("/owner-funnel/summary", response_model=OwnerFunnelSummaryOut)
async def get_owner_funnel_summary(
    period_days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.owner)),
) -> OwnerFunnelSummaryOut:
    since_dt = datetime.now(timezone.utc) - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent).where(
                AuditEvent.actor_user_id == current_user.id,
                AuditEvent.target_type == "owner_funnel",
                AuditEvent.created_at >= since_dt,
                AuditEvent.action.in_([f"owner_funnel.{step}" for step in OWNER_FUNNEL_STEPS]),
            )
        )
    ).all()

    totals: dict[str, int] = {step: 0 for step in OWNER_FUNNEL_STEPS}
    by_source: dict[str, dict[str, int]] = {}
    for row in rows:
        step = str(row.action).replace("owner_funnel.", "", 1)
        if step in totals:
            totals[step] += 1
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "unknown")
        if source not in by_source:
            by_source[source] = {"booking_open": 0, "booking_submit": 0}
        if step == "booking_open":
            by_source[source]["booking_open"] += 1
        elif step == "booking_submit":
            by_source[source]["booking_submit"] += 1

    def safe_rate(top: int, bottom: int) -> float:
        if bottom <= 0:
            return 0.0
        return round((top / bottom) * 100, 2)

    rates = [
        OwnerFunnelRate(
            from_step="map_open",
            to_step="clinic_open",
            rate=safe_rate(totals["clinic_open"], totals["map_open"]),
        ),
        OwnerFunnelRate(
            from_step="clinic_open",
            to_step="booking_open",
            rate=safe_rate(totals["booking_open"], totals["clinic_open"]),
        ),
        OwnerFunnelRate(
            from_step="booking_open",
            to_step="booking_submit",
            rate=safe_rate(totals["booking_submit"], totals["booking_open"]),
        ),
        OwnerFunnelRate(
            from_step="triage_open",
            to_step="booking_submit",
            rate=safe_rate(totals["booking_submit"], totals["triage_open"]),
        ),
    ]

    source_rows = []
    for source, source_totals in by_source.items():
        opens = int(source_totals.get("booking_open", 0))
        submits = int(source_totals.get("booking_submit", 0))
        source_rows.append(
            {
                "source": source,
                "booking_open": opens,
                "booking_submit": submits,
                "submit_rate": safe_rate(submits, opens),
            }
        )
    source_rows.sort(key=lambda row: int(row["booking_submit"]), reverse=True)

    return OwnerFunnelSummaryOut(
        period_days=period_days,
        totals=totals,
        conversion_rates=rates,
        by_source=source_rows,
    )


@router.get("/owner-funnel/platform-summary", response_model=OwnerFunnelPlatformSummaryOut)
async def get_owner_funnel_platform_summary(
    period_days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelPlatformSummaryOut:
    del current_user
    since_dt = datetime.now(timezone.utc) - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent).where(
                AuditEvent.target_type == "owner_funnel",
                AuditEvent.created_at >= since_dt,
                AuditEvent.action.in_([f"owner_funnel.{step}" for step in OWNER_FUNNEL_STEPS]),
            )
        )
    ).all()

    totals: dict[str, int] = {step: 0 for step in OWNER_FUNNEL_STEPS}
    by_source: dict[str, dict[str, int]] = {}
    unique_owners: set[str] = set()
    for row in rows:
        step = str(row.action).replace("owner_funnel.", "", 1)
        if step in totals:
            totals[step] += 1
        if row.actor_user_id:
            unique_owners.add(str(row.actor_user_id))
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "unknown")
        if source not in by_source:
            by_source[source] = {"booking_open": 0, "booking_submit": 0}
        if step == "booking_open":
            by_source[source]["booking_open"] += 1
        elif step == "booking_submit":
            by_source[source]["booking_submit"] += 1

    source_rows = []
    for source, source_totals in by_source.items():
        opens = int(source_totals.get("booking_open", 0))
        submits = int(source_totals.get("booking_submit", 0))
        submit_rate = round((submits / opens) * 100, 2) if opens > 0 else 0.0
        source_rows.append(
            {
                "source": source,
                "booking_open": opens,
                "booking_submit": submits,
                "submit_rate": submit_rate,
            }
        )
    source_rows.sort(key=lambda row: int(row["booking_submit"]), reverse=True)

    return OwnerFunnelPlatformSummaryOut(
        period_days=period_days,
        totals=totals,
        unique_owners=len(unique_owners),
        by_source=source_rows,
    )


@router.get("/owner-funnel/playbook-status", response_model=list[OwnerFunnelPlaybookStatusOut])
async def get_owner_funnel_playbook_status(
    limit: int = Query(default=200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> list[OwnerFunnelPlaybookStatusOut]:
    del current_user
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    ).all()

    latest_by_source: dict[str, OwnerFunnelPlaybookStatusOut] = {}
    for row in rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "").strip()
        status = str(meta.get("status") or "").strip()
        if not source or not status:
            continue
        if source in latest_by_source:
            continue
        parsed_due_at = _parse_due_at(meta.get("due_at"))
        overdue = bool(parsed_due_at and status != "done" and parsed_due_at < datetime.now(timezone.utc))
        latest_by_source[source] = OwnerFunnelPlaybookStatusOut(
            source=source,
            status=status,
            due_in_days=meta.get("due_in_days"),
            due_at=parsed_due_at,
            is_overdue=overdue,
            assignee_user_id=str(meta.get("assignee_user_id") or "") or None,
            assignee_label=str(meta.get("assignee_label") or "") or None,
            updated_at=row.created_at,
            updated_by_user_id=str(row.actor_user_id) if row.actor_user_id else None,
        )

    return list(latest_by_source.values())


@router.get("/owner-funnel/playbook-export.csv")
async def export_owner_funnel_playbook_csv(
    include_history: bool = Query(default=True),
    only_overdue: bool = Query(default=False),
    assignee_user_id: str | None = Query(default=None),
    period_days: int = Query(default=14, ge=1, le=180),
    history_limit: int = Query(default=12, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> Response:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.created_at >= window_start,
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(5000)
        )
    ).all()

    latest_by_source: dict[str, AuditEvent] = {}
    history_by_source: dict[str, list[AuditEvent]] = {}
    for row in rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "").strip()
        status = str(meta.get("status") or "").strip()
        if not source or not status:
            continue
        if include_history:
            history_by_source.setdefault(source, []).append(row)
        if source not in latest_by_source:
            latest_by_source[source] = row

    def row_matches_filters(audit_row: AuditEvent) -> bool:
        meta = audit_row.metadata_json if isinstance(audit_row.metadata_json, dict) else {}
        status = str(meta.get("status") or "").strip()
        due_at = _parse_due_at(meta.get("due_at"))
        is_overdue = bool(due_at and status != "done" and due_at < now)
        if only_overdue and not is_overdue:
            return False
        if assignee_user_id:
            if str(meta.get("assignee_user_id") or "").strip() != str(assignee_user_id):
                return False
        return True

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "source",
            "kind",
            "status",
            "due_in_days",
            "due_at",
            "is_overdue",
            "assignee_user_id",
            "assignee_label",
            "updated_at",
            "updated_by_user_id",
        ]
    )

    for source, latest in latest_by_source.items():
        if not row_matches_filters(latest):
            continue
        latest_meta = latest.metadata_json if isinstance(latest.metadata_json, dict) else {}
        writer.writerow(
            [
                source,
                "latest",
                latest_meta.get("status"),
                latest_meta.get("due_in_days"),
                latest_meta.get("due_at"),
                latest_meta.get("is_overdue"),
                latest_meta.get("assignee_user_id"),
                latest_meta.get("assignee_label"),
                latest.created_at.isoformat(),
                str(latest.actor_user_id) if latest.actor_user_id else "",
            ]
        )
        if include_history:
            for row in reversed(history_by_source.get(source, [])[:history_limit]):
                meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
                writer.writerow(
                    [
                        source,
                        "history",
                        meta.get("status"),
                        meta.get("due_in_days"),
                        meta.get("due_at"),
                        meta.get("is_overdue"),
                        meta.get("assignee_user_id"),
                        meta.get("assignee_label"),
                        row.created_at.isoformat(),
                        str(row.actor_user_id) if row.actor_user_id else "",
                    ]
                )

    csv_text = output.getvalue()
    filename = f"owner_funnel_playbook_{now.strftime('%Y%m%d_%H%M%S')}.csv"
    await _audit_playbook_export(
        db,
        current_user,
        "detail",
        period_days=period_days,
        only_overdue=only_overdue,
        assignee_user_id=assignee_user_id,
        include_history=include_history,
        history_limit=history_limit if include_history else None,
    )
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/owner-funnel/playbook-management-export.csv")
async def export_owner_funnel_playbook_management_csv(
    only_overdue: bool = Query(default=False),
    assignee_user_id: str | None = Query(default=None),
    period_days: int = Query(default=14, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> Response:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=period_days)

    funnel_rows = (
        await db.scalars(
            select(AuditEvent).where(
                AuditEvent.target_type == "owner_funnel",
                AuditEvent.created_at >= window_start,
                AuditEvent.action.in_(["owner_funnel.booking_open", "owner_funnel.booking_submit"]),
            )
        )
    ).all()
    playbook_rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(5000)
        )
    ).all()

    by_source: dict[str, dict[str, int]] = {}
    for row in funnel_rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "unknown").strip() or "unknown"
        item = by_source.setdefault(source, {"booking_open": 0, "booking_submit": 0})
        if row.action == "owner_funnel.booking_open":
            item["booking_open"] += 1
        elif row.action == "owner_funnel.booking_submit":
            item["booking_submit"] += 1

    latest_status_by_source: dict[str, AuditEvent] = {}
    for row in playbook_rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "").strip()
        status = str(meta.get("status") or "").strip()
        if not source or not status:
            continue
        if source not in latest_status_by_source:
            latest_status_by_source[source] = row

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "source",
            "period_days",
            "booking_open",
            "booking_submit",
            "submit_rate",
            "target_submit_rate",
            "rate_gap",
            "expected_uplift_14d",
            "playbook_status",
            "due_in_days",
            "due_at",
            "is_overdue",
            "assignee_user_id",
            "assignee_label",
            "playbook_updated_at",
            "playbook_updated_by_user_id",
        ]
    )

    for source, funnel in by_source.items():
        status_row = latest_status_by_source.get(source)
        status_meta = status_row.metadata_json if status_row and isinstance(status_row.metadata_json, dict) else {}
        status = str(status_meta.get("status") or "planned").strip() or "planned"
        due_in_days = status_meta.get("due_in_days")
        due_at = _parse_due_at(status_meta.get("due_at"))
        is_overdue = bool(due_at and status != "done" and due_at < now)
        status_assignee_user_id = str(status_meta.get("assignee_user_id") or "").strip() or None

        if only_overdue and not is_overdue:
            continue
        if assignee_user_id and status_assignee_user_id != str(assignee_user_id):
            continue

        opens = int(funnel.get("booking_open", 0))
        submits = int(funnel.get("booking_submit", 0))
        submit_rate = round((submits / opens) * 100, 2) if opens > 0 else 0.0
        target_rate = _target_submit_rate_for_source(source)
        rate_gap = max(0.0, round(target_rate - submit_rate, 2))
        expected_uplift_14d = max(0, round((opens * rate_gap) / 100))

        writer.writerow(
            [
                source,
                period_days,
                opens,
                submits,
                submit_rate,
                target_rate,
                rate_gap,
                expected_uplift_14d,
                status,
                due_in_days,
                due_at.isoformat() if due_at else "",
                is_overdue,
                status_assignee_user_id or "",
                str(status_meta.get("assignee_label") or "").strip(),
                status_row.created_at.isoformat() if status_row else "",
                str(status_row.actor_user_id) if status_row and status_row.actor_user_id else "",
            ]
        )

    csv_text = output.getvalue()
    filename = f"owner_funnel_playbook_management_{now.strftime('%Y%m%d_%H%M%S')}.csv"
    await _audit_playbook_export(
        db,
        current_user,
        "management",
        period_days=period_days,
        only_overdue=only_overdue,
        assignee_user_id=assignee_user_id,
    )
    return Response(
        content=csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/owner-funnel/playbook-status")
async def set_owner_funnel_playbook_status(
    payload: OwnerFunnelPlaybookStatusIn,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> dict:
    allowed_statuses = {"planned", "in_progress", "done"}
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=422, detail="INVALID_PLAYBOOK_STATUS")

    now = datetime.now(timezone.utc)
    due_at = None
    is_overdue = False
    if payload.due_in_days is not None:
        due_at = now + timedelta(days=payload.due_in_days)
        is_overdue = payload.status != "done" and due_at < now

    db.add(
        AuditEvent(
            actor_user_id=current_user.id,
            clinic_id=None,
            action="owner_funnel.playbook_status_set",
            target_type="owner_funnel_playbook",
            target_id=payload.source,
            metadata_json={
                "source": payload.source,
                "status": payload.status,
                "due_in_days": payload.due_in_days,
                "due_at": due_at.isoformat() if due_at else None,
                "is_overdue": is_overdue,
                "assignee_user_id": payload.assignee_user_id,
                "assignee_label": payload.assignee_label,
                "reason": payload.reason,
            },
        )
    )
    await db.commit()
    return {"ok": True}


@router.post("/owner-funnel/playbook-status/bulk")
async def set_owner_funnel_playbook_status_bulk(
    payload: OwnerFunnelPlaybookBulkStatusIn,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> dict:
    allowed_statuses = {"planned", "in_progress", "done"}
    if payload.status not in allowed_statuses:
        raise HTTPException(status_code=422, detail="INVALID_PLAYBOOK_STATUS")

    now = datetime.now(timezone.utc)
    due_at = None
    is_overdue = False
    if payload.due_in_days is not None:
        due_at = now + timedelta(days=payload.due_in_days)
        is_overdue = payload.status != "done" and due_at < now

    clean_sources = [str(source or "").strip() for source in payload.sources]
    clean_sources = [source for source in clean_sources if source]
    if not clean_sources:
        raise HTTPException(status_code=422, detail="EMPTY_PLAYBOOK_SOURCES")

    for source in clean_sources[:500]:
        db.add(
            AuditEvent(
                actor_user_id=current_user.id,
                clinic_id=None,
                action="owner_funnel.playbook_status_set",
                target_type="owner_funnel_playbook",
                target_id=source,
                metadata_json={
                    "source": source,
                    "status": payload.status,
                    "due_in_days": payload.due_in_days,
                    "due_at": due_at.isoformat() if due_at else None,
                    "is_overdue": is_overdue,
                    "assignee_user_id": payload.assignee_user_id,
                    "assignee_label": payload.assignee_label,
                },
            )
        )
    await db.commit()
    return {"ok": True, "updated_count": len(clean_sources[:500])}


def _safe_delta_pct(current: int, previous: int) -> float:
    if previous <= 0:
        return 0.0 if current <= 0 else 100.0
    return round(((current - previous) / previous) * 100, 2)


@router.get("/owner-funnel/playbook-digest", response_model=OwnerFunnelPlaybookDigestOut)
async def get_owner_funnel_playbook_digest(
    period_days: int = Query(default=14, ge=1, le=90),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelPlaybookDigestOut:
    del current_user
    now = datetime.now(timezone.utc)
    since_dt = now - timedelta(days=period_days)
    prev_since_dt = since_dt - timedelta(days=period_days)

    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.created_at >= prev_since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()

    latest_current_by_source: dict[str, tuple[str, datetime, datetime | None]] = {}
    latest_previous_by_source: dict[str, tuple[str, datetime, datetime | None]] = {}
    first_status_at_by_source: dict[str, datetime] = {}
    done_durations_days: list[float] = []
    completed_count = 0
    previous_completed_count = 0

    for row in rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        source = str(meta.get("source") or "").strip()
        status = str(meta.get("status") or "").strip()
        raw_due_at = meta.get("due_at")
        due_at = None
        if isinstance(raw_due_at, str) and raw_due_at:
            try:
                due_at = datetime.fromisoformat(raw_due_at.replace("Z", "+00:00"))
            except ValueError:
                due_at = None
        if not source or not status:
            continue

        created_at = row.created_at
        if source not in first_status_at_by_source:
            first_status_at_by_source[source] = created_at

        if created_at >= since_dt:
            latest_current_by_source[source] = (status, created_at, due_at)
            if status == "done":
                completed_count += 1
                start_at = first_status_at_by_source.get(source, created_at)
                done_durations_days.append(max(0.0, (created_at - start_at).total_seconds() / 86400))
        elif created_at >= prev_since_dt:
            latest_previous_by_source[source] = (status, created_at, due_at)
            if status == "done":
                previous_completed_count += 1

    planned_count = 0
    in_progress_count = 0
    overdue_count = 0
    for status, _updated_at, due_at in latest_current_by_source.values():
        if status == "done":
            continue
        if status == "in_progress":
            in_progress_count += 1
        else:
            planned_count += 1
        if due_at and due_at < now:
            overdue_count += 1

    previous_overdue_count = 0
    for status, _updated_at, due_at in latest_previous_by_source.values():
        if status == "done":
            continue
        if due_at and due_at < since_dt:
            previous_overdue_count += 1

    avg_days_to_done = round(sum(done_durations_days) / len(done_durations_days), 2) if done_durations_days else 0.0

    return OwnerFunnelPlaybookDigestOut(
        period_days=period_days,
        completed_count=completed_count,
        in_progress_count=in_progress_count,
        planned_count=planned_count,
        overdue_count=overdue_count,
        avg_days_to_done=avg_days_to_done,
        previous_completed_count=previous_completed_count,
        previous_overdue_count=previous_overdue_count,
        completed_delta_pct=_safe_delta_pct(completed_count, previous_completed_count),
        overdue_delta_pct=_safe_delta_pct(overdue_count, previous_overdue_count),
    )


@router.get("/owner-funnel/playbook-history", response_model=list[OwnerFunnelPlaybookHistoryItemOut])
async def get_owner_funnel_playbook_history(
    source: str = Query(min_length=1, max_length=128),
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> list[OwnerFunnelPlaybookHistoryItemOut]:
    del current_user
    clean_source = str(source or "").strip()
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.target_id == clean_source,
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    ).all()
    out: list[OwnerFunnelPlaybookHistoryItemOut] = []
    for row in rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        out.append(
            OwnerFunnelPlaybookHistoryItemOut(
                source=clean_source,
                status=str(meta.get("status") or "planned"),
                due_in_days=meta.get("due_in_days"),
                assignee_user_id=str(meta.get("assignee_user_id") or "") or None,
                assignee_label=str(meta.get("assignee_label") or "") or None,
                reason=str(meta.get("reason") or "") or None,
                updated_at=row.created_at,
                updated_by_user_id=str(row.actor_user_id) if row.actor_user_id else None,
            )
        )
    return out


@router.get("/owner-funnel/playbook-export-audit", response_model=list[OwnerFunnelPlaybookExportAuditOut])
async def get_owner_funnel_playbook_export_audit(
    period_days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=50, ge=1, le=500),
    kind: str | None = Query(default=None),
    exported_by_user_id: str | None = Query(default=None),
    only_overdue: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> list[OwnerFunnelPlaybookExportAuditOut]:
    del current_user
    since_dt = datetime.now(timezone.utc) - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook_export",
                AuditEvent.action == "owner_funnel.playbook_export",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.desc())
            .limit(limit)
        )
    ).all()
    out: list[OwnerFunnelPlaybookExportAuditOut] = []
    for row in rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        meta_kind = str(meta.get("kind") or "unknown")
        meta_only_overdue = bool(meta.get("only_overdue"))
        actor_id = str(row.actor_user_id) if row.actor_user_id else None
        if kind and meta_kind != kind:
            continue
        if exported_by_user_id and actor_id != exported_by_user_id:
            continue
        if only_overdue is not None and meta_only_overdue != bool(only_overdue):
            continue
        out.append(
            OwnerFunnelPlaybookExportAuditOut(
                kind=meta_kind,
                period_days=int(meta.get("period_days") or 0),
                only_overdue=meta_only_overdue,
                assignee_user_id=str(meta.get("assignee_user_id") or "") or None,
                include_history=meta.get("include_history"),
                history_limit=int(meta.get("history_limit")) if meta.get("history_limit") is not None else None,
                exported_at=row.created_at,
                exported_by_user_id=actor_id,
            )
        )
    return out


@router.get("/owner-funnel/playbook-export-audit.csv")
async def export_owner_funnel_playbook_export_audit_csv(
    period_days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=200, ge=1, le=2000),
    kind: str | None = Query(default=None),
    exported_by_user_id: str | None = Query(default=None),
    only_overdue: bool | None = Query(default=None),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> Response:
    del current_user
    rows = await get_owner_funnel_playbook_export_audit(
        period_days=period_days,
        limit=limit,
        kind=kind,
        exported_by_user_id=exported_by_user_id,
        only_overdue=only_overdue,
        db=db,
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "exported_at",
            "kind",
            "period_days",
            "only_overdue",
            "assignee_user_id",
            "include_history",
            "history_limit",
            "exported_by_user_id",
        ]
    )
    for row in rows:
        writer.writerow(
            [
                row.exported_at.isoformat(),
                row.kind,
                row.period_days,
                row.only_overdue,
                row.assignee_user_id or "",
                row.include_history if row.include_history is not None else "",
                row.history_limit if row.history_limit is not None else "",
                row.exported_by_user_id or "",
            ]
        )
    filename = f"owner_funnel_export_audit_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/owner-funnel/playbook-export-risk", response_model=OwnerFunnelPlaybookExportRiskOut)
async def get_owner_funnel_playbook_export_risk(
    period_days: int = Query(default=14, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelPlaybookExportRiskOut:
    del current_user
    rows = await get_owner_funnel_playbook_export_audit(
        period_days=period_days,
        limit=2000,
        kind=None,
        exported_by_user_id=None,
        only_overdue=None,
        db=db,
    )
    total = len(rows)
    management_exports = sum(1 for row in rows if row.kind == "management")
    overdue_only_exports = sum(1 for row in rows if row.only_overdue)
    unique_exporters = len({row.exported_by_user_id for row in rows if row.exported_by_user_id})
    management_share = round((management_exports / total) * 100, 2) if total else 0.0
    overdue_share = round((overdue_only_exports / total) * 100, 2) if total else 0.0

    risk_score = 0
    reasons: list[str] = []
    if total >= 60:
        risk_score += 2
        reasons.append("high export volume")
    elif total >= 30:
        risk_score += 1
        reasons.append("elevated export volume")
    if management_share >= 75:
        risk_score += 2
        reasons.append("management export share >= 75%")
    elif management_share >= 50:
        risk_score += 1
        reasons.append("management export share >= 50%")
    if overdue_share >= 40:
        risk_score += 2
        reasons.append("overdue-only share >= 40%")
    elif overdue_share >= 20:
        risk_score += 1
        reasons.append("overdue-only share >= 20%")
    if unique_exporters <= 1 and total >= 10:
        risk_score += 2
        reasons.append("single exporter concentration")
    elif unique_exporters <= 2 and total >= 20:
        risk_score += 1
        reasons.append("low exporter diversity")

    if risk_score >= 5:
        level = "high"
    elif risk_score >= 3:
        level = "medium"
    else:
        level = "low"

    return OwnerFunnelPlaybookExportRiskOut(
        period_days=period_days,
        total_exports=total,
        management_exports=management_exports,
        overdue_only_exports=overdue_only_exports,
        unique_exporters=unique_exporters,
        management_share_pct=management_share,
        overdue_share_pct=overdue_share,
        risk_level=level,
        risk_reasons=reasons,
    )


async def _escalate_system_playbook_task(
    *,
    db: AsyncSession,
    current_user: User,
    source: str,
    status_when_exists: str,
    trigger: str,
    trigger_meta: dict[str, object] | None = None,
) -> OwnerFunnelPlaybookExportEscalationOut:
    cooldown_since = datetime.now(timezone.utc) - timedelta(hours=24)
    recent = await db.scalar(
        select(AuditEvent.id).where(
            AuditEvent.target_type == "owner_funnel_playbook",
            AuditEvent.action == "owner_funnel.playbook_status_set",
            AuditEvent.target_id == source,
            AuditEvent.created_at >= cooldown_since,
        )
    )
    if recent:
        return OwnerFunnelPlaybookExportEscalationOut(
            ok=True,
            created=False,
            source=source,
            status=status_when_exists,
            reason="cooldown_24h",
        )

    now = datetime.now(timezone.utc)
    due_in_days = 1
    due_at = now + timedelta(days=due_in_days)
    metadata: dict[str, object] = {
        "source": source,
        "status": "in_progress",
        "due_in_days": due_in_days,
        "due_at": due_at.isoformat(),
        "is_overdue": False,
        "assignee_user_id": str(current_user.id),
        "assignee_label": current_user.full_name or current_user.email or "network_admin",
        "trigger": trigger,
    }
    if trigger_meta:
        metadata.update(trigger_meta)
    db.add(
        AuditEvent(
            actor_user_id=current_user.id,
            clinic_id=None,
            action="owner_funnel.playbook_status_set",
            target_type="owner_funnel_playbook",
            target_id=source,
            metadata_json=metadata,
        )
    )
    await db.commit()
    return OwnerFunnelPlaybookExportEscalationOut(
        ok=True,
        created=True,
        source=source,
        status="in_progress",
        reason="created",
    )


@router.post("/owner-funnel/playbook-export-risk/escalate", response_model=OwnerFunnelPlaybookExportEscalationOut)
async def escalate_owner_funnel_playbook_export_risk(
    period_days: int = Query(default=14, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelPlaybookExportEscalationOut:
    risk = await get_owner_funnel_playbook_export_risk(
        period_days=period_days,
        db=db,
        current_user=current_user,
    )
    if risk.risk_level != "high":
        return OwnerFunnelPlaybookExportEscalationOut(
            ok=True,
            created=False,
            source="export_security_review",
            status="planned",
            reason="risk_not_high",
        )
    return await _escalate_system_playbook_task(
        db=db,
        current_user=current_user,
        source="export_security_review",
        status_when_exists="in_progress",
        trigger="export_risk_high",
        trigger_meta={
            "trigger_period_days": period_days,
            "trigger_reasons": risk.risk_reasons,
        },
    )


@router.get("/owner-funnel/system-tasks-summary", response_model=OwnerFunnelSystemTasksSummaryOut)
async def get_owner_funnel_system_tasks_summary(
    period_days: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTasksSummaryOut:
    del current_user
    now = datetime.now(timezone.utc)
    since_dt = now - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()

    latest_by_source: dict[str, tuple[str, datetime | None]] = {}
    first_status_at_by_source: dict[str, datetime] = {}
    done_durations_days: list[float] = []

    for row in rows:
        source = str(row.target_id or "").strip()
        if not source.startswith("export_"):
            continue
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        status = str(meta.get("status") or "").strip()
        if not status:
            continue
        due_at = _parse_due_at(meta.get("due_at"))

        if source not in first_status_at_by_source:
            first_status_at_by_source[source] = row.created_at
        latest_by_source[source] = (status, due_at)
        if status == "done":
            start_at = first_status_at_by_source.get(source, row.created_at)
            done_durations_days.append(max(0.0, (row.created_at - start_at).total_seconds() / 86400))

    total_tasks = len(latest_by_source)
    in_progress_count = 0
    done_count = 0
    planned_count = 0
    overdue_count = 0
    for status, due_at in latest_by_source.values():
        if status == "done":
            done_count += 1
            continue
        if status == "in_progress":
            in_progress_count += 1
        else:
            planned_count += 1
        if due_at and due_at < now:
            overdue_count += 1

    avg_days_to_done = round(sum(done_durations_days) / len(done_durations_days), 2) if done_durations_days else 0.0
    return OwnerFunnelSystemTasksSummaryOut(
        period_days=period_days,
        total_tasks=total_tasks,
        in_progress_count=in_progress_count,
        done_count=done_count,
        planned_count=planned_count,
        overdue_count=overdue_count,
        avg_days_to_done=avg_days_to_done,
    )


@router.get("/owner-funnel/system-tasks-history", response_model=list[OwnerFunnelSystemTaskHistoryItemOut])
async def get_owner_funnel_system_tasks_history(
    source: str | None = Query(default=None),
    period_days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=30, ge=1, le=300),
    quick_actions_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> list[OwnerFunnelSystemTaskHistoryItemOut]:
    del current_user
    since_dt = datetime.now(timezone.utc) - timedelta(days=period_days)
    clean_source = str(source or "").strip()
    stmt = (
        select(AuditEvent)
        .where(
            AuditEvent.target_type == "owner_funnel_playbook",
            AuditEvent.action == "owner_funnel.playbook_status_set",
            AuditEvent.created_at >= since_dt,
        )
        .order_by(AuditEvent.created_at.desc())
        .limit(limit)
    )
    if clean_source:
        stmt = stmt.where(AuditEvent.target_id == clean_source)
    rows = (await db.scalars(stmt)).all()
    out: list[OwnerFunnelSystemTaskHistoryItemOut] = []
    for row in rows:
        source_id = str(row.target_id or "").strip()
        if not source_id.startswith("export_"):
            continue
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        reason = str(meta.get("reason") or "").strip() or None
        if quick_actions_only and reason not in {"done_from_timeline", "postpone_from_timeline"}:
            continue
        out.append(
            OwnerFunnelSystemTaskHistoryItemOut(
                source=source_id,
                status=str(meta.get("status") or "planned"),
                due_in_days=meta.get("due_in_days"),
                assignee_user_id=str(meta.get("assignee_user_id") or "") or None,
                assignee_label=str(meta.get("assignee_label") or "") or None,
                reason=reason,
                updated_at=row.created_at,
                updated_by_user_id=str(row.actor_user_id) if row.actor_user_id else None,
            )
        )
    return out


@router.get("/owner-funnel/system-tasks-reason-analytics", response_model=OwnerFunnelSystemTaskReasonAnalyticsOut)
async def get_owner_funnel_system_tasks_reason_analytics(
    period_days: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTaskReasonAnalyticsOut:
    del current_user
    since_dt = datetime.now(timezone.utc) - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.desc())
        )
    ).all()
    total_updates = 0
    quick_done_count = 0
    quick_postpone_count = 0
    by_reason: dict[str, int] = {}
    for row in rows:
        source_id = str(row.target_id or "").strip()
        if not source_id.startswith("export_"):
            continue
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        reason = str(meta.get("reason") or "").strip() or "none"
        total_updates += 1
        by_reason[reason] = by_reason.get(reason, 0) + 1
        if reason == "done_from_timeline":
            quick_done_count += 1
        elif reason == "postpone_from_timeline":
            quick_postpone_count += 1
    sorted_reasons = sorted(by_reason.items(), key=lambda item: item[1], reverse=True)
    return OwnerFunnelSystemTaskReasonAnalyticsOut(
        period_days=period_days,
        total_updates=total_updates,
        quick_done_count=quick_done_count,
        quick_postpone_count=quick_postpone_count,
        by_reason=[{"reason": reason, "count": count} for reason, count in sorted_reasons[:8]],
    )


@router.get("/owner-funnel/system-tasks-sla-risk", response_model=OwnerFunnelSystemTaskSlaRiskOut)
async def get_owner_funnel_system_tasks_sla_risk(
    period_days: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTaskSlaRiskOut:
    del current_user
    now = datetime.now(timezone.utc)
    since_dt = now - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()

    latest_by_source: dict[str, tuple[str, datetime | None]] = {}
    postpone_counts: dict[str, int] = {}
    for row in rows:
        source_id = str(row.target_id or "").strip()
        if not source_id.startswith("export_"):
            continue
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        status = str(meta.get("status") or "").strip()
        if not status:
            continue
        reason = str(meta.get("reason") or "").strip()
        if reason == "postpone_from_timeline":
            postpone_counts[source_id] = postpone_counts.get(source_id, 0) + 1
        latest_by_source[source_id] = (status, _parse_due_at(meta.get("due_at")))

    open_sources: list[str] = []
    overdue_now = 0
    projected_overdue_7d = 0
    risky_rank: list[tuple[int, str]] = []
    projection_dt = now + timedelta(days=7)
    for source, (status, due_at) in latest_by_source.items():
        if status == "done":
            continue
        open_sources.append(source)
        if due_at and due_at < now:
            overdue_now += 1
        postpone_penalty = postpone_counts.get(source, 0) * 2
        will_be_overdue_soon = bool(due_at and due_at < projection_dt)
        if will_be_overdue_soon:
            projected_overdue_7d += 1
        risk_points = (3 if due_at and due_at < now else 0) + (2 if will_be_overdue_soon else 0) + postpone_penalty
        risky_rank.append((risk_points, source))

    total_open = len(open_sources)
    if projected_overdue_7d >= 5 or overdue_now >= 3:
        risk_level = "high"
    elif projected_overdue_7d >= 2 or overdue_now >= 1:
        risk_level = "medium"
    else:
        risk_level = "low"

    risky_rank.sort(key=lambda item: item[0], reverse=True)
    top_risky_sources = [source for _score, source in risky_rank[:5] if _score > 0]
    return OwnerFunnelSystemTaskSlaRiskOut(
        period_days=period_days,
        total_open_tasks=total_open,
        projected_overdue_7d=projected_overdue_7d,
        overdue_now=overdue_now,
        risk_level=risk_level,
        top_risky_sources=top_risky_sources,
    )


@router.get("/owner-funnel/system-tasks-sla-recommendations", response_model=OwnerFunnelSystemTaskSlaRecommendationsOut)
async def get_owner_funnel_system_tasks_sla_recommendations(
    period_days: int = Query(default=30, ge=1, le=180),
    limit: int = Query(default=6, ge=1, le=20),
    include_dismissed: bool = Query(default=False),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTaskSlaRecommendationsOut:
    del current_user
    now = datetime.now(timezone.utc)
    since_dt = now - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_playbook",
                AuditEvent.action == "owner_funnel.playbook_status_set",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()

    latest_by_source: dict[str, tuple[str, datetime | None]] = {}
    postpone_counts: dict[str, int] = {}
    for row in rows:
        source_id = str(row.target_id or "").strip()
        if not source_id.startswith("export_"):
            continue
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        status = str(meta.get("status") or "").strip()
        if not status:
            continue
        reason = str(meta.get("reason") or "").strip()
        if reason == "postpone_from_timeline":
            postpone_counts[source_id] = postpone_counts.get(source_id, 0) + 1
        latest_by_source[source_id] = (status, _parse_due_at(meta.get("due_at")))

    feedback_rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_sla_recommendation",
                AuditEvent.action == "owner_funnel.sla_recommendation_feedback",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()
    feedback_by_source: dict[str, tuple[str, datetime | None]] = {}
    for row in feedback_rows:
        source_id = str(row.target_id or "").strip()
        if not source_id.startswith("export_"):
            continue
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        feedback_action = str(meta.get("action") or "").strip()
        if feedback_action not in {"ack", "snooze", "restore"}:
            continue
        feedback_by_source[source_id] = (feedback_action, _parse_due_at(meta.get("snooze_until")))

    recommendations: list[dict[str, str | int]] = []
    forecast_cutoff = now + timedelta(days=7)
    for source, (status, due_at) in latest_by_source.items():
        if status == "done":
            continue
        postpone_count = postpone_counts.get(source, 0)
        overdue_now = bool(due_at and due_at < now)
        overdue_soon = bool(due_at and due_at < forecast_cutoff)
        feedback_action, snooze_until = feedback_by_source.get(source, ("", None))
        is_dismissed = False
        if feedback_action == "ack":
            is_dismissed = True
        elif feedback_action == "snooze" and snooze_until and snooze_until > now:
            is_dismissed = True
        if is_dismissed and not include_dismissed:
            continue
        if not overdue_now and not overdue_soon and postpone_count == 0:
            continue

        priority = "P2"
        action = "Review owner and deadline, then keep monitoring."
        if overdue_now:
            priority = "P0"
            action = "Escalate now: assign owner and move due date to today with completion checkpoint."
        elif postpone_count >= 2:
            priority = "P1"
            action = "Stop repeated postpone loop: reassign accountable owner and set next update within 24h."
        elif overdue_soon:
            priority = "P1"
            action = "Preempt breach: pull due date left and confirm execution slot this week."

        recommendations.append(
            {
                "source": source,
                "priority": priority,
                "status": status,
                "postpone_count": postpone_count,
                "due_state": "overdue_now" if overdue_now else ("overdue_7d" if overdue_soon else "stable"),
                "action": action,
                "suggested_status": "in_progress" if priority in {"P0", "P1"} else "planned",
                "suggested_due_in_days": 0 if priority == "P0" else (1 if priority == "P1" else 3),
                "suggested_reason": "sla_auto_apply",
                "feedback_action": feedback_action or "none",
                "snooze_until": snooze_until.isoformat() if snooze_until else None,
                "is_dismissed": is_dismissed,
            }
        )

    recommendations.sort(
        key=lambda item: (
            {"P0": 0, "P1": 1, "P2": 2}.get(str(item.get("priority")), 3),
            -int(item.get("postpone_count", 0)),
            str(item.get("source", "")),
        )
    )
    return OwnerFunnelSystemTaskSlaRecommendationsOut(
        period_days=period_days,
        generated_at=now,
        recommendations=recommendations[:limit],
    )


@router.post("/owner-funnel/system-tasks-sla-recommendations/feedback", response_model=OwnerFunnelSystemTaskSlaRecommendationFeedbackOut)
async def set_owner_funnel_system_tasks_sla_recommendation_feedback(
    payload: OwnerFunnelSystemTaskSlaRecommendationFeedbackIn,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTaskSlaRecommendationFeedbackOut:
    source = str(payload.source or "").strip()
    if not source.startswith("export_"):
        raise HTTPException(status_code=400, detail="Only export_* system tasks are supported")
    action = str(payload.action or "").strip()
    now = datetime.now(timezone.utc)
    snooze_until = now + timedelta(days=payload.snooze_days or 3) if action == "snooze" else None
    db.add(
        AuditEvent(
            actor_user_id=current_user.id,
            clinic_id=None,
            action="owner_funnel.sla_recommendation_feedback",
            target_type="owner_funnel_sla_recommendation",
            target_id=source,
            metadata_json={
                "source": source,
                "action": action,
                "snooze_days": payload.snooze_days,
                "snooze_until": snooze_until.isoformat() if snooze_until else None,
            },
        )
    )
    await db.commit()
    return OwnerFunnelSystemTaskSlaRecommendationFeedbackOut(
        ok=True,
        source=source,
        action=action,
        snooze_until=snooze_until,
    )


@router.get("/owner-funnel/system-tasks-sla-lifecycle", response_model=OwnerFunnelSystemTaskSlaLifecycleOut)
async def get_owner_funnel_system_tasks_sla_lifecycle(
    period_days: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTaskSlaLifecycleOut:
    del current_user
    now = datetime.now(timezone.utc)
    since_dt = now - timedelta(days=period_days)
    rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_sla_recommendation",
                AuditEvent.action == "owner_funnel.sla_recommendation_feedback",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()

    def _build_lifecycle(rows_subset: list[AuditEvent], ref_now: datetime) -> tuple[int, int, int, int, int]:
        total_feedback_events = 0
        restored_events = 0
        latest_feedback_by_source: dict[str, tuple[str, datetime | None]] = {}
        for row in rows_subset:
            source_id = str(row.target_id or "").strip()
            if not source_id.startswith("export_"):
                continue
            meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
            action = str(meta.get("action") or "").strip()
            if action not in {"ack", "snooze", "restore"}:
                continue
            total_feedback_events += 1
            if action == "restore":
                restored_events += 1
            latest_feedback_by_source[source_id] = (action, _parse_due_at(meta.get("snooze_until")))

        acked_count = 0
        snoozed_count = 0
        for action, snooze_until in latest_feedback_by_source.values():
            if action == "ack":
                acked_count += 1
            elif action == "snooze" and snooze_until and snooze_until > ref_now:
                snoozed_count += 1
        active_count = len(latest_feedback_by_source) - acked_count - snoozed_count
        return total_feedback_events, max(0, active_count), acked_count, snoozed_count, restored_events

    total_feedback_events, active_count, acked_count, snoozed_count, restored_events = _build_lifecycle(rows, now)
    prev_from = now - timedelta(days=period_days * 2)
    prev_to = now - timedelta(days=period_days)
    prev_rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_sla_recommendation",
                AuditEvent.action == "owner_funnel.sla_recommendation_feedback",
                AuditEvent.created_at >= prev_from,
                AuditEvent.created_at < prev_to,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()
    _prev_total, prev_active_count, prev_acked_count, prev_snoozed_count, prev_restored_events = _build_lifecycle(prev_rows, prev_to)
    alert_click_rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.target_type == "owner_funnel_sla_alert",
                AuditEvent.action == "owner_funnel.sla_alert_cta_click",
                AuditEvent.created_at >= since_dt,
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()
    alert_cta_clicks = len(alert_click_rows)
    clicks_by_level: dict[str, int] = {"critical": 0, "warning": 0, "ok": 0, "unknown": 0}
    for row in alert_click_rows:
        meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
        level = str(meta.get("level") or "unknown").strip().lower()
        if level not in clicks_by_level:
            level = "unknown"
        clicks_by_level[level] += 1
    response_denominator = max(1, active_count + snoozed_count)
    alert_response_rate_pct = round((alert_cta_clicks / response_denominator) * 100, 1)
    alert_response_by_level: list[dict[str, str | int | float]] = []
    follow_up_rows = (
        await db.scalars(
            select(AuditEvent)
            .where(
                AuditEvent.created_at >= since_dt,
                or_(
                    and_(
                        AuditEvent.target_type == "owner_funnel_sla_recommendation",
                        AuditEvent.action == "owner_funnel.sla_recommendation_feedback",
                    ),
                    and_(
                        AuditEvent.target_type == "owner_funnel_playbook",
                        AuditEvent.action == "owner_funnel.playbook_status_set",
                    ),
                ),
            )
            .order_by(AuditEvent.created_at.asc())
        )
    ).all()
    follow_up_by_level: dict[str, int] = {"critical": 0, "warning": 0, "ok": 0, "unknown": 0}
    follow_up_ack_by_level: dict[str, int] = {"critical": 0, "warning": 0, "ok": 0, "unknown": 0}
    follow_up_done_by_level: dict[str, int] = {"critical": 0, "warning": 0, "ok": 0, "unknown": 0}
    follow_up_latency_by_level: dict[str, list[float]] = {"critical": [], "warning": [], "ok": [], "unknown": []}
    for click in alert_click_rows:
        click_meta = click.metadata_json if isinstance(click.metadata_json, dict) else {}
        click_level = str(click_meta.get("level") or "unknown").strip().lower()
        if click_level not in follow_up_by_level:
            click_level = "unknown"
        click_actor = click.actor_user_id
        click_time = click.created_at
        click_until = click_time + timedelta(hours=24)
        follow_up_type = ""
        for row in follow_up_rows:
            if row.created_at < click_time or row.created_at > click_until:
                continue
            if click_actor and row.actor_user_id != click_actor:
                continue
            if row.target_type == "owner_funnel_sla_recommendation" and row.action == "owner_funnel.sla_recommendation_feedback":
                meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
                action = str(meta.get("action") or "").strip()
                if action == "ack":
                    follow_up_type = "ack"
                    follow_up_latency_by_level[click_level].append(
                        max(0.0, (row.created_at - click_time).total_seconds() / 3600)
                    )
                    break
            if row.target_type == "owner_funnel_playbook" and row.action == "owner_funnel.playbook_status_set":
                target_id = str(row.target_id or "").strip()
                if not target_id.startswith("export_"):
                    continue
                meta = row.metadata_json if isinstance(row.metadata_json, dict) else {}
                status = str(meta.get("status") or "").strip()
                if status == "done":
                    follow_up_type = "done"
                    follow_up_latency_by_level[click_level].append(
                        max(0.0, (row.created_at - click_time).total_seconds() / 3600)
                    )
                    break
        if follow_up_type:
            follow_up_by_level[click_level] += 1
            if follow_up_type == "ack":
                follow_up_ack_by_level[click_level] += 1
            elif follow_up_type == "done":
                follow_up_done_by_level[click_level] += 1
    def _percentile(values: list[float], pct: float) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        if len(ordered) == 1:
            return round(ordered[0], 1)
        index = int(round((len(ordered) - 1) * pct))
        index = max(0, min(index, len(ordered) - 1))
        return round(ordered[index], 1)

    alert_follow_up_by_level: list[dict[str, str | int | float]] = []
    alert_follow_up_latency_by_level: list[dict[str, str | int | float]] = []
    critical_p90_hours = 0.0
    for level in ("critical", "warning", "ok", "unknown"):
        clicks = clicks_by_level[level]
        rate = round((clicks / response_denominator) * 100, 1)
        alert_response_by_level.append({"level": level, "clicks": clicks, "rate_pct": rate})
        follow_up_clicks = follow_up_by_level[level]
        follow_up_rate = round((follow_up_clicks / max(1, clicks)) * 100, 1)
        alert_follow_up_by_level.append(
            {
                "level": level,
                "follow_up_clicks_24h": follow_up_clicks,
                "follow_up_rate_pct": follow_up_rate,
                "ack_follow_up_24h": follow_up_ack_by_level[level],
                "done_follow_up_24h": follow_up_done_by_level[level],
            }
        )
        latencies = follow_up_latency_by_level[level]
        alert_follow_up_latency_by_level.append(
            {
                "level": level,
                "samples": len(latencies),
                "p50_hours": _percentile(latencies, 0.5),
                "p90_hours": _percentile(latencies, 0.9),
            }
        )
        if level == "critical":
            critical_p90_hours = _percentile(latencies, 0.9)

    latency_risk_level = "low"
    latency_risk_reason: str | None = None
    latency_auto_action: str | None = None
    if critical_p90_hours > 6:
        latency_risk_level = "high"
        latency_risk_reason = f"critical follow-up p90 is {critical_p90_hours}h (>6h)"
        latency_auto_action = "Assign on-call owner for critical SLA alerts and enforce first response checkpoint under 2h."
    elif critical_p90_hours > 3:
        latency_risk_level = "medium"
        latency_risk_reason = f"critical follow-up p90 is {critical_p90_hours}h (>3h)"
        latency_auto_action = "Review escalation rota and add reminder at 2h for unresolved critical alerts."
    return OwnerFunnelSystemTaskSlaLifecycleOut(
        period_days=period_days,
        total_feedback_events=total_feedback_events,
        active_count=active_count,
        acked_count=acked_count,
        snoozed_count=snoozed_count,
        restored_events=restored_events,
        active_delta_vs_prev=active_count - prev_active_count,
        acked_delta_vs_prev=acked_count - prev_acked_count,
        snoozed_delta_vs_prev=snoozed_count - prev_snoozed_count,
        restored_delta_vs_prev=restored_events - prev_restored_events,
        alert_cta_clicks=alert_cta_clicks,
        alert_response_rate_pct=alert_response_rate_pct,
        alert_response_by_level=alert_response_by_level,
        alert_follow_up_by_level=alert_follow_up_by_level,
        alert_follow_up_latency_by_level=alert_follow_up_latency_by_level,
        latency_risk_level=latency_risk_level,
        latency_risk_reason=latency_risk_reason,
        latency_auto_action=latency_auto_action,
    )


@router.post("/owner-funnel/system-tasks-sla-alert-cta-click", response_model=OwnerFunnelSystemTaskSlaAlertClickOut)
async def track_owner_funnel_system_tasks_sla_alert_cta_click(
    level: str = Query(default="unknown"),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelSystemTaskSlaAlertClickOut:
    now = datetime.now(timezone.utc)
    db.add(
        AuditEvent(
            actor_user_id=current_user.id,
            clinic_id=None,
            action="owner_funnel.sla_alert_cta_click",
            target_type="owner_funnel_sla_alert",
            target_id="review_top_risky_sources",
            metadata_json={"clicked_at": now.isoformat(), "level": str(level or "unknown").strip().lower()},
        )
    )
    await db.commit()
    return OwnerFunnelSystemTaskSlaAlertClickOut(ok=True, clicked_at=now)


@router.post("/owner-funnel/system-tasks-sla-latency-risk/escalate", response_model=OwnerFunnelPlaybookExportEscalationOut)
async def escalate_owner_funnel_system_tasks_sla_latency_risk(
    period_days: int = Query(default=30, ge=1, le=180),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_roles(RoleEnum.network_admin)),
) -> OwnerFunnelPlaybookExportEscalationOut:
    lifecycle = await get_owner_funnel_system_tasks_sla_lifecycle(
        period_days=period_days,
        db=db,
        current_user=current_user,
    )
    target_source = "export_latency_oncall_review"
    if lifecycle.latency_risk_level != "high":
        return OwnerFunnelPlaybookExportEscalationOut(
            ok=True,
            created=False,
            source=target_source,
            status="planned",
            reason="risk_not_high",
        )
    return await _escalate_system_playbook_task(
        db=db,
        current_user=current_user,
        source=target_source,
        status_when_exists="in_progress",
        trigger="latency_risk_high",
        trigger_meta={
            "trigger_period_days": period_days,
            "trigger_reason": lifecycle.latency_risk_reason,
        },
    )


class ClinicDashboard(BaseModel):
    clinic_id: str
    clinic_name: str
    period_days: int
    
    # Pet stats
    total_pets: int
    active_pets_last_30d: int
    
    # Visit stats
    total_visits: int
    completed_visits: int
    draft_visits: int
    
    # Appointment stats
    total_appointments: int
    scheduled_appointments: int
    completed_appointments: int
    cancelled_appointments: int
    
    # Financial
    total_revenue: int
    pending_invoices: int
    paid_invoices: int
    
    # Staff
    total_staff: int
    active_vets: int


class VetPerformance(BaseModel):
    vet_id: str
    vet_name: str
    
    visits_count: int
    completed_visits: int
    
    appointments_count: int
    completed_appointments: int
    
    revenue: int


class RevenueByMonth(BaseModel):
    month: str
    revenue: int
    visits_count: int


class DashboardResponse(BaseModel):
    dashboard: ClinicDashboard
    top_vets: list[VetPerformance]
    revenue_by_month: list[RevenueByMonth]


@router.get("/clinic/{clinic_id}/dashboard", response_model=DashboardResponse)
async def get_clinic_dashboard(
    clinic_id: str,
    period_days: int = Query(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
) -> DashboardResponse:
    """Get clinic analytics dashboard."""
    try:
        clinic_uuid = uuid.UUID(clinic_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="INVALID_CLINIC_ID")
    
    clinic = await db.get(Clinic, clinic_uuid)
    if not clinic:
        raise HTTPException(status_code=404, detail="CLINIC_NOT_FOUND")
    
    # Verify membership
    await require_clinic_membership(db, user_id=current_user.id, clinic_id=clinic_uuid)
    
    # Date range
    today = datetime.now(timezone.utc).date()
    start_date = today - timedelta(days=period_days)
    start_dt = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(today, time.max, tzinfo=timezone.utc)
    
    # Pet stats
    total_pets = await db.scalar(
        select(func.count(func.distinct(Visit.pet_id))).where(
            Visit.clinic_id == clinic.id
        )
    ) or 0
    
    active_pets_last_30d = await db.scalar(
        select(func.count(func.distinct(Visit.pet_id))).where(
            Visit.clinic_id == clinic.id,
            Visit.created_at >= datetime.now(timezone.utc) - timedelta(days=30)
        )
    ) or 0
    
    # Visit stats
    total_visits = await db.scalar(
        select(func.count(Visit.id)).where(
            Visit.clinic_id == clinic.id,
            Visit.created_at >= start_dt,
            Visit.created_at <= end_dt,
        )
    ) or 0
    
    completed_visits = await db.scalar(
        select(func.count(Visit.id)).where(
            Visit.clinic_id == clinic.id,
            Visit.created_at >= start_dt,
            Visit.created_at <= end_dt,
            Visit.status == VisitStatus.completed,
        )
    ) or 0
    
    draft_visits = await db.scalar(
        select(func.count(Visit.id)).where(
            Visit.clinic_id == clinic.id,
            Visit.created_at >= start_dt,
            Visit.created_at <= end_dt,
            Visit.status == VisitStatus.draft,
        )
    ) or 0
    
    # Appointment stats
    total_appointments = await db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic.id,
            Appointment.start_at >= start_dt,
            Appointment.start_at <= end_dt,
        )
    ) or 0
    
    scheduled_appointments = await db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic.id,
            Appointment.start_at >= start_dt,
            Appointment.start_at <= end_dt,
            Appointment.status == AppointmentStatus.scheduled,
        )
    ) or 0
    
    completed_appointments = await db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic.id,
            Appointment.start_at >= start_dt,
            Appointment.start_at <= end_dt,
            Appointment.status == AppointmentStatus.completed,
        )
    ) or 0
    
    cancelled_appointments = await db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.clinic_id == clinic.id,
            Appointment.start_at >= start_dt,
            Appointment.start_at <= end_dt,
            Appointment.status == AppointmentStatus.cancelled,
        )
    ) or 0
    
    # Financial
    total_revenue = await db.scalar(
        select(func.sum(Invoice.total_cents)).where(
            Invoice.clinic_id == clinic.id,
            Invoice.status == InvoiceStatus.paid,
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt,
        )
    ) or 0
    
    pending_invoices = await db.scalar(
        select(func.count(Invoice.id)).where(
            Invoice.clinic_id == clinic.id,
            Invoice.status == InvoiceStatus.issued,
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt,
        )
    ) or 0
    
    paid_invoices = await db.scalar(
        select(func.count(Invoice.id)).where(
            Invoice.clinic_id == clinic.id,
            Invoice.status == InvoiceStatus.paid,
            Invoice.created_at >= start_dt,
            Invoice.created_at <= end_dt,
        )
    ) or 0
    
    # Staff
    total_staff = await db.scalar(
        select(func.count(Membership.id)).where(
            Membership.clinic_id == clinic.id,
            Membership.status == MembershipStatus.active,
        )
    ) or 0
    
    active_vets = await db.scalar(
        select(func.count(Membership.id)).where(
            Membership.clinic_id == clinic.id,
            Membership.role_in_clinic == RoleEnum.vet,
            Membership.status == MembershipStatus.active,
        )
    ) or 0
    
    # Get top vets
    memberships = await db.scalars(
        select(Membership).where(
            Membership.clinic_id == clinic.id,
            Membership.role_in_clinic == RoleEnum.vet,
            Membership.status == MembershipStatus.active,
        )
    )
    vet_ids = [m.user_id for m in memberships.all()]
    
    top_vets = []
    if vet_ids:
        users = await db.scalars(select(User).where(User.id.in_(vet_ids)))
        user_map = {u.id: u.full_name or u.email for u in users.all()}
        
        for vet_id in vet_ids:
            visits_count = await db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.vet_id == vet_id,
                    Visit.clinic_id == clinic.id,
                    Visit.created_at >= start_dt,
                    Visit.created_at <= end_dt,
                )
            ) or 0
            
            completed = await db.scalar(
                select(func.count(Visit.id)).where(
                    Visit.vet_id == vet_id,
                    Visit.clinic_id == clinic.id,
                    Visit.created_at >= start_dt,
                    Visit.created_at <= end_dt,
                    Visit.status == VisitStatus.completed,
                )
            ) or 0
            
            appts_count = await db.scalar(
                select(func.count(Appointment.id)).where(
                    Appointment.vet_id == vet_id,
                    Appointment.clinic_id == clinic.id,
                    Appointment.start_at >= start_dt,
                    Appointment.start_at <= end_dt,
                )
            ) or 0
            
            completed_appts = await db.scalar(
                select(func.count(Appointment.id)).where(
                    Appointment.vet_id == vet_id,
                    Appointment.clinic_id == clinic.id,
                    Appointment.start_at >= start_dt,
                    Appointment.start_at <= end_dt,
                    Appointment.status == AppointmentStatus.completed,
                )
            ) or 0
            
            revenue = await db.scalar(
                select(func.sum(Invoice.total_cents)).join(Visit).where(
                    Visit.vet_id == vet_id,
                    Visit.clinic_id == clinic.id,
                    Invoice.status == InvoiceStatus.paid,
                    Invoice.created_at >= start_dt,
                    Invoice.created_at <= end_dt,
                )
            ) or 0
            
            top_vets.append(VetPerformance(
                vet_id=str(vet_id),
                vet_name=user_map.get(vet_id, "Unknown"),
                visits_count=visits_count,
                completed_visits=completed,
                appointments_count=appts_count,
                completed_appointments=completed_appts,
                revenue=int(revenue),
            ))
    
    # Sort by revenue
    top_vets.sort(key=lambda x: x.revenue, reverse=True)
    top_vets = top_vets[:5]
    
    # Revenue by month (last 6 months)
    revenue_by_month = []
    for i in range(5, -1, -1):
        month_start = (today.replace(day=1) - timedelta(days=i*30)).replace(day=1)
        month_end = (month_start + timedelta(days=32)).replace(day=1)
        month_start_dt = datetime.combine(month_start, time.min, tzinfo=timezone.utc)
        month_end_dt = datetime.combine(month_end, time.min, tzinfo=timezone.utc)
        
        month_rev = await db.scalar(
            select(func.sum(Invoice.total_cents)).where(
                Invoice.clinic_id == clinic.id,
                Invoice.status == InvoiceStatus.paid,
                Invoice.created_at >= month_start_dt,
                Invoice.created_at < month_end_dt,
            )
        ) or 0
        
        month_visits = await db.scalar(
            select(func.count(Visit.id)).where(
                Visit.clinic_id == clinic.id,
                Visit.created_at >= month_start_dt,
                Visit.created_at < month_end_dt,
            )
        ) or 0
        
        revenue_by_month.append(RevenueByMonth(
            month=month_start.strftime("%Y-%m"),
            revenue=int(month_rev),
            visits_count=month_visits,
        ))
    
    dashboard = ClinicDashboard(
        clinic_id=str(clinic.id),
        clinic_name=clinic.name,
        period_days=period_days,
        total_pets=total_pets,
        active_pets_last_30d=active_pets_last_30d,
        total_visits=total_visits,
        completed_visits=completed_visits,
        draft_visits=draft_visits,
        total_appointments=total_appointments,
        scheduled_appointments=scheduled_appointments,
        completed_appointments=completed_appointments,
        cancelled_appointments=cancelled_appointments,
        total_revenue=total_revenue,
        pending_invoices=pending_invoices,
        paid_invoices=paid_invoices,
        total_staff=total_staff,
        active_vets=active_vets,
    )
    
    return DashboardResponse(
        dashboard=dashboard,
        top_vets=top_vets,
        revenue_by_month=revenue_by_month,
    )