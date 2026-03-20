"""add veterinary diseases library table

Revision ID: 017_diseases_library
Revises: 016_symptoms_library
Create Date: 2026-03-07 12:05:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "017_diseases_library"
down_revision = "016_symptoms_library"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "diseases",
        sa.Column("id", sa.String(length=128), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("species", sa.String(length=128), nullable=False, server_default=sa.text("'cat,dog'")),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("symptoms_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("emergency_level", sa.String(length=16), nullable=False, server_default=sa.text("'YELLOW'")),
        sa.Column("prevalence", sa.String(length=32), nullable=False, server_default=sa.text("'common'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "category IN ('dermatology','gastroenterology','neurology','cardiology','infectious','trauma','toxicology','respiratory','urinary','endocrine','ophthalmology')",
            name="ck_diseases_category_allowed",
        ),
        sa.CheckConstraint("emergency_level IN ('GREEN','YELLOW','RED')", name="ck_diseases_emergency_level"),
        sa.CheckConstraint("prevalence IN ('common','uncommon','rare')", name="ck_diseases_prevalence"),
    )

    op.create_index("idx_diseases_name", "diseases", ["name"], unique=False)
    op.create_index("idx_diseases_category", "diseases", ["category"], unique=False)
    op.create_index("idx_diseases_species", "diseases", ["species"], unique=False)
    op.create_index("idx_diseases_emergency_level", "diseases", ["emergency_level"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_diseases_emergency_level", table_name="diseases")
    op.drop_index("idx_diseases_species", table_name="diseases")
    op.drop_index("idx_diseases_category", table_name="diseases")
    op.drop_index("idx_diseases_name", table_name="diseases")
    op.drop_table("diseases")
