"""clinic-grade patient search models: lapka_id, consent requests, pet qr tokens

Revision ID: 009_clinic_patient_search
Revises: 008_pharmacy_marketplace
Create Date: 2026-03-06 12:30:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "009_clinic_patient_search"
down_revision: Union[str, None] = "008_pharmacy_marketplace"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("master_pets", sa.Column("lapka_id", sa.String(length=64), nullable=True))
    op.add_column("master_pets", sa.Column("sex", sa.String(length=16), nullable=True))
    op.add_column("master_pets", sa.Column("birth_date", sa.Date(), nullable=True))

    op.execute(
        """
        UPDATE master_pets
        SET lapka_id = 'LPK-' || upper(substr(replace(id::text, '-', ''), 1, 12))
        WHERE lapka_id IS NULL
        """
    )

    op.alter_column("master_pets", "lapka_id", existing_type=sa.String(length=64), nullable=False)
    op.create_unique_constraint("uq_master_pets_lapka_id", "master_pets", ["lapka_id"])
    op.create_index("idx_master_pets_name", "master_pets", ["name"], unique=False)
    op.create_index("idx_master_pets_species", "master_pets", ["species"], unique=False)
    op.create_index("idx_master_pets_chip", "master_pets", ["chip_id"], unique=False)
    op.create_index("idx_master_pets_passport", "master_pets", ["passport_id"], unique=False)
    op.create_index("idx_master_pets_lapka_id", "master_pets", ["lapka_id"], unique=False)

    op.create_index("idx_users_phone", "users", ["phone"], unique=False)
    op.create_index("idx_users_full_name", "users", ["full_name"], unique=False)

    consent_request_scope_enum = sa.Enum(
        "PRESCRIPTIONS_ONLY",
        "BASIC_MEDICAL",
        "FULL_RECORD",
        "INPATIENT_VIEW",
        "CAMERA_VIEW",
        name="consent_request_scope_enum",
        native_enum=False,
    )
    consent_request_scope_enum.create(op.get_bind(), checkfirst=True)

    consent_request_status_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        "cancelled",
        name="consent_request_status_enum",
        native_enum=False,
    )
    consent_request_status_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "consent_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "requested_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("requested_scope", consent_request_scope_enum, nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("status", consent_request_status_enum, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("decision_note", sa.Text(), nullable=True),
        sa.Column(
            "resolved_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_consent_requests_pet_status", "consent_requests", ["pet_id", "status"], unique=False)
    op.create_index("idx_consent_requests_clinic_status", "consent_requests", ["clinic_id", "status"], unique=False)
    op.create_index(
        "idx_consent_requests_requester",
        "consent_requests",
        ["requested_by_user_id", "created_at"],
        unique=False,
    )

    op.create_table(
        "pet_qr_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "created_by_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("token_hash", name="uq_pet_qr_tokens_token_hash"),
    )
    op.create_index("idx_pet_qr_tokens_pet", "pet_qr_tokens", ["pet_id"], unique=False)
    op.create_index("idx_pet_qr_tokens_active", "pet_qr_tokens", ["pet_id", "revoked_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_pet_qr_tokens_active", table_name="pet_qr_tokens")
    op.drop_index("idx_pet_qr_tokens_pet", table_name="pet_qr_tokens")
    op.drop_table("pet_qr_tokens")

    op.drop_index("idx_consent_requests_requester", table_name="consent_requests")
    op.drop_index("idx_consent_requests_clinic_status", table_name="consent_requests")
    op.drop_index("idx_consent_requests_pet_status", table_name="consent_requests")
    op.drop_table("consent_requests")

    consent_request_status_enum = sa.Enum(
        "pending",
        "approved",
        "rejected",
        "cancelled",
        name="consent_request_status_enum",
        native_enum=False,
    )
    consent_request_scope_enum = sa.Enum(
        "PRESCRIPTIONS_ONLY",
        "BASIC_MEDICAL",
        "FULL_RECORD",
        "INPATIENT_VIEW",
        "CAMERA_VIEW",
        name="consent_request_scope_enum",
        native_enum=False,
    )
    consent_request_status_enum.drop(op.get_bind(), checkfirst=True)
    consent_request_scope_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_index("idx_users_full_name", table_name="users")
    op.drop_index("idx_users_phone", table_name="users")

    op.drop_index("idx_master_pets_lapka_id", table_name="master_pets")
    op.drop_index("idx_master_pets_passport", table_name="master_pets")
    op.drop_index("idx_master_pets_chip", table_name="master_pets")
    op.drop_index("idx_master_pets_species", table_name="master_pets")
    op.drop_index("idx_master_pets_name", table_name="master_pets")
    op.drop_constraint("uq_master_pets_lapka_id", "master_pets", type_="unique")
    op.drop_column("master_pets", "birth_date")
    op.drop_column("master_pets", "sex")
    op.drop_column("master_pets", "lapka_id")
