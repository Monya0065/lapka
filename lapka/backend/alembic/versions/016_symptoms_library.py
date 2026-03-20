"""add veterinary symptoms library table

Revision ID: 016_symptoms_library
Revises: 015_performance_indexes
Create Date: 2026-03-07 11:40:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "016_symptoms_library"
down_revision = "015_performance_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "symptoms",
        sa.Column("id", sa.String(length=64), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("species", sa.String(length=128), nullable=False, server_default=sa.text("'cat,dog'")),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("severity", sa.Integer(), nullable=False, server_default=sa.text("2")),
        sa.Column("emergency_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("severity >= 1 AND severity <= 5", name="ck_symptoms_severity_range"),
    )

    op.create_index("idx_symptoms_name", "symptoms", ["name"], unique=False)
    op.create_index("idx_symptoms_category", "symptoms", ["category"], unique=False)
    op.create_index("idx_symptoms_species", "symptoms", ["species"], unique=False)
    op.create_index("idx_symptoms_emergency_flag", "symptoms", ["emergency_flag"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_symptoms_emergency_flag", table_name="symptoms")
    op.drop_index("idx_symptoms_species", table_name="symptoms")
    op.drop_index("idx_symptoms_category", table_name="symptoms")
    op.drop_index("idx_symptoms_name", table_name="symptoms")
    op.drop_table("symptoms")
