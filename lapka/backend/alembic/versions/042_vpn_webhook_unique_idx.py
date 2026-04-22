"""patch: add unique index to vpn_webhook_events for ON CONFLICT

Revision ID: 042_vpn_webhook_unique_idx
Revises: 041_notification_action_url
Create Date: 2026-04-22 15:05:00
"""

from typing import Sequence, Union

from alembic import op


revision: str = "042_vpn_webhook_unique_idx"
down_revision: Union[str, None] = "041_notification_action_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "idx_vpn_webhook_events_provider_event",
        "vpn_webhook_events",
        ["provider", "event_id"],
        unique=True,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index(
        "idx_vpn_webhook_events_provider_event",
        table_name="vpn_webhook_events",
        if_exists=True,
    )