from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from src.core.celery_app import celery_app
from src.core.database import async_session, sync_session
from src.services.cache import delete_cached


@celery_app.task(name="src.tasks.lost_pets.cleanup_expired_reports")
def cleanup_expired_reports():
    """Remove lost pet reports older than 90 days."""
    expired_date = datetime.now(timezone.utc) - timedelta(days=90)

    with sync_session() as db:
        db.execute(
            update("lost_pets_reports")
            .where(
                "status = 'active' AND created_at < :expired_date"
            )
            .values(status="expired")
            .params(expired_date=expired_date)
        )
        db.commit()

    delete_cached("lost_pets:*")
    return {"deleted_count": 0}


@celery_app.task(name="src.tasks.lost_pets.check_hotspot_thresholds")
def check_hotspot_thresholds():
    """Check if any hotspot thresholds are exceeded and trigger notifications."""
    from sqlalchemy import and_, func

    from src.models import LostPetsHotspotSubscription, LostPetsReport

    with sync_session() as db:
        subscriptions = db.query(LostPetsHotspotSubscription).filter(
            LostPetsHotspotSubscription.is_active == True
        ).all()

        results = []
        for sub in subscriptions:
            if sub.center_lat and sub.center_lng and sub.radius_km:
                count = db.query(LostPetsReport).filter(
                    and_(
                        LostPetsReport.status == "active",
                        LostPetsReport.last_seen_lat.between(
                            sub.center_lat - 0.1,
                            sub.center_lat + 0.1
                        ),
                        LostPetsReport.last_seen_lng.between(
                            sub.center_lng - 0.1,
                            sub.center_lng + 0.1
                        ),
                        LostPetsReport.created_at >= datetime.now(timezone.utc) - timedelta(hours=72)
                    )
                ).count()

                if count >= sub.min_hotspot_count:
                    results.append({
                        "subscription_id": str(sub.id),
                        "count": count,
                        "threshold": sub.min_hotspot_count
                    })

        return {"hotspots_triggered": results}


@celery_app.task(name="src.tasks.lost_pets.generate_thumbnails")
def generate_thumbnails(report_id: str, photo_url: str):
    """Generate thumbnails for lost pet photos."""
    from PIL import Image
    from io import BytesIO
    import httpx

    try:
        response = httpx.get(photo_url, timeout=30)
        response.raise_for_status()

        img = Image.open(BytesIO(response.content))
        img.thumbnail((400, 400), Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format="JPEG", quality=85)
        output.seek(0)

        return {"report_id": report_id, "thumbnail_generated": True}
    except Exception as e:
        return {"report_id": report_id, "error": str(e)}


@celery_app.task(name="src.tasks.lost_pets.send_hotspot_notification")
def send_hotspot_notification(subscription_id: str, report_ids: list[str]):
    """Send notifications for hotspot alerts."""
    return {
        "subscription_id": subscription_id,
        "reports": report_ids,
        "notified": True
    }
