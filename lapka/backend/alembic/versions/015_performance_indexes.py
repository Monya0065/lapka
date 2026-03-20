"""Performance indexes for pets, visits, invoices and disease catalogs

Revision ID: 015_performance_indexes
Revises: 014_clinic_saas_suite
Create Date: 2026-03-07 03:15:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "015_performance_indexes"
down_revision = "014_clinic_saas_suite"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Pets
    op.create_index(
        "idx_master_pets_species_lower_name",
        "master_pets",
        ["species", sa.text("lower(name)")],
    )
    op.create_index("idx_master_pets_created_at", "master_pets", ["created_at"])

    # Visits
    op.create_index(
        "idx_visits_clinic_pet_created_desc",
        "visits",
        ["clinic_id", "pet_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_visits_pet_status_created_desc",
        "visits",
        ["pet_id", "status", sa.text("created_at DESC")],
    )

    # Invoices
    op.create_index(
        "idx_invoices_clinic_created_desc",
        "invoices",
        ["clinic_id", sa.text("created_at DESC")],
    )
    op.create_index(
        "idx_invoices_owner_status_created_desc",
        "invoices",
        ["owner_id", "status", sa.text("created_at DESC")],
    )

    # Diseases: optional SQL table index (if a relational disease table is introduced later).
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema='public' AND table_name='diseases'
            ) THEN
                CREATE INDEX IF NOT EXISTS idx_diseases_lower_name ON diseases (lower(name));
                CREATE INDEX IF NOT EXISTS idx_diseases_category ON diseases (category);
            END IF;
        END
        $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_diseases_category")
    op.execute("DROP INDEX IF EXISTS idx_diseases_lower_name")

    op.drop_index("idx_invoices_owner_status_created_desc", table_name="invoices")
    op.drop_index("idx_invoices_clinic_created_desc", table_name="invoices")

    op.drop_index("idx_visits_pet_status_created_desc", table_name="visits")
    op.drop_index("idx_visits_clinic_pet_created_desc", table_name="visits")

    op.drop_index("idx_master_pets_created_at", table_name="master_pets")
    op.drop_index("idx_master_pets_species_lower_name", table_name="master_pets")
