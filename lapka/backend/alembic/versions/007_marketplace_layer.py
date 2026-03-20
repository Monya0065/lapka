"""marketplace layer: clinics discovery, vet profiles, review targets

Revision ID: 007_marketplace_layer
Revises: 006_appointments_telemedicine
Create Date: 2026-03-06 16:45:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "007_marketplace_layer"
down_revision: Union[str, None] = "006_appointments_telemedicine"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clinics", sa.Column("description", sa.Text(), nullable=True))
    op.add_column("clinics", sa.Column("logo_url", sa.String(length=512), nullable=True))
    op.add_column("clinics", sa.Column("photos_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")))
    op.add_column("clinics", sa.Column("city", sa.String(length=128), nullable=True))
    op.add_column("clinics", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("clinics", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("clinics", sa.Column("hours", sa.String(length=128), nullable=True))
    op.add_column("clinics", sa.Column("phone", sa.String(length=64), nullable=True))
    op.add_column("clinics", sa.Column("website", sa.String(length=255), nullable=True))
    op.add_column(
        "clinics",
        sa.Column("emergency_available", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "clinics",
        sa.Column("price_level", sa.String(length=16), nullable=False, server_default=sa.text("'medium'")),
    )

    op.create_table(
        "clinic_locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("hours", sa.String(length=128), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_clinic_locations_city", "clinic_locations", ["city"], unique=False)
    op.create_index("idx_clinic_locations_clinic", "clinic_locations", ["clinic_id"], unique=False)

    op.create_table(
        "vet_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("vet_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("specialty", sa.String(length=128), nullable=True),
        sa.Column("experience_years", sa.Integer(), nullable=True),
        sa.Column("photo_url", sa.String(length=512), nullable=True),
        sa.Column("languages_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("working_hours", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("vet_id", name="uq_vet_profiles_vet_id"),
    )
    op.create_index("idx_vet_profiles_clinic", "vet_profiles", ["clinic_id"], unique=False)
    op.create_index("idx_vet_profiles_specialty", "vet_profiles", ["specialty"], unique=False)

    op.create_table(
        "ratings_summary",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("target_type", sa.String(length=16), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("avg_rating", sa.Float(), nullable=False, server_default=sa.text("0")),
        sa.Column("count", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("distribution_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("target_type", "target_id", name="uq_ratings_summary_target"),
    )
    op.create_index("idx_ratings_summary_target", "ratings_summary", ["target_type", "target_id"], unique=False)

    op.add_column("reviews", sa.Column("target_type", sa.String(length=16), nullable=True))
    op.add_column("reviews", sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("reviews", sa.Column("title", sa.String(length=255), nullable=True))
    op.add_column("reviews", sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.alter_column("reviews", "visit_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)
    op.alter_column("reviews", "vet_id", existing_type=postgresql.UUID(as_uuid=True), nullable=True)

    # Backfill historical reviews into vet-target model.
    op.execute("UPDATE reviews SET target_type = 'vet' WHERE target_type IS NULL")
    op.execute("UPDATE reviews SET target_id = vet_id WHERE target_id IS NULL AND vet_id IS NOT NULL")

    op.alter_column("reviews", "target_type", existing_type=sa.String(length=16), nullable=False)
    op.alter_column("reviews", "target_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.create_index("idx_reviews_target_created", "reviews", ["target_type", "target_id", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_reviews_target_created", table_name="reviews")
    op.alter_column("reviews", "vet_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.alter_column("reviews", "visit_id", existing_type=postgresql.UUID(as_uuid=True), nullable=False)
    op.drop_column("reviews", "verified")
    op.drop_column("reviews", "title")
    op.drop_column("reviews", "target_id")
    op.drop_column("reviews", "target_type")

    op.drop_index("idx_ratings_summary_target", table_name="ratings_summary")
    op.drop_table("ratings_summary")

    op.drop_index("idx_vet_profiles_specialty", table_name="vet_profiles")
    op.drop_index("idx_vet_profiles_clinic", table_name="vet_profiles")
    op.drop_table("vet_profiles")

    op.drop_index("idx_clinic_locations_clinic", table_name="clinic_locations")
    op.drop_index("idx_clinic_locations_city", table_name="clinic_locations")
    op.drop_table("clinic_locations")

    op.drop_column("clinics", "price_level")
    op.drop_column("clinics", "emergency_available")
    op.drop_column("clinics", "website")
    op.drop_column("clinics", "phone")
    op.drop_column("clinics", "hours")
    op.drop_column("clinics", "longitude")
    op.drop_column("clinics", "latitude")
    op.drop_column("clinics", "city")
    op.drop_column("clinics", "photos_json")
    op.drop_column("clinics", "logo_url")
    op.drop_column("clinics", "description")
