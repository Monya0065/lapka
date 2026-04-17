"""lost pet hotspot notification preferences

Revision ID: 039_lp_hotspot_notif
Revises: 038_lp_hotspot_subs
Create Date: 2026-04-15 17:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "039_lp_hotspot_notif"
down_revision: Union[str, None] = "038_lp_hotspot_subs"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lost_pet_hotspot_notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sms_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("quiet_hours_start", sa.Integer(), nullable=True),
        sa.Column("quiet_hours_end", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "(quiet_hours_start IS NULL OR (quiet_hours_start >= 0 AND quiet_hours_start <= 23))",
            name="ck_lost_pet_hotspot_pref_quiet_start",
        ),
        sa.CheckConstraint(
            "(quiet_hours_end IS NULL OR (quiet_hours_end >= 0 AND quiet_hours_end <= 23))",
            name="ck_lost_pet_hotspot_pref_quiet_end",
        ),
    )
    op.create_index(
        "idx_lost_pet_hotspot_pref_user",
        "lost_pet_hotspot_notification_preferences",
        ["user_id"],
        unique=False,
    )
    op.alter_column("lost_pet_hotspot_notification_preferences", "in_app_enabled", server_default=None)
    op.alter_column("lost_pet_hotspot_notification_preferences", "email_enabled", server_default=None)
    op.alter_column("lost_pet_hotspot_notification_preferences", "sms_enabled", server_default=None)
    op.alter_column("lost_pet_hotspot_notification_preferences", "created_at", server_default=None)
    op.alter_column("lost_pet_hotspot_notification_preferences", "updated_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_hotspot_pref_user", table_name="lost_pet_hotspot_notification_preferences")
    op.drop_table("lost_pet_hotspot_notification_preferences")
