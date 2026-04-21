from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from src.api.routes import analytics as analytics_module
from src.api.routes.analytics import (
    OwnerFunnelPlaybookExportRiskOut,
    OwnerFunnelSystemTaskSlaLifecycleOut,
    escalate_owner_funnel_playbook_export_risk,
    escalate_owner_funnel_system_tasks_sla_latency_risk,
    get_owner_funnel_system_tasks_sla_lifecycle,
)


class _FakeScalarsResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


@dataclass
class _FakeDbSession:
    scalar_responses: list[object] = field(default_factory=list)
    scalars_responses: list[list[object]] = field(default_factory=list)
    added: list[object] = field(default_factory=list)
    commits: int = 0

    async def scalar(self, _stmt):
        if self.scalar_responses:
            return self.scalar_responses.pop(0)
        return None

    async def scalars(self, _stmt):
        rows = self.scalars_responses.pop(0) if self.scalars_responses else []
        return _FakeScalarsResult(rows)

    def add(self, row):
        self.added.append(row)

    async def commit(self):
        self.commits += 1


def _event(
    *,
    target_type: str,
    action: str,
    target_id: str,
    created_at: datetime,
    actor_user_id: str = "u1",
    metadata_json: dict | None = None,
):
    return SimpleNamespace(
        target_type=target_type,
        action=action,
        target_id=target_id,
        created_at=created_at,
        actor_user_id=actor_user_id,
        metadata_json=metadata_json or {},
    )


@pytest.mark.asyncio
async def test_export_risk_escalation_not_high(monkeypatch):
    fake_db = _FakeDbSession()
    current_user = SimpleNamespace(id="admin-1", full_name="Admin", email="admin@lapka.local")

    async def _fake_get_risk(*_args, **_kwargs):
        return OwnerFunnelPlaybookExportRiskOut(
            period_days=14,
            total_exports=3,
            management_exports=1,
            overdue_only_exports=0,
            unique_exporters=2,
            management_share_pct=33.3,
            overdue_share_pct=0.0,
            risk_level="low",
            risk_reasons=[],
        )

    monkeypatch.setattr(analytics_module, "get_owner_funnel_playbook_export_risk", _fake_get_risk)
    result = await escalate_owner_funnel_playbook_export_risk(
        period_days=14,
        db=fake_db,
        current_user=current_user,
    )
    assert result.created is False
    assert result.reason == "risk_not_high"
    assert not fake_db.added


@pytest.mark.asyncio
async def test_latency_risk_escalation_creates_system_task(monkeypatch):
    fake_db = _FakeDbSession(scalar_responses=[None])
    current_user = SimpleNamespace(id="admin-1", full_name="Admin", email="admin@lapka.local")

    async def _fake_lifecycle(*_args, **_kwargs):
        return OwnerFunnelSystemTaskSlaLifecycleOut(
            period_days=30,
            total_feedback_events=5,
            active_count=3,
            acked_count=1,
            snoozed_count=1,
            restored_events=0,
            active_delta_vs_prev=2,
            acked_delta_vs_prev=0,
            snoozed_delta_vs_prev=1,
            restored_delta_vs_prev=0,
            alert_cta_clicks=2,
            alert_response_rate_pct=50.0,
            alert_response_by_level=[],
            alert_follow_up_by_level=[],
            alert_follow_up_latency_by_level=[],
            latency_risk_level="high",
            latency_risk_reason="critical follow-up p90 is 7.0h (>6h)",
            latency_auto_action="Assign on-call owner",
        )

    monkeypatch.setattr(analytics_module, "get_owner_funnel_system_tasks_sla_lifecycle", _fake_lifecycle)
    result = await escalate_owner_funnel_system_tasks_sla_latency_risk(
        period_days=30,
        db=fake_db,
        current_user=current_user,
    )
    assert result.created is True
    assert result.source == "export_latency_oncall_review"
    assert fake_db.commits == 1
    assert len(fake_db.added) == 1
    assert fake_db.added[0].target_id == "export_latency_oncall_review"


@pytest.mark.asyncio
async def test_sla_lifecycle_returns_followup_and_latency_metrics():
    now = datetime.now(timezone.utc)
    # Current window feedback events (current state: one acked source).
    current_feedback = [
        _event(
            target_type="owner_funnel_sla_recommendation",
            action="owner_funnel.sla_recommendation_feedback",
            target_id="export_security_review",
            created_at=now - timedelta(hours=12),
            metadata_json={"action": "ack"},
        ),
    ]
    prev_feedback = []
    clicks = [
        _event(
            target_type="owner_funnel_sla_alert",
            action="owner_funnel.sla_alert_cta_click",
            target_id="review_top_risky_sources",
            created_at=now - timedelta(hours=23),
            metadata_json={"level": "critical"},
            actor_user_id="u1",
        )
    ]
    followups = [
        _event(
            target_type="owner_funnel_sla_recommendation",
            action="owner_funnel.sla_recommendation_feedback",
            target_id="export_security_review",
            created_at=now - timedelta(hours=15),
            metadata_json={"action": "ack"},
            actor_user_id="u1",
        )
    ]
    fake_db = _FakeDbSession(
        scalars_responses=[current_feedback, prev_feedback, clicks, followups]
    )
    current_user = SimpleNamespace(id="admin-1", full_name="Admin", email="admin@lapka.local")

    result = await get_owner_funnel_system_tasks_sla_lifecycle(
        period_days=30,
        db=fake_db,
        current_user=current_user,
    )
    assert result.alert_cta_clicks == 1
    critical_response = next(item for item in result.alert_response_by_level if item["level"] == "critical")
    assert critical_response["clicks"] == 1
    critical_followup = next(item for item in result.alert_follow_up_by_level if item["level"] == "critical")
    assert critical_followup["follow_up_clicks_24h"] == 1
    assert critical_followup["ack_follow_up_24h"] == 1
    assert critical_followup["done_follow_up_24h"] == 0
    critical_latency = next(item for item in result.alert_follow_up_latency_by_level if item["level"] == "critical")
    assert critical_latency["p50_hours"] >= 7.0
    assert result.latency_risk_level in {"high", "medium", "low"}
