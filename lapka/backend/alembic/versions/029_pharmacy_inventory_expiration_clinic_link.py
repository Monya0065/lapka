"""pharmacy: clinic scoping + inventory expiration

Revision ID: 029_pharmacy_inventory_expiration_clinic_link
Revises: 028_clinic_scheduler_settings
Create Date: 2026-03-20 18:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
# NOTE: `alembic_version.version_num` is varchar(32) in this repo.
# Keep revision id <= 32 chars to avoid "value too long" errors.
revision: str = "029_pharmacy_exp_clinic"
down_revision: Union[str, None] = "028_clinic_scheduler_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pharmacy_locations",
        sa.Column(
            "clinic_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clinics.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_pharmacy_locations_clinic", "pharmacy_locations", ["clinic_id"], unique=False)

    op.add_column(
        "pharmacy_inventory",
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_inventory_expires_at", "pharmacy_inventory", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_inventory_expires_at", table_name="pharmacy_inventory")
    op.drop_column("pharmacy_inventory", "expires_at")

    op.drop_index("idx_pharmacy_locations_clinic", table_name="pharmacy_locations")
    op.drop_column("pharmacy_locations", "clinic_id")

