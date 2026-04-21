from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    Numeric,
    String,
    Time,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from src.db.base import Base


class RoleEnum(str, enum.Enum):
    owner = "owner"
    vet = "vet"
    clinic_admin = "clinic_admin"
    network_admin = "network_admin"
    volunteer = "volunteer"
    shelter = "shelter"
    sponsor = "sponsor"


class MembershipStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"


class ConsentScope(str, enum.Enum):
    prescriptions_only = "PRESCRIPTIONS_ONLY"
    basic_medical = "BASIC_MEDICAL"
    full_record = "FULL_RECORD"
    inpatient_view = "INPATIENT_VIEW"
    camera_view = "CAMERA_VIEW"


class ConsentRequestStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"


class InpatientStatus(str, enum.Enum):
    active = "active"
    discharged = "discharged"


class InpatientPublicStatus(str, enum.Enum):
    stable = "stable"
    monitoring = "monitoring"
    needs_attention = "needs_attention"


class InpatientEventType(str, enum.Enum):
    status_update = "status_update"
    photo_report = "photo_report"
    note = "note"
    document_added = "document_added"
    camera_viewed = "camera_viewed"
    vitals_check = "vitals_check"
    feeding = "feeding"
    procedure = "procedure"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no_show"

    # Legacy statuses kept for backward-compatible reads.
    new = "new"
    waiting = "waiting"


class VisitStatus(str, enum.Enum):
    draft = "draft"
    in_progress = "in_progress"
    completed = "completed"


class ReviewModerationStatus(str, enum.Enum):
    published = "published"
    pending = "pending"
    rejected = "rejected"
    hidden = "hidden"


class ReviewTargetType(str, enum.Enum):
    clinic = "clinic"
    vet = "vet"


class ReminderType(str, enum.Enum):
    vaccine = "vaccine"
    checkup = "checkup"
    medication = "medication"


class NotificationType(str, enum.Enum):
    appointment_confirmed = "appointment_confirmed"
    appointment_reminder = "appointment_reminder"
    visit_ready = "visit_ready"
    inpatient_update = "inpatient_update"


class NotificationChannel(str, enum.Enum):
    in_app = "in_app"
    email = "email"
    sms = "sms"


class LostPetStatus(str, enum.Enum):
    active = "active"
    found = "found"
    closed = "closed"


class LostPetModerationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    blocked = "blocked"


class ReferralStatus(str, enum.Enum):
    sent = "sent"
    registered = "registered"


class ClinicInviteStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PlaceType(str, enum.Enum):
    clinic = "clinic"
    emergency_clinic = "emergency_clinic"
    pharmacy = "pharmacy"
    park = "park"
    pet_store = "pet_store"


class PharmacyType(str, enum.Enum):
    offline = "offline"
    online = "online"
    both = "both"


class ClinicServiceCategory(str, enum.Enum):
    consultation = "consultation"
    vaccination = "vaccination"
    imaging = "imaging"
    lab = "lab"
    surgery = "surgery"
    inpatient = "inpatient"
    telemedicine = "telemedicine"
    other = "other"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    issued = "issued"
    paid = "paid"
    void = "void"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"


class InsurancePolicyStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    cancelled = "cancelled"


class InsuranceClaimStatus(str, enum.Enum):
    draft = "draft"
    submitted = "submitted"
    approved = "approved"
    rejected = "rejected"


class LabOrderStatus(str, enum.Enum):
    created = "created"
    sent = "sent"
    received = "received"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum, name="role_enum", native_enum=False), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_users_phone", "phone"),
        Index("idx_users_full_name", "full_name"),
    )


class LegalAcceptance(Base):
    __tablename__ = "legal_acceptances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    document_type: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "document_type", "version", name="uq_legal_acceptances_user_doc_version"),
        Index("idx_legal_acceptances_user", "user_id"),
    )


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    refresh_token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Clinic(Base):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    logo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    photos_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    hours: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    emergency_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    price_level: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Membership(Base):
    __tablename__ = "memberships"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    role_in_clinic: Mapped[RoleEnum] = mapped_column(
        Enum(RoleEnum, name="clinic_role_enum", native_enum=False), nullable=False
    )
    status: Mapped[MembershipStatus] = mapped_column(
        Enum(MembershipStatus, name="membership_status_enum", native_enum=False),
        default=MembershipStatus.active,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "clinic_id", name="uq_membership_user_clinic"),)


class ClinicLocation(Base):
    __tablename__ = "clinic_locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    hours: Mapped[str | None] = mapped_column(String(128), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_clinic_locations_city", "city"),
        Index("idx_clinic_locations_clinic", "clinic_id"),
    )


class ClinicResource(Base):
    __tablename__ = "clinic_resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    clinic_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinic_locations.id", ondelete="CASCADE"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False, default="room")
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "clinic_id",
            "clinic_location_id",
            "name",
            name="uq_clinic_resources_scope_name",
        ),
        Index("idx_clinic_resources_clinic_scope", "clinic_id", "clinic_location_id", "is_active"),
        Index("idx_clinic_resources_type", "resource_type"),
    )


class ClinicSchedulerSettings(Base):
    __tablename__ = "clinic_scheduler_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    clinic_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinic_locations.id", ondelete="CASCADE"),
        nullable=True,
    )
    default_buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    day_start_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    day_end_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=21)
    slot_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "clinic_id",
            "clinic_location_id",
            name="uq_clinic_scheduler_settings_scope",
        ),
        CheckConstraint("default_buffer_minutes >= 0 AND default_buffer_minutes <= 180", name="ck_scheduler_buffer"),
        CheckConstraint("day_start_hour >= 0 AND day_start_hour <= 23", name="ck_scheduler_day_start"),
        CheckConstraint("day_end_hour >= 1 AND day_end_hour <= 24", name="ck_scheduler_day_end"),
        CheckConstraint("day_end_hour > day_start_hour", name="ck_scheduler_day_window"),
        CheckConstraint(
            "slot_interval_minutes >= 10 AND slot_interval_minutes <= 180",
            name="ck_scheduler_slot_interval",
        ),
        Index("idx_clinic_scheduler_settings_clinic_scope", "clinic_id", "clinic_location_id"),
    )


class MasterPet(Base):
    __tablename__ = "master_pets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lapka_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    species: Mapped[str] = mapped_column(String(64), nullable=False)
    breed: Mapped[str | None] = mapped_column(String(128), nullable=True)
    color: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sex: Mapped[str | None] = mapped_column(String(16), nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date(), nullable=True)
    chip_id: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    passport_id: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)
    photo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_master_pets_name", "name"),
        Index("idx_master_pets_species", "species"),
        Index("idx_master_pets_chip", "chip_id"),
        Index("idx_master_pets_passport", "passport_id"),
        Index("idx_master_pets_lapka_id", "lapka_id"),
    )


class PetOwnerLink(Base):
    __tablename__ = "pet_owner_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (UniqueConstraint("pet_id", "owner_user_id", name="uq_pet_owner"),)


class ConsentGrant(Base):
    __tablename__ = "consent_grants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    scope_level: Mapped[ConsentScope] = mapped_column(
        Enum(ConsentScope, name="consent_scope_enum", native_enum=False), nullable=False
    )
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_consent_active", "clinic_id", "pet_id", "scope_level", postgresql_where=(revoked_at.is_(None))),
    )


class ConsentRequest(Base):
    __tablename__ = "consent_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    requested_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE")
    )
    requested_scope: Mapped[ConsentScope] = mapped_column(
        Enum(ConsentScope, name="consent_request_scope_enum", native_enum=False),
        nullable=False,
        default=ConsentScope.basic_medical,
    )
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ConsentRequestStatus] = mapped_column(
        Enum(ConsentRequestStatus, name="consent_request_status_enum", native_enum=False),
        nullable=False,
        default=ConsentRequestStatus.pending,
    )
    decision_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_consent_requests_pet_status", "pet_id", "status"),
        Index("idx_consent_requests_clinic_status", "clinic_id", "status"),
        Index("idx_consent_requests_requester", "requested_by_user_id", "created_at"),
    )


class PetQrToken(Base):
    __tablename__ = "pet_qr_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_pet_qr_tokens_pet", "pet_id"),
        Index("idx_pet_qr_tokens_active", "pet_id", "revoked_at"),
    )


class PetPassport(Base):
    __tablename__ = "pet_passports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    public_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    allow_unmasked_phone: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allergies_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    include_microchip: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("pet_id", name="uq_pet_passports_pet"),
        Index("idx_pet_passports_token", "public_token"),
        Index("idx_pet_passports_pet_revoked", "pet_id", "revoked_at"),
    )


class LostPetReport(Base):
    __tablename__ = "lost_pet_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    last_seen_location: Mapped[str] = mapped_column(String(255), nullable=False)
    last_seen_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    status: Mapped[LostPetStatus] = mapped_column(
        Enum(LostPetStatus, name="lost_pet_status_enum", native_enum=False),
        nullable=False,
        default=LostPetStatus.active,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    last_seen_lat: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    last_seen_lng: Mapped[float | None] = mapped_column(Numeric(9, 6), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    allow_phone_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    promotion_tier: Mapped[str | None] = mapped_column(String(32), nullable=True)
    promoted_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    moderation_status: Mapped[LostPetModerationStatus] = mapped_column(
        Enum(LostPetModerationStatus, name="lost_pet_moderation_status_enum", native_enum=False),
        nullable=False,
        default=LostPetModerationStatus.approved,
    )
    moderation_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    risk_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    moderated_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_lost_pet_reports_city_status", "city", "status"),
        Index("idx_lost_pet_reports_owner_created", "owner_id", "created_at"),
        Index("idx_lost_pet_reports_pet_created", "pet_id", "created_at"),
        Index("idx_lost_pet_reports_status_created", "status", "created_at"),
        Index("idx_lost_pet_reports_geo", "last_seen_lat", "last_seen_lng"),
        Index("idx_lost_pet_reports_promoted", "promotion_tier", "promoted_until"),
    )


class LostPetSighting(Base):
    __tablename__ = "lost_pet_sightings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lost_pet_reports.id", ondelete="CASCADE")
    )
    reporter_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    reporter_contact: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location_note: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lost_pet_sightings_report_created", "report_id", "created_at"),
    )


class LostPetVolunteerRating(Base):
    __tablename__ = "lost_pet_volunteer_ratings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sighting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lost_pet_sightings.id", ondelete="CASCADE")
    )
    rater_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lost_pet_volunteer_ratings_sighting", "sighting_id"),
        Index("idx_lost_pet_volunteer_ratings_user", "rater_user_id"),
    )


class VolunteerStats(Base):
    __tablename__ = "lost_pet_volunteer_stats"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True)
    total_sightings: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_calls: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    avg_rating: Mapped[float] = mapped_column(Numeric(3, 2), nullable=False, default=0)
    badge_level: Mapped[str] = mapped_column(String(32), nullable=False, default="bronze")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lost_pet_volunteer_stats_rating", "avg_rating", "badge_level"),
    )


class LostPetPremiumAd(Base):
    __tablename__ = "lost_pet_premium_ads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lost_pet_reports.id", ondelete="CASCADE")
    )
    tier: Mapped[str] = mapped_column(String(32), nullable=False, default="boost")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_lost_pet_premium_ads_active", "is_active", "ends_at"),
    )


class VolunteerBadge(Base):
    __tablename__ = "lost_pet_volunteer_badges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    badge_type: Mapped[str] = mapped_column(String(64), nullable=False)
    badge_name: Mapped[str] = mapped_column(String(128), nullable=False)
    earned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lost_pet_badges_user", "user_id", "badge_type"),
    )


class Referral(Base):
    __tablename__ = "referrals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inviter_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    invited_email: Mapped[str] = mapped_column(String(255), nullable=False)
    referral_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    status: Mapped[ReferralStatus] = mapped_column(
        Enum(ReferralStatus, name="referral_status_enum", native_enum=False),
        nullable=False,
        default=ReferralStatus.sent,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    registered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_referrals_inviter_created", "inviter_user_id", "created_at"),
        Index("idx_referrals_email", "invited_email"),
    )


class ClinicInvite(Base):
    __tablename__ = "clinic_invites"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inviter_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    clinic_name: Mapped[str] = mapped_column(String(255), nullable=False)
    clinic_email: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ClinicInviteStatus] = mapped_column(
        Enum(ClinicInviteStatus, name="clinic_invite_status_enum", native_enum=False),
        nullable=False,
        default=ClinicInviteStatus.pending,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_clinic_invites_status_created", "status", "created_at"),
        Index("idx_clinic_invites_email", "clinic_email"),
        Index("idx_clinic_invites_inviter", "inviter_user_id", "created_at"),
    )


class Visit(Base):
    __tablename__ = "visits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="RESTRICT"))
    vet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    status: Mapped[VisitStatus] = mapped_column(
        Enum(VisitStatus, name="visit_status_enum", native_enum=False),
        nullable=False,
        default=VisitStatus.draft,
    )
    complaints: Mapped[str | None] = mapped_column(Text, nullable=True)
    anamnesis: Mapped[str | None] = mapped_column(Text, nullable=True)
    physical_exam: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnostics: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessment_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    attachments_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finalized_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    chief_complaint: Mapped[str | None] = mapped_column(Text, nullable=True)
    exam_findings: Mapped[str | None] = mapped_column(Text, nullable=True)
    plan_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    finalized_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_visits_pet_created_at", "pet_id", "created_at"),
        Index("idx_visits_clinic_created_at", "clinic_id", "created_at"),
        Index("idx_visits_appointment", "appointment_id"),
        Index("idx_visits_status_created_at", "status", "created_at"),
    )


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id", ondelete="CASCADE"))
    drug_name: Mapped[str] = mapped_column(String(255), nullable=False)
    instruction_note: Mapped[str] = mapped_column(Text, nullable=False)
    prescription_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="RESTRICT"))
    uploaded_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    doc_type: Mapped[str] = mapped_column(String(64), nullable=False)
    file_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_documents_pet_created_at", "pet_id", "created_at"),
        Index("idx_documents_clinic_created_at", "clinic_id", "created_at"),
    )


class VaccineEntry(Base):
    __tablename__ = "vaccine_entries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True
    )
    vaccine_name: Mapped[str] = mapped_column(String(255), nullable=False)
    administered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    next_due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_vaccine_entries_pet_date", "pet_id", "administered_at"),
        Index("idx_vaccine_entries_next_due", "next_due_date"),
    )


class InpatientStay(Base):
    __tablename__ = "inpatient_stays"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="RESTRICT"))
    attending_vet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    ward: Mapped[str] = mapped_column(String(64), nullable=False)
    bed: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[InpatientStatus] = mapped_column(
        Enum(InpatientStatus, name="inpatient_status_enum", native_enum=False),
        default=InpatientStatus.active,
        nullable=False,
    )
    public_status_label: Mapped[InpatientPublicStatus] = mapped_column(
        Enum(InpatientPublicStatus, name="inpatient_public_status_enum", native_enum=False),
        default=InpatientPublicStatus.monitoring,
        nullable=False,
    )
    owner_visible_summary: Mapped[str] = mapped_column(Text, nullable=False, default="Пациент под наблюдением команды.")
    admitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    discharged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_inpatient_status_clinic", "status", "clinic_id"),
        Index("idx_inpatient_pet_status", "pet_id", "status"),
    )


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stay_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inpatient_stays.id", ondelete="CASCADE"))
    camera_name: Mapped[str] = mapped_column(String(128), nullable=False)
    stream_ref_stub: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class InpatientPlan(Base):
    __tablename__ = "inpatient_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stay_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inpatient_stays.id", ondelete="CASCADE"))
    plan_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    task_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_inpatient_plans_stay_date", "stay_id", "plan_date"),
    )


class InpatientObservation(Base):
    __tablename__ = "inpatient_observations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stay_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inpatient_stays.id", ondelete="CASCADE"))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    temperature_c: Mapped[str | None] = mapped_column(String(16), nullable=True)
    appetite: Mapped[str | None] = mapped_column(String(64), nullable=True)
    activity: Mapped[str | None] = mapped_column(String(64), nullable=True)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_inpatient_observations_stay_time", "stay_id", "observed_at"),
    )


class InpatientEvent(Base):
    __tablename__ = "inpatient_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stay_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inpatient_stays.id", ondelete="CASCADE"))
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    event_type: Mapped[InpatientEventType] = mapped_column(
        Enum(InpatientEventType, name="inpatient_event_type_enum", native_enum=False),
        nullable=False,
    )
    owner_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description_safe: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_inpatient_events_stay_time", "stay_id", "created_at"),
        Index("idx_inpatient_events_owner_visible", "stay_id", "owner_visible"),
    )


class InpatientPhotoReport(Base):
    __tablename__ = "inpatient_photo_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stay_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("inpatient_stays.id", ondelete="CASCADE"))
    taken_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    caption: Mapped[str] = mapped_column(String(255), nullable=False)
    file_ref: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_inpatient_photos_stay_time", "stay_id", "taken_at"),
    )


class CameraAccessToken(Base):
    __tablename__ = "camera_access_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    camera_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cameras.id", ondelete="CASCADE"))
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    one_time_flag: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class CameraAccessLog(Base):
    __tablename__ = "camera_access_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("camera_access_tokens.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    result: Mapped[str] = mapped_column(String(32), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_camera_access_logs_created", "created_at"),
    )


class PublicLink(Base):
    __tablename__ = "public_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    link_type: Mapped[str] = mapped_column(String(64), nullable=False)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("visits.id", ondelete="CASCADE"), nullable=True)
    pet_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=True)
    document_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Service(Base):
    __tablename__ = "services"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    duration_min: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    price: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_services_clinic_active", "clinic_id", "is_active"),
    )


class ClinicService(Base):
    __tablename__ = "clinic_services"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[ClinicServiceCategory] = mapped_column(
        Enum(ClinicServiceCategory, name="clinic_service_category_enum", native_enum=False),
        nullable=False,
        default=ClinicServiceCategory.consultation,
    )
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="RUB")
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("clinic_id", "name", name="uq_clinic_services_clinic_name"),
        Index("idx_clinic_services_clinic_active", "clinic_id", "is_active"),
        Index("idx_clinic_services_clinic_category", "clinic_id", "category"),
    )


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL"), nullable=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status_enum", native_enum=False),
        nullable=False,
        default=InvoiceStatus.draft,
    )
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="RUB")
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    public_token: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_invoices_clinic_status_created", "clinic_id", "status", "created_at"),
        Index("idx_invoices_owner_created", "owner_id", "created_at"),
        Index("idx_invoices_pet_created", "pet_id", "created_at"),
        Index("idx_invoices_public_token", "public_token"),
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"))
    service_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_services.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    unit_price_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("qty > 0", name="ck_invoice_items_qty_positive"),
        Index("idx_invoice_items_invoice", "invoice_id"),
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"))
    provider: Mapped[str] = mapped_column(String(64), nullable=False, default="demo")
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status_enum", native_enum=False),
        nullable=False,
        default=PaymentStatus.pending,
    )
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(8), nullable=False, default="RUB")
    receipt_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_payments_invoice_created", "invoice_id", "created_at"),
        Index("idx_payments_status_created", "status", "created_at"),
    )


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    provider_name: Mapped[str] = mapped_column(String(255), nullable=False)
    policy_number_masked: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[InsurancePolicyStatus] = mapped_column(
        Enum(InsurancePolicyStatus, name="insurance_policy_status_enum", native_enum=False),
        nullable=False,
        default=InsurancePolicyStatus.active,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_insurance_policies_owner_created", "owner_id", "created_at"),
        Index("idx_insurance_policies_status", "status"),
    )


class InsuranceClaim(Base):
    __tablename__ = "insurance_claims"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"))
    status: Mapped[InsuranceClaimStatus] = mapped_column(
        Enum(InsuranceClaimStatus, name="insurance_claim_status_enum", native_enum=False),
        nullable=False,
        default=InsuranceClaimStatus.draft,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_insurance_claims_clinic_status", "clinic_id", "status"),
        Index("idx_insurance_claims_owner_created", "owner_id", "created_at"),
        Index("idx_insurance_claims_invoice", "invoice_id"),
    )


class LabProvider(Base):
    __tablename__ = "lab_providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False, default="demo")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lab_providers_active", "is_active"),
    )


class LabOrder(Base):
    __tablename__ = "lab_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL"), nullable=True
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_providers.id", ondelete="RESTRICT"))
    status: Mapped[LabOrderStatus] = mapped_column(
        Enum(LabOrderStatus, name="lab_order_status_enum", native_enum=False),
        nullable=False,
        default=LabOrderStatus.created,
    )
    ordered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    external_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_lab_orders_clinic_status", "clinic_id", "status"),
        Index("idx_lab_orders_pet_ordered", "pet_id", "ordered_at"),
        Index("idx_lab_orders_visit", "visit_id"),
    )


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    order_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("lab_orders.id", ondelete="CASCADE"))
    result_text: Mapped[str] = mapped_column(Text, nullable=False)
    attachments_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_lab_results_order_created", "order_id", "created_at"),
    )


class VetProfile(Base):
    __tablename__ = "vet_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    vet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    specialty: Mapped[str | None] = mapped_column(String(128), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    languages_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    working_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_vet_profiles_clinic", "clinic_id"),
        Index("idx_vet_profiles_specialty", "specialty"),
    )


class AppointmentType(Base):
    __tablename__ = "appointment_types"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    default_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    is_telemedicine: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("clinic_id", "code", name="uq_appointment_types_clinic_code"),
        UniqueConstraint("clinic_id", "name", name="uq_appointment_types_clinic_name"),
        Index("idx_appointment_types_clinic_active", "clinic_id", "is_active"),
    )


class DoctorSchedule(Base):
    __tablename__ = "doctor_schedules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    vet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    weekday: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    end_time: Mapped[time] = mapped_column(Time(timezone=False), nullable=False)
    slot_duration: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("weekday >= 0 AND weekday <= 6", name="ck_doctor_schedule_weekday"),
        CheckConstraint("slot_duration >= 10 AND slot_duration <= 180", name="ck_doctor_schedule_slot_duration"),
        UniqueConstraint(
            "clinic_id",
            "vet_id",
            "weekday",
            "start_time",
            "end_time",
            name="uq_doctor_schedule_unique_span",
        ),
        Index("idx_doctor_schedule_clinic_weekday", "clinic_id", "weekday"),
        Index("idx_doctor_schedule_vet_weekday", "vet_id", "weekday"),
    )


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    vet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    clinic_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_locations.id", ondelete="SET NULL"), nullable=True
    )
    clinic_resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinic_resources.id", ondelete="SET NULL"), nullable=True
    )
    appointment_type_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointment_types.id", ondelete="SET NULL"), nullable=True
    )
    service_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    service_name: Mapped[str] = mapped_column(String(255), nullable=False)
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    room_label: Mapped[str | None] = mapped_column(String(128), nullable=True)
    buffer_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    visit_type: Mapped[str] = mapped_column(String(32), nullable=False, default="clinic_visit")
    video_link: Mapped[str | None] = mapped_column(String(512), nullable=True)
    meeting_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status_enum", native_enum=False),
        nullable=False,
        default=AppointmentStatus.scheduled,
    )
    flow_stage: Mapped[str] = mapped_column(String(32), nullable=False, default="scheduled")
    urgency_level: Mapped[str] = mapped_column(String(16), nullable=False, default="routine")
    protocol_status: Mapped[str] = mapped_column(String(32), nullable=False, default="not_started")
    discharge_ready: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_appointments_clinic_start", "clinic_id", "start_at"),
        Index("idx_appointments_clinic_location_start", "clinic_id", "clinic_location_id", "start_at"),
        Index("idx_appointments_clinic_resource_start", "clinic_id", "clinic_resource_id", "start_at"),
        Index("idx_appointments_vet_start", "vet_id", "start_at"),
        Index("idx_appointments_owner_start", "owner_user_id", "start_at"),
        Index("idx_appointments_status_start", "status", "start_at"),
        Index("idx_appointments_flow_stage_start", "flow_stage", "start_at"),
        # Unique slot for active statuses to prevent scheduling conflicts.
        Index(
            "uq_appointments_vet_start_active",
            "vet_id",
            "start_at",
            unique=True,
            postgresql_where=(
                status.in_(
                    [
                        AppointmentStatus.scheduled,
                        AppointmentStatus.confirmed,
                        AppointmentStatus.in_progress,
                        AppointmentStatus.new,
                        AppointmentStatus.waiting,
                    ]
                )
            ),
        ),
    )


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pet_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="CASCADE"))
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), nullable=True
    )
    reminder_type: Mapped[ReminderType] = mapped_column(
        Enum(ReminderType, name="reminder_type_enum", native_enum=False), nullable=False
    )
    remind_before_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    channel: Mapped[str | None] = mapped_column(String(32), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_reminders_owner_due", "owner_user_id", "due_at"),
        Index("idx_reminders_pet_due", "pet_id", "due_at"),
        Index("idx_reminders_appointment", "appointment_id"),
    )


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    pet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("master_pets.id", ondelete="SET NULL"), nullable=True
    )
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL"), nullable=True
    )
    notification_type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType, name="notification_type_enum", native_enum=False), nullable=False
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        Enum(NotificationChannel, name="notification_channel_enum", native_enum=False),
        nullable=False,
        server_default=NotificationChannel.in_app.value,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_notifications_user_created", "user_id", "created_at"),
        Index("idx_notifications_user_unread", "user_id", "is_read"),
    )


class Place(Base):
    __tablename__ = "places"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    place_type: Mapped[PlaceType] = mapped_column(
        Enum(PlaceType, name="place_type_enum", native_enum=False), nullable=False
    )
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    latitude: Mapped[float] = mapped_column(nullable=False)
    longitude: Mapped[float] = mapped_column(nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    hours: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("name", "city", "place_type", name="uq_places_name_city_type"),
        Index("idx_places_type_city", "place_type", "city"),
        Index("idx_places_city_name", "city", "name"),
    )


class Template(Base):
    __tablename__ = "templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    template_type: Mapped[str] = mapped_column(String(64), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    scope: Mapped[str] = mapped_column(String(32), nullable=False, default="clinic")
    specialty: Mapped[str | None] = mapped_column(String(64), nullable=True)
    visibility: Mapped[str] = mapped_column(String(32), nullable=False, default="clinic")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    source_template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id", ondelete="SET NULL"), nullable=True
    )
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    scenario_tags_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    usage_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_templates_clinic_type", "clinic_id", "template_type"),
        Index("idx_templates_clinic_scope_status", "clinic_id", "scope", "status"),
    )


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    visit_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("visits.id", ondelete="SET NULL"), nullable=True
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    vet_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    target_type: Mapped[ReviewTargetType] = mapped_column(
        Enum(ReviewTargetType, name="review_target_type_enum", native_enum=False),
        nullable=False,
        default=ReviewTargetType.clinic,
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    moderation_status: Mapped[ReviewModerationStatus] = mapped_column(
        Enum(ReviewModerationStatus, name="review_moderation_status_enum", native_enum=False),
        nullable=False,
        default=ReviewModerationStatus.pending,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_reviews_target_created", "target_type", "target_id", "created_at"),
        Index("idx_reviews_vet_created", "vet_id", "created_at"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
    )


class RatingsSummary(Base):
    __tablename__ = "ratings_summary"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    target_type: Mapped[ReviewTargetType] = mapped_column(
        Enum(ReviewTargetType, name="ratings_target_type_enum", native_enum=False), nullable=False
    )
    target_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    avg_rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    distribution_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("target_type", "target_id", name="uq_ratings_summary_target"),
        Index("idx_ratings_summary_target", "target_type", "target_id"),
    )


class Disease(Base):
    __tablename__ = "diseases"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    species: Mapped[str] = mapped_column(String(128), nullable=False, default="cat,dog")
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    symptoms_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    emergency_level: Mapped[str] = mapped_column(String(16), nullable=False, default="YELLOW")
    prevalence: Mapped[str] = mapped_column(String(32), nullable=False, default="common")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint(
            "category IN ('dermatology','gastroenterology','neurology','cardiology','infectious','trauma','toxicology','respiratory','urinary','endocrine','ophthalmology')",
            name="ck_diseases_category_allowed",
        ),
        CheckConstraint("emergency_level IN ('GREEN','YELLOW','RED')", name="ck_diseases_emergency_level"),
        CheckConstraint("prevalence IN ('common','uncommon','rare')", name="ck_diseases_prevalence"),
        Index("idx_diseases_name", "name"),
        Index("idx_diseases_category", "category"),
        Index("idx_diseases_species", "species"),
        Index("idx_diseases_emergency_level", "emergency_level"),
    )


class ClinicalProtocol(Base):
    __tablename__ = "clinical_protocols"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    species: Mapped[str] = mapped_column(String(128), nullable=False, default="cat,dog")
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    steps_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    emergency_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "category IN ('general','emergency','gastroenterology','neurology','trauma','anesthesia','surgery','toxicology','inpatient','diagnostics','cardiology','respiratory')",
            name="ck_clinical_protocols_category_allowed",
        ),
        Index("idx_clinical_protocols_name", "name"),
        Index("idx_clinical_protocols_category", "category"),
        Index("idx_clinical_protocols_species", "species"),
        Index("idx_clinical_protocols_emergency_flag", "emergency_flag"),
    )


class Symptom(Base):
    __tablename__ = "symptoms"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    species: Mapped[str] = mapped_column(String(128), nullable=False, default="cat,dog")
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    severity: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    emergency_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint("severity >= 1 AND severity <= 5", name="ck_symptoms_severity_range"),
        Index("idx_symptoms_name", "name"),
        Index("idx_symptoms_category", "category"),
        Index("idx_symptoms_species", "species"),
        Index("idx_symptoms_emergency_flag", "emergency_flag"),
    )


class Drug(Base):
    __tablename__ = "drugs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    external_id: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    active_substance: Mapped[str | None] = mapped_column(String(255), nullable=True)
    group_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    species_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    forms_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    prescription_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    controlled_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    indications_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    contraindications_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    side_effects_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    interactions_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    warnings_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    storage_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    clinical_notes_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    popularity_rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_drugs_name", "name"),
        Index("idx_drugs_active_substance", "active_substance"),
        Index("idx_drugs_prescription_required", "prescription_required"),
        Index("idx_drugs_popularity_rank", "popularity_rank"),
    )


class DrugImage(Base):
    __tablename__ = "drug_images"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    image_type: Mapped[str] = mapped_column(String(32), nullable=False, default="packshot")
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("drug_id", "url", name="uq_drug_images_drug_url"),
        Index("idx_drug_images_drug_sort", "drug_id", "sort_order"),
    )


class DrugVariant(Base):
    __tablename__ = "drug_variants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    form: Mapped[str] = mapped_column(String(64), nullable=False)
    strength_text: Mapped[str | None] = mapped_column(String(128), nullable=True)
    pack_size_text: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sku_text: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_drug_variants_drug_form", "drug_id", "form"),
    )


class DrugAnalog(Base):
    __tablename__ = "drug_analogs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    analog_drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    relation_type: Mapped[str] = mapped_column(String(64), nullable=False, default="class")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("drug_id", "analog_drug_id", name="uq_drug_analogs_pair"),
        Index("idx_drug_analogs_drug", "drug_id"),
    )


class DrugWarning(Base):
    __tablename__ = "drug_warnings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    warning_text: Mapped[str] = mapped_column(Text, nullable=False)
    severity: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_drug_warnings_drug", "drug_id"),
    )


class Pharmacy(Base):
    __tablename__ = "pharmacies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    pharmacy_type: Mapped[PharmacyType] = mapped_column(
        Enum(PharmacyType, name="pharmacy_type_enum", native_enum=False),
        nullable=False,
        default=PharmacyType.offline,
    )
    website: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("name", "pharmacy_type", name="uq_pharmacies_name_type"),
        Index("idx_pharmacies_type", "pharmacy_type"),
    )


class PharmacyLocation(Base):
    __tablename__ = "pharmacy_locations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clinics.id", ondelete="SET NULL"),
        nullable=True,
    )
    pharmacy_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("pharmacies.id", ondelete="CASCADE"))
    city: Mapped[str] = mapped_column(String(128), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    hours: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_pharmacy_locations_city", "city"),
        Index("idx_pharmacy_locations_pharmacy", "pharmacy_id"),
        Index("idx_pharmacy_locations_clinic", "clinic_id"),
    )


class PharmacyInventory(Base):
    __tablename__ = "pharmacy_inventory"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    pharmacy_location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pharmacy_locations.id", ondelete="CASCADE")
    )
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drug_variants.id", ondelete="SET NULL"), nullable=True
    )
    in_stock: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    price_text: Mapped[str] = mapped_column(String(64), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("pharmacy_location_id", "drug_id", "variant_id", name="uq_inventory_location_drug_variant"),
        Index("idx_inventory_drug_stock", "drug_id", "in_stock"),
        Index("idx_inventory_location", "pharmacy_location_id"),
        Index("idx_inventory_expires_at", "expires_at"),
    )


class OnlineStore(Base):
    __tablename__ = "online_stores"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    website: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class OnlineOffer(Base):
    __tablename__ = "online_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    online_store_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("online_stores.id", ondelete="CASCADE"))
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drug_variants.id", ondelete="SET NULL"), nullable=True
    )
    price_text: Mapped[str] = mapped_column(String(64), nullable=False)
    delivery_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("online_store_id", "drug_id", "variant_id", name="uq_online_offer_store_drug_variant"),
        Index("idx_online_offers_drug", "drug_id"),
        Index("idx_online_offers_store", "online_store_id"),
    )


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    price_text: Mapped[str] = mapped_column(String(64), nullable=False)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_price_snapshots_drug_time", "drug_id", "captured_at"),
    )


class AvailabilityQuery(Base):
    __tablename__ = "availability_queries"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    role: Mapped[str | None] = mapped_column(String(32), nullable=True)
    drug_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="SET NULL"), nullable=True)
    city: Mapped[str | None] = mapped_column(String(128), nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    radius_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_availability_queries_drug_time", "drug_id", "created_at"),
        Index("idx_availability_queries_user_time", "user_id", "created_at"),
    )


class Substitution(Base):
    __tablename__ = "substitutions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    substitute_drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("drug_id", "substitute_drug_id", name="uq_substitutions_pair"),
        Index("idx_substitutions_drug", "drug_id"),
    )


class OwnerShoppingListItem(Base):
    __tablename__ = "owner_shopping_list_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    drug_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("drugs.id", ondelete="CASCADE"))
    variant_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("drug_variants.id", ondelete="SET NULL"), nullable=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    notes: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("owner_user_id", "drug_id", "variant_id", name="uq_owner_shopping_drug_variant"),
        Index("idx_owner_shopping_owner", "owner_user_id"),
    )


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(128), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_audit_clinic_created_at", "clinic_id", "created_at"),
        Index("idx_audit_actor_created_at", "actor_user_id", "created_at"),
    )


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_type: Mapped[str] = mapped_column(String(64), nullable=False, default="remote")
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    routing_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    capabilities_json: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    default_model_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    fallback_model_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_local: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ai_providers_status", "status"),
    )


class AIModel(Base):
    __tablename__ = "ai_models"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_providers.id", ondelete="CASCADE"))
    model_key: Mapped[str] = mapped_column(String(128), nullable=False)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
    context_window: Mapped[int | None] = mapped_column(Integer, nullable=True)
    supports_json_mode: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    supports_vision: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    supports_audio: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_fallback: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("provider_id", "model_key", name="uq_ai_models_provider_model"),
        Index("idx_ai_models_provider_status", "provider_id", "status"),
    )


class AIPolicy(Base):
    __tablename__ = "ai_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    role_scope: Mapped[str | None] = mapped_column(String(32), nullable=True)
    guardrails_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AIRoute(Base):
    __tablename__ = "ai_routes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    scenario_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    scenario_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role_scope: Mapped[str | None] = mapped_column(String(32), nullable=True)
    primary_provider_slug: Mapped[str] = mapped_column(String(64), nullable=False)
    primary_model_key: Mapped[str] = mapped_column(String(128), nullable=False)
    fallback_provider_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    fallback_model_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    policy_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ai_routes_role_scope", "role_scope"),
    )


class AIPrompt(Base):
    __tablename__ = "ai_prompts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    route_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class AIPromptVersion(Base):
    __tablename__ = "ai_prompt_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("ai_prompts.id", ondelete="CASCADE"))
    version_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    template_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("prompt_id", "version_number", name="uq_ai_prompt_versions_prompt_version"),
        Index("idx_ai_prompt_versions_prompt_active", "prompt_id", "is_active"),
    )


class AILimit(Base):
    __tablename__ = "ai_limits"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    max_owner_requests_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_vet_requests_per_hour: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    prompt_audit: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    pii_redaction: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    fallback_mode: Mapped[str] = mapped_column(String(64), nullable=False, default="strict")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("scope_type", "scope_key", name="uq_ai_limits_scope"),
    )


class AIBudget(Base):
    __tablename__ = "ai_budgets"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scope_type: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    monthly_budget: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hard_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(16), nullable=False, default="USD")
    current_spend: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("scope_type", "scope_key", name="uq_ai_budgets_scope"),
    )


class AITenantOverride(Base):
    __tablename__ = "ai_tenant_overrides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_key: Mapped[str] = mapped_column(String(128), nullable=False)
    route_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    mode_label: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ai_tenant_overrides_tenant", "tenant_key"),
    )


class AIClinicOverride(Base):
    __tablename__ = "ai_clinic_overrides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"))
    route_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    mode_label: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ai_clinic_overrides_clinic", "clinic_id"),
    )


class AIRolePolicy(Base):
    __tablename__ = "ai_role_policies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    policy_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    route_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    mode_label: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_ai_role_policies_role", "role"),
    )


class AIUsageLog(Base):
    __tablename__ = "ai_usage_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True)
    route_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    provider_slug: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    role_scope: Mapped[str | None] = mapped_column(String(32), nullable=True)
    request_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    estimated_cost: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ok")
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("idx_ai_usage_logs_route_created_at", "route_slug", "created_at"),
        Index("idx_ai_usage_logs_clinic_created_at", "clinic_id", "created_at"),
        Index("idx_ai_usage_logs_actor_created_at", "actor_user_id", "created_at"),
    )
