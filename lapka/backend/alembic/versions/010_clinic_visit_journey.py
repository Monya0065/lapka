"""clinic visit journey: structured visit fields, notifications, check-in support

Revision ID: 010_clinic_visit_journey
Revises: 009_clinic_patient_search
Create Date: 2026-03-06 16:35:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "010_clinic_visit_journey"
down_revision: Union[str, None] = "009_clinic_patient_search"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    visit_status_enum = sa.Enum(
        "draft",
        "in_progress",
        "completed",
        name="visit_status_enum",
        native_enum=False,
    )
    visit_status_enum.create(op.get_bind(), checkfirst=True)

    op.add_column("visits", sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("visits", sa.Column("status", visit_status_enum, nullable=False, server_default=sa.text("'draft'")))
    op.add_column("visits", sa.Column("complaints", sa.Text(), nullable=True))
    op.add_column("visits", sa.Column("anamnesis", sa.Text(), nullable=True))
    op.add_column("visits", sa.Column("physical_exam", sa.Text(), nullable=True))
    op.add_column("visits", sa.Column("diagnostics", sa.Text(), nullable=True))
    op.add_column("visits", sa.Column("assessment_note", sa.Text(), nullable=True))
    op.add_column("visits", sa.Column("follow_up_note", sa.Text(), nullable=True))
    op.add_column("visits", sa.Column("owner_summary", sa.Text(), nullable=True))
    op.add_column(
        "visits",
        sa.Column(
            "attachments_json",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'::json"),
        ),
    )
    op.add_column("visits", sa.Column("started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("visits", sa.Column("finalized_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("visits", sa.Column("locked_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "visits",
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_foreign_key(
        "fk_visits_appointment",
        "visits",
        "appointments",
        ["appointment_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("idx_visits_appointment", "visits", ["appointment_id"], unique=False)
    op.create_index("idx_visits_status_created_at", "visits", ["status", "created_at"], unique=False)

    op.execute(
        """
        UPDATE visits
        SET
          complaints = chief_complaint,
          physical_exam = exam_findings,
          status = CASE WHEN finalized_flag = true THEN 'completed' ELSE 'draft' END,
          finalized_at = CASE WHEN finalized_flag = true THEN COALESCE(finalized_at, created_at) ELSE finalized_at END,
          locked_at = CASE WHEN finalized_flag = true THEN COALESCE(locked_at, created_at) ELSE locked_at END
        """
    )

    notification_type_enum = sa.Enum(
        "appointment_confirmed",
        "appointment_reminder",
        "visit_ready",
        "inpatient_update",
        name="notification_type_enum",
        native_enum=False,
    )
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="SET NULL"), nullable=True),
        sa.Column(
            "appointment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("appointments.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id", ondelete="SET NULL"), nullable=True),
        sa.Column("notification_type", notification_type_enum, nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_notifications_user_created", "notifications", ["user_id", "created_at"], unique=False)
    op.create_index("idx_notifications_user_unread", "notifications", ["user_id", "is_read"], unique=False)

    # Cleanup defaults that are no longer needed after backfill.
    op.alter_column("visits", "attachments_json", server_default=None)
    op.alter_column("visits", "status", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_notifications_user_unread", table_name="notifications")
    op.drop_index("idx_notifications_user_created", table_name="notifications")
    op.drop_table("notifications")

    notification_type_enum = sa.Enum(
        "appointment_confirmed",
        "appointment_reminder",
        "visit_ready",
        "inpatient_update",
        name="notification_type_enum",
        native_enum=False,
    )
    notification_type_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index("idx_visits_status_created_at", table_name="visits")
    op.drop_index("idx_visits_appointment", table_name="visits")
    op.drop_constraint("fk_visits_appointment", "visits", type_="foreignkey")

    op.drop_column("visits", "updated_at")
    op.drop_column("visits", "locked_at")
    op.drop_column("visits", "finalized_at")
    op.drop_column("visits", "started_at")
    op.drop_column("visits", "attachments_json")
    op.drop_column("visits", "owner_summary")
    op.drop_column("visits", "follow_up_note")
    op.drop_column("visits", "assessment_note")
    op.drop_column("visits", "diagnostics")
    op.drop_column("visits", "physical_exam")
    op.drop_column("visits", "anamnesis")
    op.drop_column("visits", "complaints")
    op.drop_column("visits", "status")
    op.drop_column("visits", "appointment_id")

    visit_status_enum = sa.Enum(
        "draft",
        "in_progress",
        "completed",
        name="visit_status_enum",
        native_enum=False,
    )
    visit_status_enum.drop(op.get_bind(), checkfirst=True)
