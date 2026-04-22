"""VPN MVP: subscriptions, checkouts, webhook events, profiles, device links, telegram links

Revision ID: 040_vpn_mvp
Revises: 039_lp_hotspot_notif
Create Date: 2026-04-22 14:50:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "040_vpn_mvp"
down_revision: Union[str, None] = "039_lp_hotspot_notif"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vpn_subscriptions",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("plan_code", sa.String(64), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "vpn_checkouts",
        sa.Column("checkout_id", sa.String(128), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("plan_code", sa.String(64), nullable=True),
        sa.Column("amount_rub", sa.Numeric(10, 2), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vpn_checkouts_user", "vpn_checkouts", ["user_id"])

    op.create_table(
        "vpn_webhook_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("event_id", sa.String(128), nullable=False),
        sa.Column("checkout_id", sa.String(128), sa.ForeignKey("vpn_checkouts.checkout_id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(32), nullable=True),
        sa.Column("amount_rub", sa.Numeric(10, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vpn_webhook_events_checkout", "vpn_webhook_events", ["checkout_id"])
    op.create_index(
        "idx_vpn_webhook_events_provider_event",
        "vpn_webhook_events",
        ["provider", "event_id"],
        unique=True,
    )

    op.create_table(
        "vpn_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vpn_profiles_user", "vpn_profiles", ["user_id"])

    op.create_table(
        "vpn_device_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("profile_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("vpn_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("device_id", sa.String(128), nullable=False),
        sa.Column("device_name", sa.String(128), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vpn_device_links_profile", "vpn_device_links", ["profile_id"])

    op.create_table(
        "vpn_telegram_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True, nullable=False),
        sa.Column("telegram_id", sa.String(64), nullable=False, unique=True),
        sa.Column("telegram_username", sa.String(128), nullable=True),
        sa.Column("linked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )


def downgrade() -> None:
    op.drop_table("vpn_telegram_links")
    op.drop_table("vpn_device_links")
    op.drop_index("idx_vpn_profiles_user", table_name="vpn_profiles")
    op.drop_table("vpn_profiles")
    op.drop_index("idx_vpn_webhook_events_checkout", table_name="vpn_webhook_events")
    op.drop_table("vpn_webhook_events")
    op.drop_index("idx_vpn_checkouts_user", table_name="vpn_checkouts")
    op.drop_table("vpn_checkouts")
    op.drop_table("vpn_subscriptions")