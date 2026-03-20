"""clinic scheduler settings

Revision ID: 028_clinic_scheduler_settings
Revises: 027_notification_channel
Create Date: 2026-03-13 22:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "028_clinic_scheduler_settings"
down_revision: Union[str, None] = "027_notification_channel"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinic_scheduler_settings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("default_buffer_minutes", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("day_start_hour", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("day_end_hour", sa.Integer(), nullable=False, server_default="21"),
        sa.Column("slot_interval_minutes", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("default_buffer_minutes >= 0 AND default_buffer_minutes <= 180", name="ck_scheduler_buffer"),
        sa.CheckConstraint("day_start_hour >= 0 AND day_start_hour <= 23", name="ck_scheduler_day_start"),
        sa.CheckConstraint("day_end_hour >= 1 AND day_end_hour <= 24", name="ck_scheduler_day_end"),
        sa.CheckConstraint("day_end_hour > day_start_hour", name="ck_scheduler_day_window"),
        sa.CheckConstraint("slot_interval_minutes >= 10 AND slot_interval_minutes <= 180", name="ck_scheduler_slot_interval"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_location_id"], ["clinic_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "clinic_location_id", name="uq_clinic_scheduler_settings_scope"),
    )
    op.create_index(
        "idx_clinic_scheduler_settings_clinic_scope",
        "clinic_scheduler_settings",
        ["clinic_id", "clinic_location_id"],
        unique=False,
    )
    op.alter_column("clinic_scheduler_settings", "default_buffer_minutes", server_default=None)
    op.alter_column("clinic_scheduler_settings", "day_start_hour", server_default=None)
    op.alter_column("clinic_scheduler_settings", "day_end_hour", server_default=None)
    op.alter_column("clinic_scheduler_settings", "slot_interval_minutes", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_clinic_scheduler_settings_clinic_scope", table_name="clinic_scheduler_settings")
    op.drop_table("clinic_scheduler_settings")
