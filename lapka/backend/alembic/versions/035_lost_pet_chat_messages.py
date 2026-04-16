"""lost pet chat messages

Revision ID: 035_lost_pet_chat_messages
Revises: 034_lost_pet_promotion_payments
Create Date: 2026-04-15 14:15:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "035_lost_pet_chat_messages"
down_revision: Union[str, None] = "034_lost_pet_promotion_payments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "lost_pet_chat_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lost_pet_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "sender_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "recipient_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_lost_pet_chat_report_created",
        "lost_pet_chat_messages",
        ["report_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_chat_recipient_read",
        "lost_pet_chat_messages",
        ["recipient_user_id", "is_read", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_chat_sender_created",
        "lost_pet_chat_messages",
        ["sender_user_id", "created_at"],
        unique=False,
    )
    op.alter_column("lost_pet_chat_messages", "is_read", server_default=None)
    op.alter_column("lost_pet_chat_messages", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_chat_sender_created", table_name="lost_pet_chat_messages")
    op.drop_index("idx_lost_pet_chat_recipient_read", table_name="lost_pet_chat_messages")
    op.drop_index("idx_lost_pet_chat_report_created", table_name="lost_pet_chat_messages")
    op.drop_table("lost_pet_chat_messages")
