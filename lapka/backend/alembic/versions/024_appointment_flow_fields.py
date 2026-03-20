"""appointment flowboard fields

Revision ID: 024_appt_flow_fields
Revises: 023_appt_ops_fields
Create Date: 2026-03-12 23:58:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "024_appt_flow_fields"
down_revision: Union[str, None] = "023_appt_ops_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("flow_stage", sa.String(length=32), nullable=False, server_default="scheduled"))
    op.add_column("appointments", sa.Column("urgency_level", sa.String(length=16), nullable=False, server_default="routine"))
    op.add_column("appointments", sa.Column("protocol_status", sa.String(length=32), nullable=False, server_default="not_started"))
    op.add_column("appointments", sa.Column("discharge_ready", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.execute(
        """
        UPDATE appointments
        SET flow_stage = CASE
            WHEN status = 'confirmed' THEN 'arrived'
            WHEN status = 'waiting' THEN 'waiting'
            WHEN status = 'in_progress' THEN 'in_consult'
            WHEN status = 'completed' THEN 'completed'
            WHEN status = 'cancelled' THEN 'completed'
            WHEN status = 'no_show' THEN 'completed'
            ELSE 'scheduled'
        END
        """
    )
    op.execute(
        """
        UPDATE appointments
        SET protocol_status = CASE
            WHEN status = 'completed' THEN 'signed'
            WHEN status = 'in_progress' THEN 'draft'
            ELSE 'not_started'
        END
        """
    )
    op.execute(
        """
        UPDATE appointments
        SET discharge_ready = CASE
            WHEN status = 'completed' THEN true
            ELSE false
        END
        """
    )

    op.create_index("idx_appointments_flow_stage_start", "appointments", ["flow_stage", "start_at"], unique=False)
    op.alter_column("appointments", "flow_stage", server_default=None)
    op.alter_column("appointments", "urgency_level", server_default=None)
    op.alter_column("appointments", "protocol_status", server_default=None)
    op.alter_column("appointments", "discharge_ready", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_appointments_flow_stage_start", table_name="appointments")
    op.drop_column("appointments", "discharge_ready")
    op.drop_column("appointments", "protocol_status")
    op.drop_column("appointments", "urgency_level")
    op.drop_column("appointments", "flow_stage")
