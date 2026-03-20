from __future__ import annotations

import math
import re
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import RatingsSummary, Review, ReviewModerationStatus, ReviewTargetType

PROFANITY_TOKENS = {
    "лохотрон",
    "мошенники",
    "обман",
    "убью",
    "ненавижу",
}

SPAM_PATTERNS = [
    re.compile(r"https?://", re.IGNORECASE),
    re.compile(r"t\.me/", re.IGNORECASE),
    re.compile(r"(.)\1{8,}"),
]


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return radius * c


def is_open_now(hours_text: str | None) -> bool:
    if not hours_text:
        return False
    hours = hours_text.strip().lower()
    if "круглосуточ" in hours or "24/7" in hours:
        return True

    match = re.search(r"(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})", hours)
    if not match:
        return False

    start_h, start_m, end_h, end_m = [int(part) for part in match.groups()]
    now = datetime.now(timezone.utc).astimezone()
    start_minutes = start_h * 60 + start_m
    end_minutes = end_h * 60 + end_m
    current_minutes = now.hour * 60 + now.minute
    if end_minutes >= start_minutes:
        return start_minutes <= current_minutes <= end_minutes
    return current_minutes >= start_minutes or current_minutes <= end_minutes


def moderation_decision(*, title: str | None, text: str) -> tuple[ReviewModerationStatus, str | None]:
    content = f"{title or ''} {text}".strip().lower()
    if any(token in content for token in PROFANITY_TOKENS):
        return ReviewModerationStatus.rejected, "Нарушение правил общения"

    for pattern in SPAM_PATTERNS:
        if pattern.search(content):
            return ReviewModerationStatus.pending, "Требуется ручная модерация"

    if len(content) < 10:
        return ReviewModerationStatus.pending, "Слишком короткий текст, нужна проверка"

    return ReviewModerationStatus.published, None


def rating_distribution(rows: list[Review]) -> dict[str, int]:
    distribution = {str(value): 0 for value in range(1, 6)}
    for row in rows:
        distribution[str(row.rating)] = distribution.get(str(row.rating), 0) + 1
    return distribution


async def recalculate_ratings_summary(
    db: AsyncSession,
    *,
    target_type: ReviewTargetType,
    target_id: uuid.UUID,
) -> RatingsSummary:
    rows = (
        await db.scalars(
            select(Review).where(
                Review.target_type == target_type,
                Review.target_id == target_id,
                Review.moderation_status == ReviewModerationStatus.published,
            )
        )
    ).all()

    count = len(rows)
    avg_rating = round(sum(row.rating for row in rows) / count, 2) if count else 0.0
    distribution = rating_distribution(rows)

    summary = await db.scalar(
        select(RatingsSummary).where(
            RatingsSummary.target_type == target_type,
            RatingsSummary.target_id == target_id,
        )
    )
    if summary:
        summary.avg_rating = avg_rating
        summary.count = count
        summary.distribution_json = distribution
    else:
        summary = RatingsSummary(
            target_type=target_type,
            target_id=target_id,
            avg_rating=avg_rating,
            count=count,
            distribution_json=distribution,
        )
        db.add(summary)
        await db.flush()
    return summary


def serialize_ratings_summary(summary: RatingsSummary | None) -> dict:
    if not summary:
        return {
            "avg_rating": 0.0,
            "count": 0,
            "distribution": {str(value): 0 for value in range(1, 6)},
        }
    return {
        "avg_rating": float(summary.avg_rating or 0.0),
        "count": int(summary.count or 0),
        "distribution": summary.distribution_json or {str(value): 0 for value in range(1, 6)},
    }
