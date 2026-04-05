from __future__ import annotations

import uuid
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.session import get_db_session
from src.models import (
    Appointment,
    AppointmentStatus,
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
from src.security.deps import get_current_user, require_clinic_membership
from src.security.deps import get_current_user, require_clinic_membership

router = APIRouter(prefix="/analytics", tags=["analytics"])


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