"""Database models."""
import uuid
from datetime import datetime, timedelta

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Integer,
    String,
    Text,
    Index,
    ForeignKey,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sessions: Mapped[list["Session"]] = relationship(back_populates="user")
    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="user")
    devices: Mapped[list["Device"]] = relationship(back_populates="user")
    vpn_profiles: Mapped[list["VPNProfile"]] = relationship(back_populates="user")
    telegram_links: Mapped[list["TelegramLink"]] = relationship(back_populates="user")


class Session(Base):
    __tablename__ = "sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    refresh_hash: Mapped[str] = mapped_column(String(255))
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")

    __table_args__ = (Index("ix_sessions_user_id", "user_id"),)


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    plan_id: Mapped[str] = mapped_column(String(50))
    provider: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(
        String(20),
        default="trial",
    )
    renew_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    grace_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="subscriptions")
    payments: Mapped[list["Payment"]] = relationship(back_populates="subscription")

    __table_args__ = (Index("ix_subscriptions_user_id", "user_id"),)


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    subscription_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("subscriptions.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    provider: Mapped[str] = mapped_column(String(50))
    order_id: Mapped[str] = mapped_column(String(255))
    amount: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20))
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subscription: Mapped["Subscription"] = relationship(back_populates="payments")

    __table_args__ = (Index("ix_payments_user_id", "user_id"), Index("ix_payments_order_id", "order_id"))


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(String(50))
    event_id: Mapped[str] = mapped_column(String(255))
    event_hash: Mapped[str] = mapped_column(String(255))
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_payment_events_provider_event_id", "provider", "event_id"),)


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    platform: Mapped[str] = mapped_column(String(20))
    fingerprint_hash: Mapped[str] = mapped_column(String(255))
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending_claim")
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="devices")
    vpn_profiles: Mapped[list["VPNProfile"]] = relationship(back_populates="device")

    __table_args__ = (Index("ix_devices_user_id", "user_id"),)


class TelegramLink(Base):
    __tablename__ = "telegram_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    telegram_user_id: Mapped[str] = mapped_column(String(50))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_nonce: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="telegram_links")

    __table_args__ = (Index("ix_telegram_links_user_id", "user_id"), Index("ix_telegram_links_telegram_user_id", "telegram_user_id"))


class DeviceClaimToken(Base):
    __tablename__ = "device_claim_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    device_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    token_hash: Mapped[str] = mapped_column(String(255))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_device_claim_tokens_user_id", "user_id"),)


class VPNProfile(Base):
    __tablename__ = "vpn_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    device_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("devices.id"))
    node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    public_key: Mapped[str] = mapped_column(String(255))
    config_ref: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="draft")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["User"] = relationship(back_populates="vpn_profiles")
    device: Mapped["Device"] = relationship(back_populates="vpn_profiles")

    __table_args__ = (Index("ix_vpn_profiles_user_id", "user_id"), Index("ix_vpn_profiles_device_id", "device_id"))


class VPNNode(Base):
    __tablename__ = "vpn_nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    region: Mapped[str] = mapped_column(String(20))
    endpoint: Mapped[str] = mapped_column(String(255))
    public_key: Mapped[str] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="active")
    capacity: Mapped[int] = mapped_column(Integer, default=100)
    health_score: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_vpn_nodes_region", "region"),)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(50))
    entity: Mapped[str] = mapped_column(String(50))
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    __table_args__ = (Index("ix_audit_events_actor_id", "actor_id"), Index("ix_audit_events_entity", "entity", "entity_id"))