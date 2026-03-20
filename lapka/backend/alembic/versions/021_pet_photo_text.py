"""pet photo text

Revision ID: 021_pet_photo_text
Revises: 020_ai_control_plane
Create Date: 2026-03-11 18:05:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "021_pet_photo_text"
down_revision: Union[str, None] = "020_ai_control_plane"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "master_pets",
        "photo_url",
        existing_type=sa.String(length=512),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "master_pets",
        "photo_url",
        existing_type=sa.Text(),
        type_=sa.String(length=512),
        existing_nullable=True,
    )
