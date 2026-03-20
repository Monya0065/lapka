"""clinic resources

Revision ID: 025_clinic_resources
Revises: 024_appt_flow_fields
Create Date: 2026-03-12 21:40:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "025_clinic_resources"
down_revision: Union[str, None] = "024_appt_flow_fields"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "clinic_resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_location_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("code", sa.String(length=64), nullable=True),
        sa.Column("resource_type", sa.String(length=32), nullable=False, server_default="room"),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["clinic_location_id"], ["clinic_locations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "clinic_location_id", "name", name="uq_clinic_resources_scope_name"),
    )
    op.create_index(
        "idx_clinic_resources_clinic_scope",
        "clinic_resources",
        ["clinic_id", "clinic_location_id", "is_active"],
        unique=False,
    )
    op.create_index("idx_clinic_resources_type", "clinic_resources", ["resource_type"], unique=False)
    op.alter_column("clinic_resources", "resource_type", server_default=None)
    op.alter_column("clinic_resources", "capacity", server_default=None)
    op.alter_column("clinic_resources", "is_active", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_clinic_resources_type", table_name="clinic_resources")
    op.drop_index("idx_clinic_resources_clinic_scope", table_name="clinic_resources")
    op.drop_table("clinic_resources")
