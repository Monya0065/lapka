"""feature modules: appointments/templates/reviews/services

Revision ID: 002_feature_modules
Revises: 001_initial
Create Date: 2026-03-05 22:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002_feature_modules"
down_revision: Union[str, None] = "001_initial"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "services",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("price", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_services_clinic_active", "services", ["clinic_id", "is_active"], unique=False)

    op.create_table(
        "appointments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("service_name", sa.String(length=255), nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default=sa.text("'new'")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_appointments_clinic_start", "appointments", ["clinic_id", "start_at"], unique=False)
    op.create_index("idx_appointments_vet_start", "appointments", ["vet_id", "start_at"], unique=False)
    op.create_index(
        "uq_appointments_vet_start_active",
        "appointments",
        ["vet_id", "start_at"],
        unique=True,
        postgresql_where=sa.text("status in ('new','confirmed','waiting')"),
    )

    op.create_table(
        "templates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("template_type", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_templates_clinic_type", "templates", ["clinic_id", "template_type"], unique=False)

    op.create_table(
        "inpatient_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("stay_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("inpatient_stays.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_date", sa.DateTime(timezone=True), nullable=False),
        sa.Column("task_text", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_inpatient_plans_stay_date", "inpatient_plans", ["stay_id", "plan_date"], unique=False)

    op.create_table(
        "inpatient_observations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("stay_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("inpatient_stays.id", ondelete="CASCADE"), nullable=False),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("temperature_c", sa.String(length=16), nullable=True),
        sa.Column("appetite", sa.String(length=64), nullable=True),
        sa.Column("activity", sa.String(length=64), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_inpatient_observations_stay_time", "inpatient_observations", ["stay_id", "observed_at"], unique=False)

    op.create_table(
        "inpatient_photo_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("stay_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("inpatient_stays.id", ondelete="CASCADE"), nullable=False),
        sa.Column("taken_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("caption", sa.String(length=255), nullable=False),
        sa.Column("file_ref", sa.String(length=255), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_inpatient_photos_stay_time", "inpatient_photo_reports", ["stay_id", "taken_at"], unique=False)

    op.create_table(
        "camera_access_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "token_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("camera_access_tokens.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("result", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_camera_access_logs_created", "camera_access_logs", ["created_at"], unique=False)

    op.create_table(
        "reviews",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("vet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("rating", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("moderation_status", sa.String(length=16), nullable=False, server_default=sa.text("'published'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("rating >= 1 AND rating <= 5", name="ck_review_rating_range"),
    )
    op.create_index("idx_reviews_vet_created", "reviews", ["vet_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_reviews_vet_created", table_name="reviews")
    op.drop_table("reviews")

    op.drop_index("idx_camera_access_logs_created", table_name="camera_access_logs")
    op.drop_table("camera_access_logs")

    op.drop_index("idx_inpatient_photos_stay_time", table_name="inpatient_photo_reports")
    op.drop_table("inpatient_photo_reports")

    op.drop_index("idx_inpatient_observations_stay_time", table_name="inpatient_observations")
    op.drop_table("inpatient_observations")

    op.drop_index("idx_inpatient_plans_stay_date", table_name="inpatient_plans")
    op.drop_table("inpatient_plans")

    op.drop_index("idx_templates_clinic_type", table_name="templates")
    op.drop_table("templates")

    op.drop_index("uq_appointments_vet_start_active", table_name="appointments")
    op.drop_index("idx_appointments_vet_start", table_name="appointments")
    op.drop_index("idx_appointments_clinic_start", table_name="appointments")
    op.drop_table("appointments")

    op.drop_index("idx_services_clinic_active", table_name="services")
    op.drop_table("services")
