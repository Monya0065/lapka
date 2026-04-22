"""add action_url to notifications

Revision ID: 041_notification_action_url
Revises: 040_vpn_mvp
Create Date: 2026-04-22 15:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "041_notification_action_url"
down_revision: Union[str, None] = "040_vpn_mvp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "notifications",
        sa.Column("action_url", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notifications", "action_url")