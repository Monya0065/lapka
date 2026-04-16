"""lost pets geo privacy and promotion fields

Revision ID: 033_lost_pets_geo_privacy_promo
Revises: 032_clinic_kpi_targets
Create Date: 2026-04-15 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "033_lost_pets_geo_privacy_promo"
down_revision: Union[str, None] = "032_clinic_kpi_targets"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("lost_pet_reports", sa.Column("last_seen_lat", sa.Numeric(9, 6), nullable=True))
    op.add_column("lost_pet_reports", sa.Column("last_seen_lng", sa.Numeric(9, 6), nullable=True))
    op.add_column("lost_pet_reports", sa.Column("contact_phone", sa.String(length=32), nullable=True))
    op.add_column(
        "lost_pet_reports",
        sa.Column("allow_phone_public", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("lost_pet_reports", sa.Column("promotion_tier", sa.String(length=32), nullable=True))
    op.add_column("lost_pet_reports", sa.Column("promoted_until", sa.DateTime(timezone=True), nullable=True))

    op.create_index(
        "idx_lost_pet_reports_promoted_until",
        "lost_pet_reports",
        ["promoted_until", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_reports_geo",
        "lost_pet_reports",
        ["last_seen_lat", "last_seen_lng"],
        unique=False,
    )

    op.alter_column("lost_pet_reports", "allow_phone_public", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_reports_geo", table_name="lost_pet_reports")
    op.drop_index("idx_lost_pet_reports_promoted_until", table_name="lost_pet_reports")
    op.drop_column("lost_pet_reports", "promoted_until")
    op.drop_column("lost_pet_reports", "promotion_tier")
    op.drop_column("lost_pet_reports", "allow_phone_public")
    op.drop_column("lost_pet_reports", "contact_phone")
    op.drop_column("lost_pet_reports", "last_seen_lng")
    op.drop_column("lost_pet_reports", "last_seen_lat")
