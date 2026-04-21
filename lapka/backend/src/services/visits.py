import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import Visit, VisitStatus
from src.repositories import (
    count_visits,
    create_visit as repo_create_visit,
    get_visit as repo_get_visit,
    get_latest_visit_for_pet,
    list_visits,
    list_visits_for_owner,
    list_visits_for_pet,
    update_visit as repo_update_visit,
)


class VisitService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_visit(self, visit_id: uuid.UUID) -> Visit:
        visit = await repo_get_visit(self.db, visit_id)
        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "VISIT_NOT_FOUND", "message": "Visit not found"},
            )
        return visit

    async def list_pet_visits(
        self,
        *,
        pet_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Visit]:
        return await list_visits_for_pet(
            self.db,
            pet_id=pet_id,
            limit=limit,
            offset=offset,
        )

    async def list_owner_visits(
        self,
        *,
        owner_user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Visit]:
        return await list_visits_for_owner(
            self.db,
            owner_user_id=owner_user_id,
            limit=limit,
            offset=offset,
        )

    async def create_visit(
        self,
        *,
        pet_id: uuid.UUID,
        clinic_id: uuid.UUID,
        vet_id: uuid.UUID,
        appointment_id: uuid.UUID | None = None,
        chief_complaint: str | None = None,
        **kwargs,
    ) -> Visit:
        latest = await get_latest_visit_for_pet(self.db, pet_id=pet_id)
        if latest and latest.status == VisitStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "VISIT_IN_PROGRESS",
                    "message": "Pet already has an active visit",
                },
            )

        visit = Visit(
            pet_id=pet_id,
            clinic_id=clinic_id,
            vet_id=vet_id,
            appointment_id=appointment_id,
            chief_complaint=chief_complaint,
            status=VisitStatus.scheduled,
            **kwargs,
        )
        return await repo_create_visit(self.db, visit)

    async def start_visit(self, visit_id: uuid.UUID) -> Visit:
        visit = await self.get_visit(visit_id)
        if visit.status != VisitStatus.scheduled:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_VISIT_STATUS",
                    "message": f"Cannot start visit with status {visit.status}",
                },
            )
        visit.status = VisitStatus.in_progress
        visit.started_at = datetime.utcnow()
        return await repo_update_visit(self.db, visit)

    async def finalize_visit(
        self,
        visit_id: uuid.UUID,
        *,
        assessment_note: str | None = None,
        plan_note: str | None = None,
        diagnosis_codes: List[str] | None = None,
    ) -> Visit:
        visit = await self.get_visit(visit_id)
        if visit.status != VisitStatus.in_progress:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "code": "INVALID_VISIT_STATUS",
                    "message": "Only in-progress visits can be finalized",
                },
            )

        visit.status = VisitStatus.completed
        visit.completed_at = datetime.utcnow()
        if assessment_note:
            visit.assessment_note = assessment_note
        if plan_note:
            visit.plan_note = plan_note

        return await repo_update_visit(self.db, visit)

    async def add_exam_findings(
        self,
        visit_id: uuid.UUID,
        *,
        exam_findings: str,
    ) -> Visit:
        visit = await self.get_visit(visit_id)
        visit.exam_findings = exam_findings
        return await repo_update_visit(self.db, visit)

    async def get_visit_summary(self, visit_id: uuid.UUID) -> dict:
        visit = await self.get_visit(visit_id)
        return {
            "id": str(visit.id),
            "pet_id": str(visit.pet_id),
            "clinic_id": str(visit.clinic_id),
            "vet_id": str(visit.vet_id),
            "status": visit.status.value,
            "chief_complaint": visit.chief_complaint,
            "exam_findings": visit.exam_findings,
            "assessment_note": visit.assessment_note,
            "plan_note": visit.plan_note,
            "created_at": visit.created_at.isoformat() if visit.created_at else None,
            "started_at": visit.started_at.isoformat() if visit.started_at else None,
            "completed_at": visit.completed_at.isoformat() if visit.completed_at else None,
        }