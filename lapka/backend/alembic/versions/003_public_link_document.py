"""add document_id to public links

Revision ID: 003_public_link_document
Revises: 002_feature_modules
Create Date: 2026-03-05 23:20:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "003_public_link_document"
down_revision: Union[str, None] = "002_feature_modules"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("public_links", sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "fk_public_links_document_id_documents",
        "public_links",
        "documents",
        ["document_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_public_links_document_id_documents", "public_links", type_="foreignkey")
    op.drop_column("public_links", "document_id")
