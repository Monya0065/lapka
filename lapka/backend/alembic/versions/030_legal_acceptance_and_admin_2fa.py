"""legal acceptance registry and admin 2fa payload support

Revision ID: 030_legal_acceptance
Revises: 029_pharmacy_exp_clinic
Create Date: 2026-04-14 16:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "030_legal_acceptance"
down_revision: Union[str, None] = "029_pharmacy_exp_clinic"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "legal_acceptances",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("document_type", sa.String(length=64), nullable=False),
        sa.Column("version", sa.String(length=64), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "document_type", "version", name="uq_legal_acceptances_user_doc_version"),
    )
    op.create_index("idx_legal_acceptances_user", "legal_acceptances", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_legal_acceptances_user", table_name="legal_acceptances")
    op.drop_table("legal_acceptances")
