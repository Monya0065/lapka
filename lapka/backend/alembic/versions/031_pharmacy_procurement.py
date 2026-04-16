"""pharmacy: stock units, reorder points, purchase orders

Revision ID: 031_pharm_procure
Revises: 030_legal_acceptance
Create Date: 2026-04-14 20:00:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "031_pharm_procure"
down_revision: Union[str, None] = "030_legal_acceptance"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "pharmacy_inventory",
        sa.Column("stock_units", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "pharmacy_inventory",
        sa.Column("reorder_point_units", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "pharmacy_inventory",
        sa.Column("reorder_batch_units", sa.Integer(), nullable=False, server_default="1"),
    )
    op.add_column(
        "pharmacy_inventory",
        sa.Column("preferred_supplier_note", sa.String(length=255), nullable=True),
    )
    op.create_check_constraint(
        "ck_pharmacy_inventory_stock_units_non_negative",
        "pharmacy_inventory",
        "stock_units >= 0",
    )
    op.create_check_constraint(
        "ck_pharmacy_inventory_reorder_point_non_negative",
        "pharmacy_inventory",
        "reorder_point_units >= 0",
    )
    op.create_check_constraint(
        "ck_pharmacy_inventory_reorder_batch_positive",
        "pharmacy_inventory",
        "reorder_batch_units >= 1",
    )

    op.execute(
        """
        UPDATE pharmacy_inventory
        SET stock_units = CASE WHEN in_stock THEN 10 ELSE 0 END,
            reorder_point_units = CASE WHEN in_stock THEN 8 ELSE 5 END,
            reorder_batch_units = 12
        """
    )

    op.create_table(
        "pharmacy_purchase_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pharmacy_location_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            sa.String(length=32),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("supplier_name", sa.String(length=255), nullable=False),
        sa.Column("reference_code", sa.String(length=64), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pharmacy_location_id"], ["pharmacy_locations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_pharm_po_clinic_created",
        "pharmacy_purchase_orders",
        ["clinic_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "idx_pharm_po_location",
        "pharmacy_purchase_orders",
        ["pharmacy_location_id"],
        unique=False,
    )

    op.create_table(
        "pharmacy_purchase_order_lines",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pharmacy_inventory_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("drug_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("variant_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("quantity_ordered", sa.Integer(), nullable=False),
        sa.Column("quantity_received", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("notes", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["pharmacy_purchase_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pharmacy_inventory_id"], ["pharmacy_inventory.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["drug_id"], ["drugs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["variant_id"], ["drug_variants.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.CheckConstraint("quantity_ordered >= 1", name="ck_pharm_po_line_qty_ordered"),
        sa.CheckConstraint("quantity_received >= 0", name="ck_pharm_po_line_qty_received"),
    )
    op.create_index("idx_pharm_po_lines_order", "pharmacy_purchase_order_lines", ["order_id"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_pharm_po_lines_order", table_name="pharmacy_purchase_order_lines")
    op.drop_table("pharmacy_purchase_order_lines")
    op.drop_index("idx_pharm_po_location", table_name="pharmacy_purchase_orders")
    op.drop_index("idx_pharm_po_clinic_created", table_name="pharmacy_purchase_orders")
    op.drop_table("pharmacy_purchase_orders")

    op.drop_constraint("ck_pharmacy_inventory_reorder_batch_positive", "pharmacy_inventory", type_="check")
    op.drop_constraint("ck_pharmacy_inventory_reorder_point_non_negative", "pharmacy_inventory", type_="check")
    op.drop_constraint("ck_pharmacy_inventory_stock_units_non_negative", "pharmacy_inventory", type_="check")
    op.drop_column("pharmacy_inventory", "preferred_supplier_note")
    op.drop_column("pharmacy_inventory", "reorder_batch_units")
    op.drop_column("pharmacy_inventory", "reorder_point_units")
    op.drop_column("pharmacy_inventory", "stock_units")
