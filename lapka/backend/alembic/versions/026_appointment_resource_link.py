"""appointment resource link

Revision ID: 026_appointment_resource_link
Revises: 025_clinic_resources
Create Date: 2026-03-12 23:50:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "026_appointment_resource_link"
down_revision: Union[str, None] = "025_clinic_resources"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("clinic_resource_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_appointments_clinic_resource_id",
        "appointments",
        "clinic_resources",
        ["clinic_resource_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_appointments_clinic_resource_start",
        "appointments",
        ["clinic_id", "clinic_resource_id", "start_at"],
        unique=False,
    )

    op.execute(
        """
        UPDATE appointments AS a
        SET clinic_resource_id = cr.id
        FROM clinic_resources AS cr
        WHERE a.clinic_resource_id IS NULL
          AND a.clinic_id = cr.clinic_id
          AND a.room_label IS NOT NULL
          AND a.room_label = cr.name
          AND (
                (a.clinic_location_id IS NOT NULL AND cr.clinic_location_id = a.clinic_location_id)
             OR (a.clinic_location_id IS NULL AND cr.clinic_location_id IS NULL)
          )
        """
    )
    op.execute(
        """
        UPDATE appointments AS a
        SET clinic_resource_id = cr.id
        FROM clinic_resources AS cr
        WHERE a.clinic_resource_id IS NULL
          AND a.clinic_id = cr.clinic_id
          AND a.room_label IS NOT NULL
          AND a.room_label = cr.name
          AND cr.clinic_location_id IS NULL
        """
    )


def downgrade() -> None:
    op.drop_index("idx_appointments_clinic_resource_start", table_name="appointments")
    op.drop_constraint("fk_appointments_clinic_resource_id", "appointments", type_="foreignkey")
    op.drop_column("appointments", "clinic_resource_id")
