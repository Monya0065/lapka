"""Clinic SaaS suite: billing, insurance, labs, clinic services

Revision ID: 014_clinic_saas_suite
Revises: 013_growth_defaults_fix
Create Date: 2026-03-06 21:05:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "014_clinic_saas_suite"
down_revision = "013_growth_defaults_fix"
branch_labels = None
depends_on = None


clinic_service_category_enum = sa.Enum(
    "consultation",
    "vaccination",
    "imaging",
    "lab",
    "surgery",
    "inpatient",
    "telemedicine",
    "other",
    name="clinic_service_category_enum",
    native_enum=False,
)

invoice_status_enum = sa.Enum("draft", "issued", "paid", "void", name="invoice_status_enum", native_enum=False)
payment_status_enum = sa.Enum(
    "pending",
    "succeeded",
    "failed",
    "refunded",
    name="payment_status_enum",
    native_enum=False,
)
insurance_policy_status_enum = sa.Enum(
    "active",
    "inactive",
    "cancelled",
    name="insurance_policy_status_enum",
    native_enum=False,
)
insurance_claim_status_enum = sa.Enum(
    "draft",
    "submitted",
    "approved",
    "rejected",
    name="insurance_claim_status_enum",
    native_enum=False,
)
lab_order_status_enum = sa.Enum(
    "created",
    "sent",
    "received",
    "cancelled",
    name="lab_order_status_enum",
    native_enum=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    clinic_service_category_enum.create(bind, checkfirst=True)
    invoice_status_enum.create(bind, checkfirst=True)
    payment_status_enum.create(bind, checkfirst=True)
    insurance_policy_status_enum.create(bind, checkfirst=True)
    insurance_claim_status_enum.create(bind, checkfirst=True)
    lab_order_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "clinic_services",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("category", clinic_service_category_enum, nullable=False, server_default=sa.text("'consultation'")),
        sa.Column("price_cents", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default=sa.text("'RUB'")),
        sa.Column("duration_minutes", sa.Integer(), nullable=False, server_default=sa.text("30")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("clinic_id", "name", name="uq_clinic_services_clinic_name"),
    )
    op.create_index("idx_clinic_services_clinic_active", "clinic_services", ["clinic_id", "is_active"])
    op.create_index("idx_clinic_services_clinic_category", "clinic_services", ["clinic_id", "category"])

    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("appointment_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", invoice_status_enum, nullable=False, server_default=sa.text("'draft'")),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default=sa.text("'RUB'")),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("public_token", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["appointment_id"], ["appointments.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pet_id"], ["master_pets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_token"),
    )
    op.create_index("idx_invoices_clinic_status_created", "invoices", ["clinic_id", "status", "created_at"])
    op.create_index("idx_invoices_owner_created", "invoices", ["owner_id", "created_at"])
    op.create_index("idx_invoices_pet_created", "invoices", ["pet_id", "created_at"])
    op.create_index("idx_invoices_public_token", "invoices", ["public_token"])

    op.create_table(
        "invoice_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("service_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("unit_price_cents", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("total_cents", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("qty > 0", name="ck_invoice_items_qty_positive"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["service_id"], ["clinic_services.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_invoice_items_invoice", "invoice_items", ["invoice_id"])

    op.create_table(
        "payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider", sa.String(length=64), nullable=False, server_default=sa.text("'demo'")),
        sa.Column("status", payment_status_enum, nullable=False, server_default=sa.text("'pending'")),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=False, server_default=sa.text("'RUB'")),
        sa.Column("receipt_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_payments_invoice_created", "payments", ["invoice_id", "created_at"])
    op.create_index("idx_payments_status_created", "payments", ["status", "created_at"])

    op.create_table(
        "insurance_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_name", sa.String(length=255), nullable=False),
        sa.Column("policy_number_masked", sa.String(length=64), nullable=False),
        sa.Column("status", insurance_policy_status_enum, nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_insurance_policies_owner_created", "insurance_policies", ["owner_id", "created_at"])
    op.create_index("idx_insurance_policies_status", "insurance_policies", ["status"])

    op.create_table(
        "insurance_claims",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", insurance_claim_status_enum, nullable=False, server_default=sa.text("'draft'")),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["pet_id"], ["master_pets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_insurance_claims_clinic_status", "insurance_claims", ["clinic_id", "status"])
    op.create_index("idx_insurance_claims_owner_created", "insurance_claims", ["owner_id", "created_at"])
    op.create_index("idx_insurance_claims_invoice", "insurance_claims", ["invoice_id"])

    op.create_table(
        "lab_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider_type", sa.String(length=64), nullable=False, server_default=sa.text("'demo'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
    )
    op.create_index("idx_lab_providers_active", "lab_providers", ["is_active"])

    op.create_table(
        "lab_orders",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("pet_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("visit_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("status", lab_order_status_enum, nullable=False, server_default=sa.text("'created'")),
        sa.Column("ordered_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("external_ref", sa.String(length=255), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
            server_onupdate=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["pet_id"], ["master_pets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["provider_id"], ["lab_providers.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["visit_id"], ["visits.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_lab_orders_clinic_status", "lab_orders", ["clinic_id", "status"])
    op.create_index("idx_lab_orders_pet_ordered", "lab_orders", ["pet_id", "ordered_at"])
    op.create_index("idx_lab_orders_visit", "lab_orders", ["visit_id"])

    op.create_table(
        "lab_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("order_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("result_text", sa.Text(), nullable=False),
        sa.Column("attachments_json", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.ForeignKeyConstraint(["order_id"], ["lab_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_lab_results_order_created", "lab_results", ["order_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_lab_results_order_created", table_name="lab_results")
    op.drop_table("lab_results")
    op.drop_index("idx_lab_orders_visit", table_name="lab_orders")
    op.drop_index("idx_lab_orders_pet_ordered", table_name="lab_orders")
    op.drop_index("idx_lab_orders_clinic_status", table_name="lab_orders")
    op.drop_table("lab_orders")
    op.drop_index("idx_lab_providers_active", table_name="lab_providers")
    op.drop_table("lab_providers")

    op.drop_index("idx_insurance_claims_invoice", table_name="insurance_claims")
    op.drop_index("idx_insurance_claims_owner_created", table_name="insurance_claims")
    op.drop_index("idx_insurance_claims_clinic_status", table_name="insurance_claims")
    op.drop_table("insurance_claims")
    op.drop_index("idx_insurance_policies_status", table_name="insurance_policies")
    op.drop_index("idx_insurance_policies_owner_created", table_name="insurance_policies")
    op.drop_table("insurance_policies")

    op.drop_index("idx_payments_status_created", table_name="payments")
    op.drop_index("idx_payments_invoice_created", table_name="payments")
    op.drop_table("payments")
    op.drop_index("idx_invoice_items_invoice", table_name="invoice_items")
    op.drop_table("invoice_items")
    op.drop_index("idx_invoices_public_token", table_name="invoices")
    op.drop_index("idx_invoices_pet_created", table_name="invoices")
    op.drop_index("idx_invoices_owner_created", table_name="invoices")
    op.drop_index("idx_invoices_clinic_status_created", table_name="invoices")
    op.drop_table("invoices")

    op.drop_index("idx_clinic_services_clinic_category", table_name="clinic_services")
    op.drop_index("idx_clinic_services_clinic_active", table_name="clinic_services")
    op.drop_table("clinic_services")

    bind = op.get_bind()
    lab_order_status_enum.drop(bind, checkfirst=True)
    insurance_claim_status_enum.drop(bind, checkfirst=True)
    insurance_policy_status_enum.drop(bind, checkfirst=True)
    payment_status_enum.drop(bind, checkfirst=True)
    invoice_status_enum.drop(bind, checkfirst=True)
    clinic_service_category_enum.drop(bind, checkfirst=True)
