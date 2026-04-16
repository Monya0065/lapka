"""clinic kpi targets in scheduler settings

Revision ID: 032_clinic_kpi_targets
Revises: 031_pharm_procure
Create Date: 2026-04-14 21:10:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "032_clinic_kpi_targets"
down_revision: Union[str, None] = "031_pharm_procure"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "clinic_scheduler_settings",
        sa.Column("kpi_daily_patients_target", sa.Integer(), nullable=False, server_default="20"),
    )
    op.add_column(
        "clinic_scheduler_settings",
        sa.Column("kpi_monthly_revenue_target_cents", sa.BigInteger(), nullable=False, server_default="5000000"),
    )
    op.add_column(
        "clinic_scheduler_settings",
        sa.Column("kpi_max_wait_over_15_target", sa.Integer(), nullable=False, server_default="5"),
    )
    op.create_check_constraint(
        "ck_scheduler_kpi_daily_patients_target",
        "clinic_scheduler_settings",
        "kpi_daily_patients_target >= 1 AND kpi_daily_patients_target <= 1000",
    )
    op.create_check_constraint(
        "ck_scheduler_kpi_monthly_revenue_target_cents",
        "clinic_scheduler_settings",
        "kpi_monthly_revenue_target_cents >= 0",
    )
    op.create_check_constraint(
        "ck_scheduler_kpi_max_wait_over_15_target",
        "clinic_scheduler_settings",
        "kpi_max_wait_over_15_target >= 0 AND kpi_max_wait_over_15_target <= 500",
    )
    op.alter_column("clinic_scheduler_settings", "kpi_daily_patients_target", server_default=None)
    op.alter_column("clinic_scheduler_settings", "kpi_monthly_revenue_target_cents", server_default=None)
    op.alter_column("clinic_scheduler_settings", "kpi_max_wait_over_15_target", server_default=None)


def downgrade() -> None:
    op.drop_constraint("ck_scheduler_kpi_max_wait_over_15_target", "clinic_scheduler_settings", type_="check")
    op.drop_constraint("ck_scheduler_kpi_monthly_revenue_target_cents", "clinic_scheduler_settings", type_="check")
    op.drop_constraint("ck_scheduler_kpi_daily_patients_target", "clinic_scheduler_settings", type_="check")
    op.drop_column("clinic_scheduler_settings", "kpi_max_wait_over_15_target")
    op.drop_column("clinic_scheduler_settings", "kpi_monthly_revenue_target_cents")
    op.drop_column("clinic_scheduler_settings", "kpi_daily_patients_target")
