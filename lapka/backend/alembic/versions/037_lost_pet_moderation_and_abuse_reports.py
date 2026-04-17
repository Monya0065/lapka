"""lost pet moderation and abuse reports

Revision ID: 037_lp_mod_reports
Revises: 036_lost_pet_ad_budget_entries
Create Date: 2026-04-15 16:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "037_lp_mod_reports"
down_revision: Union[str, None] = "036_lost_pet_ad_budget_entries"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    moderation_status_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        "blocked",
        name="lost_pet_moderation_status_enum",
        native_enum=False,
    )
    moderation_status_enum.create(op.get_bind(), checkfirst=True)

    abuse_status_enum = sa.Enum(
        "open",
        "resolved",
        "rejected",
        name="lost_pet_abuse_report_status_enum",
        native_enum=False,
    )
    abuse_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "lost_pet_reports",
        sa.Column("moderation_status", moderation_status_enum, nullable=False, server_default=sa.text("'approved'")),
    )
    op.add_column("lost_pet_reports", sa.Column("moderation_reason", sa.String(length=500), nullable=True))
    op.add_column("lost_pet_reports", sa.Column("risk_score", sa.Integer(), nullable=False, server_default="0"))
    op.add_column(
        "lost_pet_reports",
        sa.Column(
            "moderated_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column("lost_pet_reports", sa.Column("moderated_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(
        "idx_lost_pet_reports_moderation_status_created",
        "lost_pet_reports",
        ["moderation_status", "created_at"],
        unique=False,
    )
    op.alter_column("lost_pet_reports", "moderation_status", server_default=None)
    op.alter_column("lost_pet_reports", "risk_score", server_default=None)

    op.create_table(
        "lost_pet_abuse_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lost_pet_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reporter_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reason", sa.String(length=64), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", abuse_status_enum, nullable=False, server_default=sa.text("'open'")),
        sa.Column(
            "reviewed_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_lost_pet_abuse_report_status_created",
        "lost_pet_abuse_reports",
        ["status", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_lost_pet_abuse_report_report_created",
        "lost_pet_abuse_reports",
        ["report_id", "created_at"],
        unique=False,
    )
    op.alter_column("lost_pet_abuse_reports", "status", server_default=None)
    op.alter_column("lost_pet_abuse_reports", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_lost_pet_abuse_report_report_created", table_name="lost_pet_abuse_reports")
    op.drop_index("idx_lost_pet_abuse_report_status_created", table_name="lost_pet_abuse_reports")
    op.drop_table("lost_pet_abuse_reports")

    op.drop_index("idx_lost_pet_reports_moderation_status_created", table_name="lost_pet_reports")
    op.drop_column("lost_pet_reports", "moderated_at")
    op.drop_column("lost_pet_reports", "moderated_by_user_id")
    op.drop_column("lost_pet_reports", "risk_score")
    op.drop_column("lost_pet_reports", "moderation_reason")
    op.drop_column("lost_pet_reports", "moderation_status")

    abuse_status_enum = sa.Enum(
        "open",
        "resolved",
        "rejected",
        name="lost_pet_abuse_report_status_enum",
        native_enum=False,
    )
    abuse_status_enum.drop(op.get_bind(), checkfirst=True)

    moderation_status_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        "blocked",
        name="lost_pet_moderation_status_enum",
        native_enum=False,
    )
    moderation_status_enum.drop(op.get_bind(), checkfirst=True)
