"""add vaccine entries and reminders

Revision ID: 004_vaccines_reminders
Revises: 003_public_link_document
Create Date: 2026-03-06 06:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "004_vaccines_reminders"
down_revision: Union[str, None] = "003_public_link_document"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "vaccine_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("vaccine_name", sa.String(length=255), nullable=False),
        sa.Column("administered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("next_due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_vaccine_entries_pet_date", "vaccine_entries", ["pet_id", "administered_at"], unique=False)
    op.create_index("idx_vaccine_entries_next_due", "vaccine_entries", ["next_due_date"], unique=False)

    op.create_table(
        "reminders",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reminder_type", sa.String(length=16), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_reminders_owner_due", "reminders", ["owner_user_id", "due_at"], unique=False)
    op.create_index("idx_reminders_pet_due", "reminders", ["pet_id", "due_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_reminders_pet_due", table_name="reminders")
    op.drop_index("idx_reminders_owner_due", table_name="reminders")
    op.drop_table("reminders")

    op.drop_index("idx_vaccine_entries_next_due", table_name="vaccine_entries")
    op.drop_index("idx_vaccine_entries_pet_date", table_name="vaccine_entries")
    op.drop_table("vaccine_entries")
