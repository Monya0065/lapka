"""growth & viral mechanics: pet passports, lost pets, referrals, clinic invites

Revision ID: 012_growth_viral_mechanics
Revises: 011_inpatient_product
Create Date: 2026-03-06 20:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "012_growth_viral_mechanics"
down_revision: Union[str, None] = "011_inpatient_product"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("master_pets", sa.Column("color", sa.String(length=128), nullable=True))
    op.add_column("master_pets", sa.Column("photo_url", sa.String(length=512), nullable=True))

    lost_pet_status_enum = sa.Enum(
        "active",
        "found",
        "closed",
        name="lost_pet_status_enum",
        native_enum=False,
    )
    lost_pet_status_enum.create(op.get_bind(), checkfirst=True)

    referral_status_enum = sa.Enum(
        "sent",
        "registered",
        name="referral_status_enum",
        native_enum=False,
    )
    referral_status_enum.create(op.get_bind(), checkfirst=True)

    clinic_invite_status_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        name="clinic_invite_status_enum",
        native_enum=False,
    )
    clinic_invite_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "pet_passports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("public_token", sa.String(length=255), nullable=False),
        sa.Column("emergency_contact_phone", sa.String(length=32), nullable=True),
        sa.Column("allow_unmasked_phone", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("allergies_summary", sa.Text(), nullable=True),
        sa.Column("include_microchip", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("pet_id", name="uq_pet_passports_pet"),
        sa.UniqueConstraint("public_token", name="uq_pet_passports_token"),
    )
    op.create_index("idx_pet_passports_token", "pet_passports", ["public_token"], unique=False)
    op.create_index("idx_pet_passports_pet_revoked", "pet_passports", ["pet_id", "revoked_at"], unique=False)

    op.create_table(
        "lost_pet_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("last_seen_location", sa.String(length=255), nullable=False),
        sa.Column("last_seen_time", sa.DateTime(timezone=True), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("photo_url", sa.String(length=512), nullable=True),
        sa.Column("status", lost_pet_status_enum, nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_lost_pet_reports_city_status", "lost_pet_reports", ["city", "status"], unique=False)
    op.create_index("idx_lost_pet_reports_owner_created", "lost_pet_reports", ["owner_id", "created_at"], unique=False)
    op.create_index("idx_lost_pet_reports_pet_created", "lost_pet_reports", ["pet_id", "created_at"], unique=False)

    op.create_table(
        "lost_pet_sightings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "report_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lost_pet_reports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("reporter_name", sa.String(length=255), nullable=True),
        sa.Column("reporter_contact", sa.String(length=255), nullable=True),
        sa.Column("location_note", sa.String(length=255), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_lost_pet_sightings_report_created",
        "lost_pet_sightings",
        ["report_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "referrals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "inviter_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("invited_email", sa.String(length=255), nullable=False),
        sa.Column("referral_code", sa.String(length=64), nullable=False),
        sa.Column("status", referral_status_enum, nullable=False, server_default=sa.text("'sent'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("registered_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("referral_code", name="uq_referrals_code"),
    )
    op.create_index("idx_referrals_inviter_created", "referrals", ["inviter_user_id", "created_at"], unique=False)
    op.create_index("idx_referrals_email", "referrals", ["invited_email"], unique=False)

    op.create_table(
        "clinic_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "inviter_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("clinic_name", sa.String(length=255), nullable=False),
        sa.Column("clinic_email", sa.String(length=255), nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", clinic_invite_status_enum, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "reviewed_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("review_note", sa.Text(), nullable=True),
    )
    op.create_index("idx_clinic_invites_status_created", "clinic_invites", ["status", "created_at"], unique=False)
    op.create_index("idx_clinic_invites_email", "clinic_invites", ["clinic_email"], unique=False)
    op.create_index("idx_clinic_invites_inviter", "clinic_invites", ["inviter_user_id", "created_at"], unique=False)

    op.alter_column("pet_passports", "allow_unmasked_phone", server_default=None)
    op.alter_column("pet_passports", "include_microchip", server_default=None)
    op.alter_column("pet_passports", "created_at", server_default=None)
    op.alter_column("pet_passports", "updated_at", server_default=None)
    op.alter_column("lost_pet_reports", "status", server_default=None)
    op.alter_column("lost_pet_reports", "created_at", server_default=None)
    op.alter_column("lost_pet_reports", "updated_at", server_default=None)
    op.alter_column("lost_pet_sightings", "created_at", server_default=None)
    op.alter_column("referrals", "status", server_default=None)
    op.alter_column("referrals", "created_at", server_default=None)
    op.alter_column("clinic_invites", "status", server_default=None)
    op.alter_column("clinic_invites", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_index("idx_clinic_invites_inviter", table_name="clinic_invites")
    op.drop_index("idx_clinic_invites_email", table_name="clinic_invites")
    op.drop_index("idx_clinic_invites_status_created", table_name="clinic_invites")
    op.drop_table("clinic_invites")

    op.drop_index("idx_referrals_email", table_name="referrals")
    op.drop_index("idx_referrals_inviter_created", table_name="referrals")
    op.drop_table("referrals")

    op.drop_index("idx_lost_pet_sightings_report_created", table_name="lost_pet_sightings")
    op.drop_table("lost_pet_sightings")

    op.drop_index("idx_lost_pet_reports_pet_created", table_name="lost_pet_reports")
    op.drop_index("idx_lost_pet_reports_owner_created", table_name="lost_pet_reports")
    op.drop_index("idx_lost_pet_reports_city_status", table_name="lost_pet_reports")
    op.drop_table("lost_pet_reports")

    op.drop_index("idx_pet_passports_pet_revoked", table_name="pet_passports")
    op.drop_index("idx_pet_passports_token", table_name="pet_passports")
    op.drop_table("pet_passports")

    clinic_invite_status_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        name="clinic_invite_status_enum",
        native_enum=False,
    )
    clinic_invite_status_enum.drop(op.get_bind(), checkfirst=True)

    referral_status_enum = sa.Enum(
        "sent",
        "registered",
        name="referral_status_enum",
        native_enum=False,
    )
    referral_status_enum.drop(op.get_bind(), checkfirst=True)

    lost_pet_status_enum = sa.Enum(
        "active",
        "found",
        "closed",
        name="lost_pet_status_enum",
        native_enum=False,
    )
    lost_pet_status_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_column("master_pets", "photo_url")
    op.drop_column("master_pets", "color")
