"""lost pet promotion payments

Revision ID: 034_lost_pet_promotion_payments
Revises: 033_lost_pets_geo_privacy_promo
Create Date: 2026-04-15 13:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "034_lost_pet_promotion_payments"
down_revision: Union[str, None] = "033_lost_pets_geo_privacy_promo"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    payment_status_enum = sa.Enum(
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        name="lost_pet_promo_payment_status_enum",
        native_enum=False,
    )
    payment_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "lost_pet_promotion_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lost_pet_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "owner_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("provider", sa.String(length=64), nullable=False),
        sa.Column("tier", sa.String(length=32), nullable=False),
        sa.Column("duration_days", sa.Integer(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False),
        sa.Column("status", payment_status_enum, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("idempotency_key", sa.String(length=128), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("receipt_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("report_id", "idempotency_key", name="uq_lost_pet_promo_payment_idempotency"),
    )
    op.create_index(
        "idx_lost_pet_promo_payment_owner_created",
        "lost_pet_promotion_payments",
        ["owner_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_promo_payment_report_created",
        "lost_pet_promotion_payments",
        ["report_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_promo_payment_status_created",
        "lost_pet_promotion_payments",
        ["status", "created_at"],
        unique=False,
    )
    op.alter_column("lost_pet_promotion_payments", "status", server_default=None)
    op.alter_column("lost_pet_promotion_payments", "created_at", server_default=None)
    op.alter_column("lost_pet_promotion_payments", "updated_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_promo_payment_status_created", table_name="lost_pet_promotion_payments")
    op.drop_index("idx_lost_pet_promo_payment_report_created", table_name="lost_pet_promotion_payments")
    op.drop_index("idx_lost_pet_promo_payment_owner_created", table_name="lost_pet_promotion_payments")
    op.drop_table("lost_pet_promotion_payments")
    payment_status_enum = sa.Enum(
        "pending",
        "succeeded",
        "failed",
        "cancelled",
        name="lost_pet_promo_payment_status_enum",
        native_enum=False,
    )
    payment_status_enum.drop(op.get_bind(), checkfirst=True)
