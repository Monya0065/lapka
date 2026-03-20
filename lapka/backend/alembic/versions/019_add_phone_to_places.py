"""add phone to places"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_add_phone_to_places"
down_revision: Union[str, None] = "018_clinical_protocols"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "places",
        sa.Column("phone", sa.String(length=64), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("places", "phone")
