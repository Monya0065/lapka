"""appointment operational fields

Revision ID: 023_appt_ops_fields
Revises: 022_template_workflow
Create Date: 2026-03-12 23:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "023_appt_ops_fields"
down_revision: Union[str, None] = "022_template_workflow"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("clinic_location_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("appointments", sa.Column("room_label", sa.String(length=128), nullable=True))
    op.add_column("appointments", sa.Column("buffer_minutes", sa.Integer(), nullable=False, server_default="10"))
    op.create_foreign_key(
        "fk_appointments_clinic_location_id_clinic_locations",
        "appointments",
        "clinic_locations",
        ["clinic_location_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_appointments_clinic_location_start",
        "appointments",
        ["clinic_id", "clinic_location_id", "start_at"],
        unique=False,
    )
    op.alter_column("appointments", "buffer_minutes", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_appointments_clinic_location_start", table_name="appointments")
    op.drop_constraint(
        "fk_appointments_clinic_location_id_clinic_locations",
        "appointments",
        type_="foreignkey",
    )
    op.drop_column("appointments", "buffer_minutes")
    op.drop_column("appointments", "room_label")
    op.drop_column("appointments", "clinic_location_id")
