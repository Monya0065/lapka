"""fix defaults for growth tables

Revision ID: 013_growth_defaults_fix
Revises: 012_growth_viral_mechanics
Create Date: 2026-03-06 20:55:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "013_growth_defaults_fix"
down_revision: Union[str, None] = "012_growth_viral_mechanics"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("pet_passports", "allow_unmasked_phone", server_default=sa.false())
    op.alter_column("pet_passports", "include_microchip", server_default=sa.true())
    op.alter_column("pet_passports", "created_at", server_default=sa.text("now()"))
    op.alter_column("pet_passports", "updated_at", server_default=sa.text("now()"))

    op.alter_column("lost_pet_reports", "status", server_default=sa.text("'active'"))
    op.alter_column("lost_pet_reports", "created_at", server_default=sa.text("now()"))
    op.alter_column("lost_pet_reports", "updated_at", server_default=sa.text("now()"))

    op.alter_column("lost_pet_sightings", "created_at", server_default=sa.text("now()"))

    op.alter_column("referrals", "status", server_default=sa.text("'sent'"))
    op.alter_column("referrals", "created_at", server_default=sa.text("now()"))

    op.alter_column("clinic_invites", "status", server_default=sa.text("'pending'"))
    op.alter_column("clinic_invites", "created_at", server_default=sa.text("now()"))


def downgrade() -> None:
    op.alter_column("clinic_invites", "created_at", server_default=None)
    op.alter_column("clinic_invites", "status", server_default=None)

    op.alter_column("referrals", "created_at", server_default=None)
    op.alter_column("referrals", "status", server_default=None)

    op.alter_column("lost_pet_sightings", "created_at", server_default=None)

    op.alter_column("lost_pet_reports", "updated_at", server_default=None)
    op.alter_column("lost_pet_reports", "created_at", server_default=None)
    op.alter_column("lost_pet_reports", "status", server_default=None)

    op.alter_column("pet_passports", "updated_at", server_default=None)
    op.alter_column("pet_passports", "created_at", server_default=None)
    op.alter_column("pet_passports", "include_microchip", server_default=None)
    op.alter_column("pet_passports", "allow_unmasked_phone", server_default=None)
