"""lost pet hotspot subscriptions

Revision ID: 038_lost_pet_hotspot_subscriptions
Revises: 037_lost_pet_moderation_and_abuse_reports
Create Date: 2026-04-15 17:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "038_lost_pet_hotspot_subscriptions"
down_revision: Union[str, None] = "037_lost_pet_moderation_and_abuse_reports"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lost_pet_hotspot_subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("center_lat", sa.Float(), nullable=False),
        sa.Column("center_lng", sa.Float(), nullable=False),
        sa.Column("radius_km", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("min_hotspot_count", sa.Integer(), nullable=False, server_default="3"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_lost_pet_hotspot_subscriptions_user",
        "lost_pet_hotspot_subscriptions",
        ["user_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_hotspot_subscriptions_active",
        "lost_pet_hotspot_subscriptions",
        ["is_active", "city"],
        unique=False,
    )
    op.alter_column("lost_pet_hotspot_subscriptions", "radius_km", server_default=None)
    op.alter_column("lost_pet_hotspot_subscriptions", "min_hotspot_count", server_default=None)
    op.alter_column("lost_pet_hotspot_subscriptions", "is_active", server_default=None)
    op.alter_column("lost_pet_hotspot_subscriptions", "created_at", server_default=None)
    op.alter_column("lost_pet_hotspot_subscriptions", "updated_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_hotspot_subscriptions_active", table_name="lost_pet_hotspot_subscriptions")
    op.drop_index("idx_lost_pet_hotspot_subscriptions_user", table_name="lost_pet_hotspot_subscriptions")
    op.drop_table("lost_pet_hotspot_subscriptions")
