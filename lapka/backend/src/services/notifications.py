import uuid
from typing import List

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Notification, NotificationChannel, NotificationType
from src.repositories import (
    count_unread_notifications as repo_count_unread,
    create_notification as repo_create_notification,
    get_notification as repo_get_notification,
    list_notifications as repo_list_notifications,
    mark_all_notifications_read as repo_mark_all_read,
    mark_notification_read as repo_mark_read,
)


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_notifications(
        self,
        *,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
        is_read: bool | None = None,
    ) -> List[Notification]:
        return await repo_list_notifications(
            self.db,
            user_id=user_id,
            limit=limit,
            offset=offset,
            is_read=is_read,
        )

    async def get_unread_count(self, *, user_id: uuid.UUID) -> int:
        return await repo_count_unread(self.db, user_id=user_id)

    async def create_notification(
        self,
        *,
        user_id: uuid.UUID,
        notification_type: NotificationType,
        title: str,
        body: str,
        channel: NotificationChannel = NotificationChannel.in_app,
        action_url: str | None = None,
        metadata: dict | None = None,
        pet_id: uuid.UUID | None = None,
        visit_id: uuid.UUID | None = None,
        appointment_id: uuid.UUID | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            channel=channel,
            action_url=action_url,
            metadata_json=metadata or {},
            pet_id=pet_id,
            visit_id=visit_id,
            appointment_id=appointment_id,
        )
        return await repo_create_notification(self.db, notification)

    async def mark_read(self, notification_id: uuid.UUID) -> Notification:
        notification = await repo_get_notification(self.db, notification_id)
        if not notification:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Notification not found"},
            )
        return await repo_mark_read(self.db, notification_id)

    async def mark_all_read(self, *, user_id: uuid.UUID) -> int:
        return await repo_mark_all_read(self.db, user_id=user_id)

    async def notify_appointment_reminder(
        self,
        *,
        user_id: uuid.UUID,
        pet_name: str,
        clinic_name: str,
        scheduled_at: str,
    ) -> Notification:
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.appointment_reminder,
            title="Напоминание о визите",
            body=f"Визит для {pet_name} в {clinic_name} запланирован на {scheduled_at}",
            action_url=f"/owner/appointments",
        )

    async def notify_document_ready(
        self,
        *,
        user_id: uuid.UUID,
        document_title: str,
    ) -> Notification:
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.document_ready,
            title="Документ готов",
            body=f"Документ '{document_title}' загружен и доступен для скачивания",
            action_url=f"/owner/documents",
        )

    async def notify_consent_request(
        self,
        *,
        user_id: uuid.UUID,
        clinic_name: str,
    ) -> Notification:
        return await self.create_notification(
            user_id=user_id,
            notification_type=NotificationType.consent_request,
            title="Запрос согласия",
            body=f"Клиника {clinic_name} запрашивает доступ к медицинским данным вашего питомца",
            action_url=f"/owner/consents",
        )


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    notification_type: NotificationType,
    title: str,
    body: str,
    channel: NotificationChannel = NotificationChannel.in_app,
    action_url: str | None = None,
    metadata: dict | None = None,
    pet_id: uuid.UUID | None = None,
    visit_id: uuid.UUID | None = None,
    appointment_id: uuid.UUID | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        body=body,
        channel=channel,
        action_url=action_url,
        metadata_json=metadata or {},
        pet_id=pet_id,
        visit_id=visit_id,
        appointment_id=appointment_id,
    )
    return await repo_create_notification(db, notification)


async def list_user_notifications(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    limit: int = 50,
    offset: int = 0,
    is_read: bool | None = None,
    unread_only: bool = False,
) -> List[Notification]:
    if unread_only:
        is_read = False
    return await repo_list_notifications(
        db,
        user_id=user_id,
        limit=limit,
        offset=offset,
        is_read=is_read,
    )


async def mark_notifications_read(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> int:
    return await repo_mark_all_read(db, user_id=user_id)