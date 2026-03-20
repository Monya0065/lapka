"""inpatient as product: owner-safe events, public status, camera activation

Revision ID: 011_inpatient_product
Revises: 010_clinic_visit_journey
Create Date: 2026-03-06 18:05:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "011_inpatient_product"
down_revision: Union[str, None] = "010_clinic_visit_journey"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inpatient_public_status_enum = sa.Enum(
        "stable",
        "monitoring",
        "needs_attention",
        name="inpatient_public_status_enum",
        native_enum=False,
    )
    inpatient_public_status_enum.create(op.get_bind(), checkfirst=True)

    inpatient_event_type_enum = sa.Enum(
        "status_update",
        "photo_report",
        "note",
        "document_added",
        "camera_viewed",
        "vitals_check",
        "feeding",
        "procedure",
        name="inpatient_event_type_enum",
        native_enum=False,
    )
    inpatient_event_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        "inpatient_stays",
        sa.Column(
            "public_status_label",
            inpatient_public_status_enum,
            nullable=False,
            server_default=sa.text("'monitoring'"),
        ),
    )
    op.add_column(
        "inpatient_stays",
        sa.Column(
            "owner_visible_summary",
            sa.Text(),
            nullable=False,
            server_default=sa.text("'Пациент под наблюдением команды.'"),
        ),
    )
    op.add_column(
        "inpatient_stays",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.execute(
        """
        UPDATE inpatient_stays
        SET
            public_status_label = CASE
                WHEN status = 'active' THEN 'monitoring'
                ELSE 'stable'
            END,
            owner_visible_summary = CASE
                WHEN status = 'active' THEN 'Пациент находится под круглосуточным наблюдением, обновления поступают регулярно.'
                ELSE 'Стационар завершён. Рекомендуется follow-up контакт с клиникой при вопросах.'
            END,
            created_at = COALESCE(created_at, admitted_at)
        """
    )

    op.add_column(
        "cameras",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    op.create_table(
        "inpatient_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "stay_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("inpatient_stays.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("event_type", inpatient_event_type_enum, nullable=False),
        sa.Column("owner_visible", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description_safe", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_inpatient_events_stay_time", "inpatient_events", ["stay_id", "created_at"], unique=False)
    op.create_index("idx_inpatient_events_owner_visible", "inpatient_events", ["stay_id", "owner_visible"], unique=False)

    op.alter_column("inpatient_stays", "public_status_label", server_default=None)
    op.alter_column("inpatient_stays", "owner_visible_summary", server_default=None)
    op.alter_column("inpatient_stays", "created_at", server_default=None)
    op.alter_column("cameras", "is_active", server_default=None)
    op.alter_column("inpatient_events", "owner_visible", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_inpatient_events_owner_visible", table_name="inpatient_events")
    op.drop_index("idx_inpatient_events_stay_time", table_name="inpatient_events")
    op.drop_table("inpatient_events")

    op.drop_column("cameras", "is_active")

    op.drop_column("inpatient_stays", "created_at")
    op.drop_column("inpatient_stays", "owner_visible_summary")
    op.drop_column("inpatient_stays", "public_status_label")

    inpatient_event_type_enum = sa.Enum(
        "status_update",
        "photo_report",
        "note",
        "document_added",
        "camera_viewed",
        "vitals_check",
        "feeding",
        "procedure",
        name="inpatient_event_type_enum",
        native_enum=False,
    )
    inpatient_event_type_enum.drop(op.get_bind(), checkfirst=True)

    inpatient_public_status_enum = sa.Enum(
        "stable",
        "monitoring",
        "needs_attention",
        name="inpatient_public_status_enum",
        native_enum=False,
    )
    inpatient_public_status_enum.drop(op.get_bind(), checkfirst=True)
