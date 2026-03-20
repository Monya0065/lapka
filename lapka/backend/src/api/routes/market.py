from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.rate_limit import enforce_rate_limit
from src.db.session import get_db_session
from src.models import (
    Clinic,
    ClinicLocation,
    DoctorSchedule,
    Membership,
    MembershipStatus,
    RatingsSummary,
    Review,
    ReviewModerationStatus,
    ReviewTargetType,
    RoleEnum,
    Service,
    User,
    VetProfile,
)
from src.security.deps import get_optional_current_user
from src.services.marketplace import haversine_km, is_open_now, serialize_ratings_summary
from src.utils.demo_media import resolve_demo_clinic_gallery, resolve_demo_clinic_photo, resolve_demo_vet_photo

router = APIRouter(prefix="/market", tags=["marketplace"])


def _as_uuid(value: str, field_name: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "BAD_REQUEST", "message": f"Invalid {field_name} format"},
        ) from exc


def _serialize_review(row: Review, author_name: str | None = None) -> dict:
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


async def _ratings_map(
    db: AsyncSession,
    *,
    target_type: ReviewTargetType,
    target_ids: list[uuid.UUID],
) -> dict[uuid.UUID, RatingsSummary]:
    if not target_ids:
        return {}
    rows = (
        await db.scalars(
            select(RatingsSummary).where(
                RatingsSummary.target_type == target_type,
                RatingsSummary.target_id.in_(target_ids),
            )
        )
    ).all()
    return {row.target_id: row for row in rows}


@router.get("/clinics")
async def market_clinics(
    request: Request,
    q: str | None = Query(default=None),
    city: str | None = Query(default=None),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    radius_km: float | None = Query(default=None, ge=0.1, le=100),
    service: str | None = Query(default=None),
    open_now: bool | None = Query(default=None),
    emergency: bool | None = Query(default=None),
    min_rating: float | None = Query(default=None, ge=1, le=5),
    limit: int = Query(default=60, ge=1, le=200),
    _current_user=Depends(get_optional_current_user),  # optional auth for public discovery
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    enforce_rate_limit(request, scope="market.clinics", limit=180, window_sec=60)
    query = select(Clinic).order_by(Clinic.name.asc())
    filters = []
    if city:
        filters.append(Clinic.city.ilike(f"%{city.strip()}%"))
    if q:
        needle = q.strip()
        filters.append(or_(Clinic.name.ilike(f"%{needle}%"), Clinic.description.ilike(f"%{needle}%")))
    if emergency is not None:
        filters.append(Clinic.emergency_available.is_(emergency))

    if service:
        query = query.join(Service, and_(Service.clinic_id == Clinic.id, Service.is_active.is_(True)))
        filters.append(Service.name.ilike(f"%{service.strip()}%"))

    if filters:
        query = query.where(*filters)

    clinics = (await db.scalars(query.limit(limit * 3))).all()
    clinic_ids = [row.id for row in clinics]
    ratings = await _ratings_map(db, target_type=ReviewTargetType.clinic, target_ids=clinic_ids)

    services_rows = (
        await db.scalars(
            select(Service).where(Service.clinic_id.in_(clinic_ids), Service.is_active.is_(True)).order_by(Service.name.asc())
        )
    ).all() if clinic_ids else []
    services_by_clinic: dict[uuid.UUID, list[str]] = {}
    for row in services_rows:
        services_by_clinic.setdefault(row.clinic_id, []).append(row.name)

    payload: list[dict] = []
    for clinic in clinics:
        open_flag = is_open_now(clinic.hours)
        if open_now is True and not open_flag:
            continue
        if open_now is False and open_flag:
            continue

        distance_km = None
        if lat is not None and lng is not None and clinic.latitude is not None and clinic.longitude is not None:
            distance_km = round(haversine_km(lat, lng, clinic.latitude, clinic.longitude), 2)
            if radius_km and distance_km > radius_km:
                continue

        summary = serialize_ratings_summary(ratings.get(clinic.id))
        if min_rating is not None and summary["avg_rating"] < min_rating:
            continue

        payload.append(
            {
                "id": str(clinic.id),
                "name": clinic.name,
                "description": clinic.description,
                "logo_url": resolve_demo_clinic_photo(logo_url=clinic.logo_url),
                "city": clinic.city,
                "address": clinic.address,
                "lat": clinic.latitude,
                "lng": clinic.longitude,
                "hours": clinic.hours,
                "phone": clinic.phone,
                "website": clinic.website,
                "open_now": open_flag,
                "emergency_available": clinic.emergency_available,
                "price_level": clinic.price_level,
                "services": services_by_clinic.get(clinic.id, [])[:5],
                "rating_summary": summary,
                "distance_km": distance_km,
            }
        )

    if lat is not None and lng is not None:
        payload.sort(key=lambda row: row["distance_km"] if row["distance_km"] is not None else 10_000)
    else:
        payload.sort(key=lambda row: (-row["rating_summary"]["avg_rating"], -row["rating_summary"]["count"], row["name"]))
    return payload[:limit]


@router.get("/clinics/{clinic_id}")
async def market_clinic_details(
    request: Request,
    clinic_id: str,
    _current_user=Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    enforce_rate_limit(request, scope="market.clinic.details", limit=220, window_sec=60)
    clinic_uuid = _as_uuid(clinic_id, "clinic_id")
    clinic = await db.scalar(select(Clinic).where(Clinic.id == clinic_uuid))
    if not clinic:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "CLINIC_NOT_FOUND", "message": "Clinic not found"},
        )

    services = (
        await db.scalars(
            select(Service).where(Service.clinic_id == clinic.id, Service.is_active.is_(True)).order_by(Service.name.asc())
        )
    ).all()
    locations = (
        await db.scalars(
            select(ClinicLocation).where(ClinicLocation.clinic_id == clinic.id).order_by(ClinicLocation.is_primary.desc())
        )
    ).all()

    vet_rows = (
        await db.execute(
            select(User, VetProfile)
            .join(Membership, Membership.user_id == User.id)
            .outerjoin(VetProfile, VetProfile.vet_id == User.id)
            .where(
                Membership.clinic_id == clinic.id,
                Membership.status == MembershipStatus.active,
                Membership.role_in_clinic == RoleEnum.vet,
                User.role == RoleEnum.vet,
                User.is_active.is_(True),
            )
            .order_by(User.full_name.asc())
        )
    ).all()

    vet_ids = [user.id for user, _profile in vet_rows]
    vet_ratings = await _ratings_map(db, target_type=ReviewTargetType.vet, target_ids=vet_ids)
    clinic_rating = await db.scalar(
        select(RatingsSummary).where(
            RatingsSummary.target_type == ReviewTargetType.clinic,
            RatingsSummary.target_id == clinic.id,
        )
    )

    reviews = (
        await db.execute(
            select(Review, User.full_name)
            .join(User, User.id == Review.owner_user_id)
            .where(
                Review.target_type == ReviewTargetType.clinic,
                Review.target_id == clinic.id,
                Review.moderation_status == ReviewModerationStatus.published,
            )
            .order_by(Review.created_at.desc())
            .limit(6)
        )
    ).all()

    return {
        "id": str(clinic.id),
        "name": clinic.name,
        "description": clinic.description,
        "logo_url": resolve_demo_clinic_photo(clinic_name=clinic.name, photos=clinic.photos_json or [], logo_url=clinic.logo_url),
        "photos": resolve_demo_clinic_gallery(clinic_name=clinic.name),
        "address": clinic.address,
        "city": clinic.city,
        "lat": clinic.latitude,
        "lng": clinic.longitude,
        "hours": clinic.hours,
        "phone": clinic.phone,
        "website": clinic.website,
        "open_now": is_open_now(clinic.hours),
        "emergency_available": clinic.emergency_available,
        "price_level": clinic.price_level,
        "rating_summary": serialize_ratings_summary(clinic_rating),
        "locations": [
            {
                "id": str(row.id),
                "address": row.address,
                "city": row.city,
                "lat": row.latitude,
                "lng": row.longitude,
                "hours": row.hours,
                "phone": row.phone,
                "is_primary": row.is_primary,
            }
            for row in locations
        ],
        "services": [
            {
                "id": str(row.id),
                "name": row.name,
                "duration_min": row.duration_min,
                "price": row.price,
            }
            for row in services
        ],
        "vets": [
            {
                "id": str(user.id),
                "full_name": user.full_name,
                "specialty": profile.specialty if profile else None,
                "experience_years": profile.experience_years if profile else None,
                "photo_url": resolve_demo_vet_photo(specialty=profile.specialty if profile else None, photo_url=profile.photo_url if profile else None),
                "languages": profile.languages_json if profile else [],
                "working_hours": profile.working_hours if profile else None,
                "rating_summary": serialize_ratings_summary(vet_ratings.get(user.id)),
            }
            for user, profile in vet_rows
        ],
        "reviews_preview": [_serialize_review(review, author_name) for review, author_name in reviews],
    }


@router.get("/clinics/{clinic_id}/reviews")
async def market_clinic_reviews(
    request: Request,
    clinic_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=60),
    _current_user=Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    enforce_rate_limit(request, scope="market.clinic.reviews", limit=200, window_sec=60)
    clinic_uuid = _as_uuid(clinic_id, "clinic_id")
    offset = int(cursor or "0")
    query = (
        select(Review, User.full_name)
        .join(User, User.id == Review.owner_user_id)
        .where(
            Review.target_type == ReviewTargetType.clinic,
            Review.target_id == clinic_uuid,
            Review.moderation_status == ReviewModerationStatus.published,
        )
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    next_cursor = str(offset + limit) if len(rows) == limit else None
    return {
        "items": [_serialize_review(review, author_name) for review, author_name in rows],
        "next_cursor": next_cursor,
    }


@router.get("/vets")
async def market_vets(
    request: Request,
    q: str | None = Query(default=None),
    specialty: str | None = Query(default=None),
    clinic_id: str | None = Query(default=None),
    lat: float | None = Query(default=None),
    lng: float | None = Query(default=None),
    radius_km: float | None = Query(default=None, ge=0.1, le=100),
    limit: int = Query(default=80, ge=1, le=200),
    _current_user=Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[dict]:
    enforce_rate_limit(request, scope="market.vets", limit=180, window_sec=60)
    query = (
        select(User, Membership, Clinic, VetProfile)
        .join(Membership, Membership.user_id == User.id)
        .join(Clinic, Clinic.id == Membership.clinic_id)
        .outerjoin(VetProfile, VetProfile.vet_id == User.id)
        .where(
            Membership.status == MembershipStatus.active,
            Membership.role_in_clinic == RoleEnum.vet,
            User.role == RoleEnum.vet,
            User.is_active.is_(True),
        )
        .order_by(User.full_name.asc())
    )
    if clinic_id:
        query = query.where(Clinic.id == _as_uuid(clinic_id, "clinic_id"))
    if q:
        needle = q.strip()
        query = query.where(
            or_(
                User.full_name.ilike(f"%{needle}%"),
                VetProfile.specialty.ilike(f"%{needle}%"),
            )
        )
    if specialty:
        query = query.where(VetProfile.specialty.ilike(f"%{specialty.strip()}%"))

    rows = (await db.execute(query.limit(limit * 3))).all()
    vet_ids = [user.id for user, _membership, _clinic, _profile in rows]
    ratings = await _ratings_map(db, target_type=ReviewTargetType.vet, target_ids=vet_ids)

    payload = []
    for user, _membership, clinic, profile in rows:
        distance_km = None
        if lat is not None and lng is not None and clinic.latitude is not None and clinic.longitude is not None:
            distance_km = round(haversine_km(lat, lng, clinic.latitude, clinic.longitude), 2)
            if radius_km and distance_km > radius_km:
                continue

        payload.append(
            {
                "id": str(user.id),
                "full_name": user.full_name,
                "specialty": profile.specialty if profile else None,
                "experience_years": profile.experience_years if profile else None,
                "photo_url": resolve_demo_vet_photo(photo_url=profile.photo_url if profile else None),
                "languages": profile.languages_json if profile else [],
                "bio": profile.bio if profile else None,
                "working_hours": profile.working_hours if profile else None,
                "clinic": {
                    "id": str(clinic.id),
                    "name": clinic.name,
                    "city": clinic.city,
                    "address": clinic.address,
                    "lat": clinic.latitude,
                    "lng": clinic.longitude,
                },
                "distance_km": distance_km,
                "rating_summary": serialize_ratings_summary(ratings.get(user.id)),
            }
        )

    if lat is not None and lng is not None:
        payload.sort(key=lambda row: row["distance_km"] if row["distance_km"] is not None else 10_000)
    else:
        payload.sort(key=lambda row: (-row["rating_summary"]["avg_rating"], -row["rating_summary"]["count"], row["full_name"]))
    return payload[:limit]


@router.get("/vets/{vet_id}")
async def market_vet_details(
    request: Request,
    vet_id: str,
    _current_user=Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    enforce_rate_limit(request, scope="market.vet.details", limit=220, window_sec=60)
    vet_uuid = _as_uuid(vet_id, "vet_id")
    row = await db.execute(
        select(User, Membership, Clinic, VetProfile)
        .join(Membership, Membership.user_id == User.id)
        .join(Clinic, Clinic.id == Membership.clinic_id)
        .outerjoin(VetProfile, VetProfile.vet_id == User.id)
        .where(
            User.id == vet_uuid,
            User.role == RoleEnum.vet,
            User.is_active.is_(True),
            Membership.status == MembershipStatus.active,
            Membership.role_in_clinic == RoleEnum.vet,
        )
        .order_by(Membership.created_at.asc())
        .limit(1)
    )
    result = row.first()
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "VET_NOT_FOUND", "message": "Vet not found"},
        )

    user, _membership, clinic, profile = result
    rating = await db.scalar(
        select(RatingsSummary).where(
            RatingsSummary.target_type == ReviewTargetType.vet,
            RatingsSummary.target_id == user.id,
        )
    )
    schedules = (
        await db.scalars(select(DoctorSchedule).where(DoctorSchedule.vet_id == user.id).order_by(DoctorSchedule.weekday.asc()))
    ).all()
    reviews = (
        await db.execute(
            select(Review, User.full_name)
            .join(User, User.id == Review.owner_user_id)
            .where(
                Review.target_type == ReviewTargetType.vet,
                Review.target_id == user.id,
                Review.moderation_status == ReviewModerationStatus.published,
            )
            .order_by(Review.created_at.desc())
            .limit(8)
        )
    ).all()

    return {
        "id": str(user.id),
        "full_name": user.full_name,
        "specialty": profile.specialty if profile else None,
        "experience_years": profile.experience_years if profile else None,
        "photo_url": resolve_demo_vet_photo(specialty=profile.specialty if profile else None, photo_url=profile.photo_url if profile else None),
        "languages": profile.languages_json if profile else [],
        "bio": profile.bio if profile else None,
        "working_hours": profile.working_hours if profile else None,
        "rating_summary": serialize_ratings_summary(rating),
        "clinic": {
            "id": str(clinic.id),
            "name": clinic.name,
            "address": clinic.address,
            "city": clinic.city,
            "phone": clinic.phone,
            "website": clinic.website,
            "logo_url": resolve_demo_clinic_photo(clinic_name=clinic.name, photos=clinic.photos_json or [], logo_url=clinic.logo_url),
            "photo_url": resolve_demo_clinic_photo(clinic_name=clinic.name, photos=clinic.photos_json or [], logo_url=clinic.logo_url),
        },
        "schedule_preview": [
            {
                "weekday": row.weekday,
                "start_time": row.start_time.isoformat(timespec="minutes"),
                "end_time": row.end_time.isoformat(timespec="minutes"),
                "slot_duration": row.slot_duration,
            }
            for row in schedules[:7]
        ],
        "reviews_preview": [_serialize_review(review, author_name) for review, author_name in reviews],
    }


@router.get("/vets/{vet_id}/reviews")
async def market_vet_reviews(
    request: Request,
    vet_id: str,
    cursor: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=60),
    _current_user=Depends(get_optional_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> dict:
    enforce_rate_limit(request, scope="market.vet.reviews", limit=200, window_sec=60)
    vet_uuid = _as_uuid(vet_id, "vet_id")
    offset = int(cursor or "0")
    query = (
        select(Review, User.full_name)
        .join(User, User.id == Review.owner_user_id)
        .where(
            Review.target_type == ReviewTargetType.vet,
            Review.target_id == vet_uuid,
            Review.moderation_status == ReviewModerationStatus.published,
        )
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    rows = (await db.execute(query)).all()
    next_cursor = str(offset + limit) if len(rows) == limit else None
    return {
        "items": [_serialize_review(review, author_name) for review, author_name in rows],
        "next_cursor": next_cursor,
    }
