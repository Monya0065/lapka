"""appointments and telemedicine expansion

Revision ID: 006_appointments_telemedicine
Revises: 005_places_module
Create Date: 2026-03-06 13:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "006_appointments_telemedicine"
down_revision: Union[str, None] = "005_places_module"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "appointment_types",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("default_duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("is_telemedicine", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("clinic_id", "code", name="uq_appointment_types_clinic_code"),
        sa.UniqueConstraint("clinic_id", "name", name="uq_appointment_types_clinic_name"),
    )
    op.create_index("idx_appointment_types_clinic_active", "appointment_types", ["clinic_id", "is_active"], unique=False)

    op.create_table(
        "doctor_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("slot_duration", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("weekday >= 0 AND weekday <= 6", name="ck_doctor_schedule_weekday"),
        sa.CheckConstraint("slot_duration >= 10 AND slot_duration <= 180", name="ck_doctor_schedule_slot_duration"),
        sa.UniqueConstraint(
            "clinic_id",
            "vet_id",
            "weekday",
            "start_time",
            "end_time",
            name="uq_doctor_schedule_unique_span",
        ),
    )
    op.create_index("idx_doctor_schedule_clinic_weekday", "doctor_schedules", ["clinic_id", "weekday"], unique=False)
    op.create_index("idx_doctor_schedule_vet_weekday", "doctor_schedules", ["vet_id", "weekday"], unique=False)

    op.add_column("appointments", sa.Column("appointment_type_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("appointments", sa.Column("service_type", sa.String(length=128), nullable=True))
    op.add_column(
        "appointments",
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("30")),
    )
    op.add_column(
        "appointments",
        sa.Column("visit_type", sa.String(length=32), nullable=False, server_default=sa.text("'clinic_visit'")),
    )
    op.add_column("appointments", sa.Column("video_link", sa.String(length=512), nullable=True))
    op.add_column("appointments", sa.Column("meeting_token", sa.String(length=255), nullable=True))

    op.create_foreign_key(
        "fk_appointments_appointment_type_id",
        "appointments",
        "appointment_types",
        ["appointment_type_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.execute("UPDATE appointments SET service_type = COALESCE(service_name, 'Прием')")
    op.execute("UPDATE appointments SET duration_minutes = 30 WHERE duration_minutes IS NULL")
    op.execute("UPDATE appointments SET visit_type = 'clinic_visit' WHERE visit_type IS NULL")
    op.execute("UPDATE appointments SET status = 'scheduled' WHERE status IN ('new', 'waiting')")

    op.alter_column("appointments", "status", server_default=sa.text("'scheduled'"))

    op.drop_index("uq_appointments_vet_start_active", table_name="appointments")
    op.create_index(
        "uq_appointments_vet_start_active",
        "appointments",
        ["vet_id", "start_at"],
        unique=True,
        postgresql_where=sa.text("status in ('scheduled','confirmed','in_progress','new','waiting')"),
    )
    op.create_index("idx_appointments_owner_start", "appointments", ["owner_user_id", "start_at"], unique=False)
    op.create_index("idx_appointments_status_start", "appointments", ["status", "start_at"], unique=False)

    op.add_column("reminders", sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("reminders", sa.Column("remind_before_minutes", sa.Integer(), nullable=True))
    op.add_column("reminders", sa.Column("channel", sa.String(length=32), nullable=True))
    op.create_foreign_key(
        "fk_reminders_appointment_id",
        "reminders",
        "appointments",
        ["appointment_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("idx_reminders_appointment", "reminders", ["appointment_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_reminders_appointment", table_name="reminders")
    op.drop_constraint("fk_reminders_appointment_id", "reminders", type_="foreignkey")
    op.drop_column("reminders", "channel")
    op.drop_column("reminders", "remind_before_minutes")
    op.drop_column("reminders", "appointment_id")

    op.drop_index("idx_appointments_status_start", table_name="appointments")
    op.drop_index("idx_appointments_owner_start", table_name="appointments")

    op.drop_index("uq_appointments_vet_start_active", table_name="appointments")
    op.create_index(
        "uq_appointments_vet_start_active",
        "appointments",
        ["vet_id", "start_at"],
        unique=True,
        postgresql_where=sa.text("status in ('new','confirmed','waiting')"),
    )

    op.drop_constraint("fk_appointments_appointment_type_id", "appointments", type_="foreignkey")
    op.drop_column("appointments", "meeting_token")
    op.drop_column("appointments", "video_link")
    op.drop_column("appointments", "visit_type")
    op.drop_column("appointments", "duration_minutes")
    op.drop_column("appointments", "service_type")
    op.drop_column("appointments", "appointment_type_id")

    op.drop_index("idx_doctor_schedule_vet_weekday", table_name="doctor_schedules")
    op.drop_index("idx_doctor_schedule_clinic_weekday", table_name="doctor_schedules")
    op.drop_table("doctor_schedules")

    op.drop_index("idx_appointment_types_clinic_active", table_name="appointment_types")
    op.drop_table("appointment_types")
