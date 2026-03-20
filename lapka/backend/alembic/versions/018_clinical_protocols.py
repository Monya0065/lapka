"""add veterinary clinical protocols table

Revision ID: 018_clinical_protocols
Revises: 017_diseases_library
Create Date: 2026-03-07 13:40:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "018_clinical_protocols"
down_revision = "017_diseases_library"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clinical_protocols",
        sa.Column("id", sa.String(length=128), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("species", sa.String(length=128), nullable=False, server_default=sa.text("'cat,dog'")),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("steps_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("emergency_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint(
            "category IN ('general','emergency','gastroenterology','neurology','trauma','anesthesia','surgery','toxicology','inpatient','diagnostics','cardiology','respiratory')",
            name="ck_clinical_protocols_category_allowed",
        ),
    )

    op.create_index("idx_clinical_protocols_name", "clinical_protocols", ["name"], unique=False)
    op.create_index("idx_clinical_protocols_category", "clinical_protocols", ["category"], unique=False)
    op.create_index("idx_clinical_protocols_species", "clinical_protocols", ["species"], unique=False)
    op.create_index("idx_clinical_protocols_emergency_flag", "clinical_protocols", ["emergency_flag"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_clinical_protocols_emergency_flag", table_name="clinical_protocols")
    op.drop_index("idx_clinical_protocols_species", table_name="clinical_protocols")
    op.drop_index("idx_clinical_protocols_category", table_name="clinical_protocols")
    op.drop_index("idx_clinical_protocols_name", table_name="clinical_protocols")
    op.drop_table("clinical_protocols")
