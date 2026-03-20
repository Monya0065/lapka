"""add notification channel enum and column

Revision ID: 027_notification_channel
Revises: 026_appointment_resource_link
Create Date: 2026-03-13 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "027_notification_channel"
down_revision: Union[str, None] = "026_appointment_resource_link"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # create new enum for channels
    channel_enum = sa.Enum("in_app", "email", "sms", name="notification_channel_enum", native_enum=False)
    channel_enum.create(op.get_bind(), checkfirst=True)
    # add column with default
    op.add_column(
        "notifications",
        sa.Column(
            "channel",
            channel_enum,
            nullable=False,
            server_default=sa.text("'in_app'"),
        ),
    )


def downgrade() -> None:
    op.drop_column("notifications", "channel")
    channel_enum = sa.Enum("in_app", "email", "sms", name="notification_channel_enum", native_enum=False)
    channel_enum.drop(op.get_bind(), checkfirst=True)
