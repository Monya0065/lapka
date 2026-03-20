"""ai control plane"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "020_ai_control_plane"
down_revision: Union[str, None] = "019_add_phone_to_places"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("provider_type", sa.String(length=64), nullable=False, server_default="remote"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("routing_summary", sa.Text(), nullable=True),
        sa.Column("capabilities_json", sa.JSON(), nullable=False),
        sa.Column("default_model_key", sa.String(length=128), nullable=True),
        sa.Column("fallback_model_key", sa.String(length=128), nullable=True),
        sa.Column("is_local", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_ai_providers_slug"),
    )
    op.create_index("idx_ai_providers_status", "ai_providers", ["status"])

    op.create_table(
        "ai_models",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("provider_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("model_key", sa.String(length=128), nullable=False),
        sa.Column("display_name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="active"),
        sa.Column("context_window", sa.Integer(), nullable=True),
        sa.Column("supports_json_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("supports_vision", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("supports_audio", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_fallback", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["provider_id"], ["ai_providers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_id", "model_key", name="uq_ai_models_provider_model"),
    )
    op.create_index("idx_ai_models_provider_status", "ai_models", ["provider_id", "status"])

    op.create_table(
        "ai_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("role_scope", sa.String(length=32), nullable=True),
        sa.Column("guardrails_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_ai_policies_slug"),
    )

    op.create_table(
        "ai_routes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("scenario_key", sa.String(length=64), nullable=False),
        sa.Column("scenario_name", sa.String(length=255), nullable=False),
        sa.Column("role_scope", sa.String(length=32), nullable=True),
        sa.Column("primary_provider_slug", sa.String(length=64), nullable=False),
        sa.Column("primary_model_key", sa.String(length=128), nullable=False),
        sa.Column("fallback_provider_slug", sa.String(length=64), nullable=True),
        sa.Column("fallback_model_key", sa.String(length=128), nullable=True),
        sa.Column("policy_slug", sa.String(length=64), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_ai_routes_slug"),
        sa.UniqueConstraint("scenario_key", name="uq_ai_routes_scenario_key"),
    )
    op.create_index("idx_ai_routes_role_scope", "ai_routes", ["role_scope"])

    op.create_table(
        "ai_prompts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("route_slug", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_ai_prompts_slug"),
    )

    op.create_table(
        "ai_prompt_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("prompt_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("system_prompt", sa.Text(), nullable=False),
        sa.Column("template_json", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["prompt_id"], ["ai_prompts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("prompt_id", "version_number", name="uq_ai_prompt_versions_prompt_version"),
    )
    op.create_index("idx_ai_prompt_versions_prompt_active", "ai_prompt_versions", ["prompt_id", "is_active"])

    op.create_table(
        "ai_limits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_key", sa.String(length=128), nullable=True),
        sa.Column("max_owner_requests_per_hour", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_vet_requests_per_hour", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("prompt_audit", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("pii_redaction", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("fallback_mode", sa.String(length=64), nullable=False, server_default="strict"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scope_type", "scope_key", name="uq_ai_limits_scope"),
    )

    op.create_table(
        "ai_budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_type", sa.String(length=32), nullable=False),
        sa.Column("scope_key", sa.String(length=128), nullable=True),
        sa.Column("monthly_budget", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("hard_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=16), nullable=False, server_default="USD"),
        sa.Column("current_spend", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("scope_type", "scope_key", name="uq_ai_budgets_scope"),
    )

    op.create_table(
        "ai_tenant_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tenant_key", sa.String(length=128), nullable=False),
        sa.Column("route_slug", sa.String(length=64), nullable=True),
        sa.Column("provider_slug", sa.String(length=64), nullable=True),
        sa.Column("model_key", sa.String(length=128), nullable=True),
        sa.Column("mode_label", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_tenant_overrides_tenant", "ai_tenant_overrides", ["tenant_key"])

    op.create_table(
        "ai_clinic_overrides",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("route_slug", sa.String(length=64), nullable=True),
        sa.Column("provider_slug", sa.String(length=64), nullable=True),
        sa.Column("model_key", sa.String(length=128), nullable=True),
        sa.Column("mode_label", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_clinic_overrides_clinic", "ai_clinic_overrides", ["clinic_id"])

    op.create_table(
        "ai_role_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("policy_slug", sa.String(length=64), nullable=True),
        sa.Column("route_slug", sa.String(length=64), nullable=True),
        sa.Column("provider_slug", sa.String(length=64), nullable=True),
        sa.Column("mode_label", sa.String(length=255), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_role_policies_role", "ai_role_policies", ["role"])

    op.create_table(
        "ai_usage_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("clinic_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("route_slug", sa.String(length=64), nullable=True),
        sa.Column("provider_slug", sa.String(length=64), nullable=True),
        sa.Column("model_key", sa.String(length=128), nullable=True),
        sa.Column("role_scope", sa.String(length=32), nullable=True),
        sa.Column("request_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("estimated_cost", sa.Float(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ok"),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["clinic_id"], ["clinics.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_usage_logs_route_created_at", "ai_usage_logs", ["route_slug", "created_at"])
    op.create_index("idx_ai_usage_logs_clinic_created_at", "ai_usage_logs", ["clinic_id", "created_at"])
    op.create_index("idx_ai_usage_logs_actor_created_at", "ai_usage_logs", ["actor_user_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_ai_usage_logs_actor_created_at", table_name="ai_usage_logs")
    op.drop_index("idx_ai_usage_logs_clinic_created_at", table_name="ai_usage_logs")
    op.drop_index("idx_ai_usage_logs_route_created_at", table_name="ai_usage_logs")
    op.drop_table("ai_usage_logs")
    op.drop_index("idx_ai_role_policies_role", table_name="ai_role_policies")
    op.drop_table("ai_role_policies")
    op.drop_index("idx_ai_clinic_overrides_clinic", table_name="ai_clinic_overrides")
    op.drop_table("ai_clinic_overrides")
    op.drop_index("idx_ai_tenant_overrides_tenant", table_name="ai_tenant_overrides")
    op.drop_table("ai_tenant_overrides")
    op.drop_table("ai_budgets")
    op.drop_table("ai_limits")
    op.drop_index("idx_ai_prompt_versions_prompt_active", table_name="ai_prompt_versions")
    op.drop_table("ai_prompt_versions")
    op.drop_table("ai_prompts")
    op.drop_index("idx_ai_routes_role_scope", table_name="ai_routes")
    op.drop_table("ai_routes")
    op.drop_table("ai_policies")
    op.drop_index("idx_ai_models_provider_status", table_name="ai_models")
    op.drop_table("ai_models")
    op.drop_index("idx_ai_providers_status", table_name="ai_providers")
    op.drop_table("ai_providers")
