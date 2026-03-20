"""pharmacy marketplace: drugs, availability, offers, owner shopping list

Revision ID: 008_pharmacy_marketplace
Revises: 007_marketplace_layer
Create Date: 2026-03-06 19:40:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "008_pharmacy_marketplace"
down_revision: Union[str, None] = "007_marketplace_layer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pharmacy_type_enum = sa.Enum("offline", "online", "both", name="pharmacy_type_enum", native_enum=False)
    pharmacy_type_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "drugs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("active_substance", sa.String(length=255), nullable=True),
        sa.Column("group_name", sa.String(length=128), nullable=True),
        sa.Column("species_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("forms_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("prescription_required", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("controlled_flag", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("indications_summary", sa.Text(), nullable=True),
        sa.Column("contraindications_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("side_effects_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("interactions_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("warnings_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("storage_notes", sa.Text(), nullable=True),
        sa.Column("tags_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("clinical_notes_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("popularity_rank", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("external_id", name="uq_drugs_external_id"),
    )
    op.create_index("idx_drugs_name", "drugs", ["name"], unique=False)
    op.create_index("idx_drugs_active_substance", "drugs", ["active_substance"], unique=False)
    op.create_index("idx_drugs_prescription_required", "drugs", ["prescription_required"], unique=False)
    op.create_index("idx_drugs_popularity_rank", "drugs", ["popularity_rank"], unique=False)

    op.create_table(
        "drug_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("url", sa.String(length=512), nullable=False),
        sa.Column("image_type", sa.String(length=32), nullable=False, server_default=sa.text("'packshot'")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("drug_id", "url", name="uq_drug_images_drug_url"),
    )
    op.create_index("idx_drug_images_drug_sort", "drug_images", ["drug_id", "sort_order"], unique=False)

    op.create_table(
        "drug_variants",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("form", sa.String(length=64), nullable=False),
        sa.Column("strength_text", sa.String(length=128), nullable=True),
        sa.Column("pack_size_text", sa.String(length=128), nullable=True),
        sa.Column("sku_text", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_drug_variants_drug_form", "drug_variants", ["drug_id", "form"], unique=False)

    op.create_table(
        "drug_analogs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("analog_drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.String(length=64), nullable=False, server_default=sa.text("'class'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("drug_id", "analog_drug_id", name="uq_drug_analogs_pair"),
    )
    op.create_index("idx_drug_analogs_drug", "drug_analogs", ["drug_id"], unique=False)

    op.create_table(
        "drug_warnings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("warning_text", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(length=32), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_drug_warnings_drug", "drug_warnings", ["drug_id"], unique=False)

    op.create_table(
        "pharmacies",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("pharmacy_type", pharmacy_type_enum, nullable=False, server_default=sa.text("'offline'")),
        sa.Column("website", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", "pharmacy_type", name="uq_pharmacies_name_type"),
    )
    op.create_index("idx_pharmacies_type", "pharmacies", ["pharmacy_type"], unique=False)

    op.create_table(
        "pharmacy_locations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("pharmacy_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("pharmacies.id", ondelete="CASCADE"), nullable=False),
        sa.Column("city", sa.String(length=128), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("hours", sa.String(length=128), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_pharmacy_locations_city", "pharmacy_locations", ["city"], unique=False)
    op.create_index("idx_pharmacy_locations_pharmacy", "pharmacy_locations", ["pharmacy_id"], unique=False)

    op.create_table(
        "pharmacy_inventory",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "pharmacy_location_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("pharmacy_locations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drug_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("in_stock", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("price_text", sa.String(length=64), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("pharmacy_location_id", "drug_id", "variant_id", name="uq_inventory_location_drug_variant"),
    )
    op.create_index("idx_inventory_drug_stock", "pharmacy_inventory", ["drug_id", "in_stock"], unique=False)
    op.create_index("idx_inventory_location", "pharmacy_inventory", ["pharmacy_location_id"], unique=False)

    op.create_table(
        "online_stores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("website", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=64), nullable=True),
        sa.Column("rating", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("name", name="uq_online_stores_name"),
    )

    op.create_table(
        "online_offers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("online_store_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("online_stores.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drug_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("price_text", sa.String(length=64), nullable=False),
        sa.Column("delivery_text", sa.String(length=255), nullable=True),
        sa.Column("url", sa.String(length=512), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("online_store_id", "drug_id", "variant_id", name="uq_online_offer_store_drug_variant"),
    )
    op.create_index("idx_online_offers_drug", "online_offers", ["drug_id"], unique=False)
    op.create_index("idx_online_offers_store", "online_offers", ["online_store_id"], unique=False)

    op.create_table(
        "price_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_type", sa.String(length=16), nullable=False),
        sa.Column("source_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("price_text", sa.String(length=64), nullable=False),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_price_snapshots_drug_time", "price_snapshots", ["drug_id", "captured_at"], unique=False)

    op.create_table(
        "availability_queries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("role", sa.String(length=32), nullable=True),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("city", sa.String(length=128), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("radius_km", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_availability_queries_drug_time", "availability_queries", ["drug_id", "created_at"], unique=False)
    op.create_index("idx_availability_queries_user_time", "availability_queries", ["user_id", "created_at"], unique=False)

    op.create_table(
        "substitutions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("substitute_drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("drug_id", "substitute_drug_id", name="uq_substitutions_pair"),
    )
    op.create_index("idx_substitutions_drug", "substitutions", ["drug_id"], unique=False)

    op.create_table(
        "owner_shopping_list_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drugs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("drug_variants.id", ondelete="SET NULL"), nullable=True),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("owner_user_id", "drug_id", "variant_id", name="uq_owner_shopping_drug_variant"),
    )
    op.create_index("idx_owner_shopping_owner", "owner_shopping_list_items", ["owner_user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_owner_shopping_owner", table_name="owner_shopping_list_items")
    op.drop_table("owner_shopping_list_items")

    op.drop_index("idx_substitutions_drug", table_name="substitutions")
    op.drop_table("substitutions")

    op.drop_index("idx_availability_queries_user_time", table_name="availability_queries")
    op.drop_index("idx_availability_queries_drug_time", table_name="availability_queries")
    op.drop_table("availability_queries")

    op.drop_index("idx_price_snapshots_drug_time", table_name="price_snapshots")
    op.drop_table("price_snapshots")

    op.drop_index("idx_online_offers_store", table_name="online_offers")
    op.drop_index("idx_online_offers_drug", table_name="online_offers")
    op.drop_table("online_offers")

    op.drop_table("online_stores")

    op.drop_index("idx_inventory_location", table_name="pharmacy_inventory")
    op.drop_index("idx_inventory_drug_stock", table_name="pharmacy_inventory")
    op.drop_table("pharmacy_inventory")

    op.drop_index("idx_pharmacy_locations_pharmacy", table_name="pharmacy_locations")
    op.drop_index("idx_pharmacy_locations_city", table_name="pharmacy_locations")
    op.drop_table("pharmacy_locations")

    op.drop_index("idx_pharmacies_type", table_name="pharmacies")
    op.drop_table("pharmacies")

    op.drop_index("idx_drug_warnings_drug", table_name="drug_warnings")
    op.drop_table("drug_warnings")

    op.drop_index("idx_drug_analogs_drug", table_name="drug_analogs")
    op.drop_table("drug_analogs")

    op.drop_index("idx_drug_variants_drug_form", table_name="drug_variants")
    op.drop_table("drug_variants")

    op.drop_index("idx_drug_images_drug_sort", table_name="drug_images")
    op.drop_table("drug_images")

    op.drop_index("idx_drugs_popularity_rank", table_name="drugs")
    op.drop_index("idx_drugs_prescription_required", table_name="drugs")
    op.drop_index("idx_drugs_active_substance", table_name="drugs")
    op.drop_index("idx_drugs_name", table_name="drugs")
    op.drop_table("drugs")

    pharmacy_type_enum = sa.Enum("offline", "online", "both", name="pharmacy_type_enum", native_enum=False)
    pharmacy_type_enum.drop(op.get_bind(), checkfirst=True)
