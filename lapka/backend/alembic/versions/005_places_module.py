"""add places module

Revision ID: 005_places_module
Revises: 004_vaccines_reminders
Create Date: 2026-03-06 07:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "005_places_module"
down_revision: Union[str, None] = "004_vaccines_reminders"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "places",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("place_type", sa.String(length=16), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("hours", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", "city", "place_type", name="uq_places_name_city_type"),
    )
    op.create_index("idx_places_type_city", "places", ["place_type", "city"], unique=False)
    op.create_index("idx_places_city_name", "places", ["city", "name"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_places_city_name", table_name="places")
    op.drop_index("idx_places_type_city", table_name="places")
    op.drop_table("places")
