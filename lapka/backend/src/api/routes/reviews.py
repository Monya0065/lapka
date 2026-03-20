from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Clinic,
    Review,
    ReviewModerationStatus,
    ReviewTargetType,
    RoleEnum,
    User,
    Visit,
)
from src.security.deps import (
    get_optional_current_user,
    require_owner_of_pet,
    require_roles,
    get_clinic_context,
)
from src.core.rate_limit import enforce_rate_limit
from src.services.audit import log_audit
from src.services.marketplace import moderation_decision, recalculate_ratings_summary

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreateRequest(BaseModel):
    target_type: ReviewTargetType
    target_id: str
    rating: int = Field(ge=1, le=5)
    title: str | None = Field(default=None, min_length=2, max_length=255)
    text: str = Field(min_length=3, max_length=3000)
    visit_id: str | None = None


class ReviewModerateRequest(BaseModel):
    status: ReviewModerationStatus
    reason: str | None = Field(default=None, max_length=255)


def _as_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": f"Invalid {field_name} format"},
        ) from exc


def _serialize(row: Review, author_name: str | None = None) -> dict:
    return {
        "id": str(row.id),
        "target_type": row.target_type.value,
        "target_id": str(row.target_id),
        "rating": row.rating,
        "title": row.title,
        "text": row.text,
        "visit_id": str(row.visit_id) if row.visit_id else None,
        "verified": bool(row.verified),
        "status": row.moderation_status.value,
        "author_name": author_name,
        "created_at": row.created_at,
    }


@router.get("")
async def list_reviews(
    request: Request,
    target_type: ReviewTargetType | None = Query(default=None),
    target_id: str | None = Query(default=None),
    vet_id: str | None = Query(default=None),  # backward-compatible filter
    clinic_id: str | None = Depends(get_clinic_context),  # clinic context or query
    status_filter: ReviewModerationStatus | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    current_user=Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    if current_user is None:
        enforce_rate_limit(request, scope="reviews.public", limit=120, window_sec=60)

    query = select(Review, User.full_name).join(User, User.id == Review.owner_user_id)

    if vet_id and not target_id:
        target_type = ReviewTargetType.vet
        target_id = vet_id
    if clinic_id and not target_id:
        target_type = ReviewTargetType.clinic
        target_id = clinic_id

    if target_type:
        query = query.where(Review.target_type == target_type)
    if target_id:
        query = query.where(Review.target_id == _as_uuid(target_id, "target_id"))

    if status_filter:
        if current_user is None or current_user.role not in {RoleEnum.clinic_admin, RoleEnum.network_admin}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "FORBIDDEN", "message": "Status filter requires admin role"},
            )
        query = query.where(Review.moderation_status == status_filter)
    else:
        query = query.where(Review.moderation_status == ReviewModerationStatus.published)

    rows = (await db.execute(query.order_by(Review.created_at.desc()).limit(limit))).all()
    return [_serialize(review, author_name) for review, author_name in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_review(
    payload: ReviewCreateRequest,
    current_user=Depends(require_roles(RoleEnum.owner)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    target_uuid = _as_uuid(payload.target_id, "target_id")

    if payload.target_type == ReviewTargetType.clinic:
        clinic = await db.scalar(select(Clinic).where(Clinic.id == target_uuid))
        if not clinic:
            raise HTTPException(status_code=404, detail={"code": "CLINIC_NOT_FOUND", "message": "Clinic not found"})
    else:
        vet = await db.scalar(select(User).where(User.id == target_uuid, User.role == RoleEnum.vet))
        if not vet:
            raise HTTPException(status_code=404, detail={"code": "VET_NOT_FOUND", "message": "Vet not found"})

    # Simple anti-spam rate limit for owners.
    ten_minutes_ago = datetime.now(timezone.utc) - timedelta(minutes=10)
    recent_count = await db.scalar(
        select(func.count(Review.id)).where(
            Review.owner_user_id == current_user.id,
            Review.created_at >= ten_minutes_ago,
        )
    )
    if int(recent_count or 0) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "RATE_LIMITED", "message": "Too many review attempts. Try later."},
        )

    visit_uuid = _as_uuid(payload.visit_id, "visit_id") if payload.visit_id else None
    visit_row = None
    verified = False
    if visit_uuid:
        visit_row = await db.scalar(select(Visit).where(Visit.id == visit_uuid))
        if not visit_row:
            raise HTTPException(status_code=404, detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"})

        await require_owner_of_pet(db, owner_user_id=current_user.id, pet_id=visit_row.pet_id)
        if payload.target_type == ReviewTargetType.clinic and visit_row.clinic_id != target_uuid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "REVIEW_TARGET_MISMATCH", "message": "Visit clinic does not match review target"},
            )
        if payload.target_type == ReviewTargetType.vet and visit_row.vet_id != target_uuid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "REVIEW_TARGET_MISMATCH", "message": "Visit vet does not match review target"},
            )
        verified = True

    if visit_uuid:
        existing = await db.scalar(
            select(Review).where(
                Review.owner_user_id == current_user.id,
                Review.target_type == payload.target_type,
                Review.target_id == target_uuid,
                Review.visit_id == visit_uuid,
            )
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "REVIEW_EXISTS", "message": "Review already exists for this target and visit"},
            )

    moderation_status, moderation_reason = moderation_decision(title=payload.title, text=payload.text)
    row = Review(
        owner_user_id=current_user.id,
        visit_id=visit_uuid,
        vet_id=visit_row.vet_id if visit_row else (target_uuid if payload.target_type == ReviewTargetType.vet else None),
        target_type=payload.target_type,
        target_id=target_uuid,
        title=payload.title.strip() if payload.title else None,
        text=payload.text.strip(),
        rating=payload.rating,
        verified=verified,
        moderation_status=moderation_status,
    )
    db.add(row)
    await db.flush()

    await recalculate_ratings_summary(
        db,
        target_type=payload.target_type,
        target_id=target_uuid,
    )
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=str(visit_row.clinic_id) if visit_row else (payload.target_id if payload.target_type == ReviewTargetType.clinic else None),
        action="review.create",
        target_type="review",
        target_id=str(row.id),
        metadata={
            "status": moderation_status.value,
            "target_type": payload.target_type.value,
            "target_id": str(target_uuid),
            "verified": verified,
            "moderation_reason": moderation_reason,
        },
    )

    await db.commit()
    await db.refresh(row)

    return {
        "id": str(row.id),
        "status": row.moderation_status.value,
        "verified": row.verified,
        "message": (
            "Отзыв опубликован."
            if row.moderation_status == ReviewModerationStatus.published
            else "Отзыв отправлен на модерацию."
        ),
    }


@router.patch("/{review_id}/moderate")
async def moderate_review(
    review_id: str,
    payload: ReviewModerateRequest,
    current_user=Depends(require_roles(RoleEnum.clinic_admin, RoleEnum.network_admin)),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    row = await db.scalar(select(Review).where(Review.id == _as_uuid(review_id, "review_id")))
    if not row:
        raise HTTPException(status_code=404, detail={"code": "NOT_FOUND", "message": "Review not found"})

    row.moderation_status = payload.status
    await recalculate_ratings_summary(db, target_type=row.target_type, target_id=row.target_id)
    await log_audit(
        db,
        actor_user_id=str(current_user.id),
        clinic_id=None,
        action="review.moderate",
        target_type="review",
        target_id=str(row.id),
        metadata={"status": payload.status.value, "reason": payload.reason},
    )
    await db.commit()
    return {"status": "updated"}
