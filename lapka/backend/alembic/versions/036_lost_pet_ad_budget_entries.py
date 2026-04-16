"""lost pet ad budget entries ledger

Revision ID: 036_lost_pet_ad_budget_entries
Revises: 035_lost_pet_chat_messages
Create Date: 2026-04-15 15:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "036_lost_pet_ad_budget_entries"
down_revision: Union[str, None] = "035_lost_pet_chat_messages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    entry_type_enum = sa.Enum(
        "allocation",
        "spend",
        "adjustment",
        name="lost_pet_ad_budget_entry_type_enum",
        native_enum=False,
    )
    entry_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lost_pet_ad_budget_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("entry_type", entry_type_enum, nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column(
            "source_payment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lost_pet_promotion_payments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("external_ref", sa.String(length=128), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_lost_pet_ad_budget_type_created",
        "lost_pet_ad_budget_entries",
        ["entry_type", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_ad_budget_source_payment",
        "lost_pet_ad_budget_entries",
        ["source_payment_id"],
        unique=False,
    )
    op.alter_column("lost_pet_ad_budget_entries", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_ad_budget_source_payment", table_name="lost_pet_ad_budget_entries")
    op.drop_index("idx_lost_pet_ad_budget_type_created", table_name="lost_pet_ad_budget_entries")
    op.drop_table("lost_pet_ad_budget_entries")
    entry_type_enum = sa.Enum(
        "allocation",
        "spend",
        "adjustment",
        name="lost_pet_ad_budget_entry_type_enum",
        native_enum=False,
    )
    entry_type_enum.drop(op.get_bind(), checkfirst=True)
