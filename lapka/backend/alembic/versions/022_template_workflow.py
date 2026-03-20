"""template workflow fields

Revision ID: 022_template_workflow
Revises: 021_pet_photo_text
Create Date: 2026-03-12 20:45:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "022_template_workflow"
down_revision: Union[str, None] = "021_pet_photo_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("templates", sa.Column("scope", sa.String(length=32), nullable=False, server_default="clinic"))
    op.add_column("templates", sa.Column("specialty", sa.String(length=64), nullable=True))
    op.add_column("templates", sa.Column("visibility", sa.String(length=32), nullable=False, server_default="clinic"))
    op.add_column("templates", sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"))
    op.add_column("templates", sa.Column("version", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("templates", sa.Column("source_template_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("templates", sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("templates", sa.Column("scenario_tags_json", sa.JSON(), nullable=False, server_default="[]"))
    op.add_column("templates", sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("templates", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        "fk_templates_source_template_id_templates",
        "templates",
        "templates",
        ["source_template_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "idx_templates_clinic_scope_status",
        "templates",
        ["clinic_id", "scope", "status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("idx_templates_clinic_scope_status", table_name="templates")
    op.drop_constraint("fk_templates_source_template_id_templates", "templates", type_="foreignkey")
    op.drop_column("templates", "last_used_at")
    op.drop_column("templates", "usage_count")
    op.drop_column("templates", "scenario_tags_json")
    op.drop_column("templates", "is_default")
    op.drop_column("templates", "source_template_id")
    op.drop_column("templates", "version")
    op.drop_column("templates", "status")
    op.drop_column("templates", "visibility")
    op.drop_column("templates", "specialty")
    op.drop_column("templates", "scope")
