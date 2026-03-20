"""initial schema

Revision ID: 001_initial
Revises:
Create Date: 2026-03-05 12:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("full_name", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "clinics",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False, unique=True),
        sa.Column("address", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("refresh_token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role_in_clinic", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("user_id", "clinic_id", name="uq_membership_user_clinic"),
    )

    op.create_table(
        "master_pets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("species", sa.String(length=64), nullable=False),
        sa.Column("breed", sa.String(length=128), nullable=True),
        sa.Column("chip_id", sa.String(length=128), nullable=True, unique=True),
        sa.Column("passport_id", sa.String(length=128), nullable=True, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "pet_owner_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("pet_id", "owner_user_id", name="uq_pet_owner"),
    )

    op.create_table(
        "consent_grants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scope_level", sa.String(length=32), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_consent_active", "consent_grants", ["clinic_id", "pet_id", "scope_level"], unique=False)

    op.create_table(
        "visits",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("vet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("chief_complaint", sa.Text(), nullable=True),
        sa.Column("exam_findings", sa.Text(), nullable=True),
        sa.Column("plan_note", sa.Text(), nullable=True),
        sa.Column("finalized_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_visits_pet_created_at", "visits", ["pet_id", "created_at"], unique=False)
    op.create_index("idx_visits_clinic_created_at", "visits", ["clinic_id", "created_at"], unique=False)

    op.create_table(
        "prescriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drug_name", sa.String(length=255), nullable=False),
        sa.Column("instruction_note", sa.Text(), nullable=False),
        sa.Column("prescription_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("doc_type", sa.String(length=64), nullable=False),
        sa.Column("file_ref", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_documents_pet_created_at", "documents", ["pet_id", "created_at"], unique=False)
    op.create_index("idx_documents_clinic_created_at", "documents", ["clinic_id", "created_at"], unique=False)

    op.create_table(
        "inpatient_stays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("attending_vet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("ward", sa.String(length=64), nullable=False),
        sa.Column("bed", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("admitted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("discharged_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_inpatient_status_clinic", "inpatient_stays", ["status", "clinic_id"], unique=False)
    op.create_index("idx_inpatient_pet_status", "inpatient_stays", ["pet_id", "status"], unique=False)

    op.create_table(
        "cameras",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("stay_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("inpatient_stays.id", ondelete="CASCADE"), nullable=False),
        sa.Column("camera_name", sa.String(length=128), nullable=False),
        sa.Column("stream_ref_stub", sa.String(length=255), nullable=False),
    )

    op.create_table(
        "camera_access_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("camera_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cameras.id", ondelete="CASCADE"), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("one_time_flag", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "public_links",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("link_type", sa.String(length=64), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("visits.id", ondelete="CASCADE"), nullable=True),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("master_pets.id", ondelete="CASCADE"), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target_type", sa.String(length=64), nullable=False),
        sa.Column("target_id", sa.String(length=128), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_audit_clinic_created_at", "audit_events", ["clinic_id", "created_at"], unique=False)
    op.create_index("idx_audit_actor_created_at", "audit_events", ["actor_user_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_audit_actor_created_at", table_name="audit_events")
    op.drop_index("idx_audit_clinic_created_at", table_name="audit_events")
    op.drop_table("audit_events")

    op.drop_table("public_links")
    op.drop_table("camera_access_tokens")
    op.drop_table("cameras")

    op.drop_index("idx_inpatient_pet_status", table_name="inpatient_stays")
    op.drop_index("idx_inpatient_status_clinic", table_name="inpatient_stays")
    op.drop_table("inpatient_stays")

    op.drop_index("idx_documents_clinic_created_at", table_name="documents")
    op.drop_index("idx_documents_pet_created_at", table_name="documents")
    op.drop_table("documents")

    op.drop_table("prescriptions")

    op.drop_index("idx_visits_clinic_created_at", table_name="visits")
    op.drop_index("idx_visits_pet_created_at", table_name="visits")
    op.drop_table("visits")

    op.drop_index("idx_consent_active", table_name="consent_grants")
    op.drop_table("consent_grants")

    op.drop_table("pet_owner_links")
    op.drop_table("master_pets")
    op.drop_table("memberships")
    op.drop_table("sessions")
    op.drop_table("clinics")
    op.drop_table("users")
