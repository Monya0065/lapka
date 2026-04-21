# Incident Taxonomy v1

Date: 2026-04-17
Owner: Engineering On-call Lead  
Deputy: Support Lead

## Purpose

Standardize repeated incident class tracking for Phase 2 support/SLA stability widgets.

## Incident Classes

| Class ID | Class Name | Definition | Example Signals | Primary Owner |
|---|---|---|---|---|
| IC-01 | Deployment Regression | Incident introduced by release/config change | spike after deploy, rollback required | Engineering On-call Lead |
| IC-02 | Data Freshness Delay | KPI/widget data older than SLA | stale extract, missing daily refresh | Analytics Lead |
| IC-03 | Integration Failure | External connector or mapping failure | API timeout, schema mismatch, auth failure | Integration Lead |
| IC-04 | Identity/Access Failure | SSO/SAML/authz failure impacting access | login loop, token validation fail, role mismatch | Platform Security Lead |
| IC-05 | Performance Degradation | Significant latency/error rise without full outage | p95 latency breach, queue backlog | Platform Ops Lead |
| IC-06 | Manual Ops Gap | Process gap or runbook miss causes customer impact | missed escalation, checklist skipped | Program Manager |

## Severity and Repetition Rules

- Severity uses runbook levels Sev-1..Sev-4 from `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`.
- Repeated incident class metric counts incidents by `Class ID` in rolling 28 days.
- Alert trigger: any class with 3+ incidents in 28 days -> status `Watch`.
- Critical trigger: any class with 2+ Sev-1 incidents in 28 days -> status `Critical`.

## Required Tracking Fields

- `incident_id`
- `opened_at`
- `resolved_at`
- `severity`
- `class_id`
- `service_area`
- `customer_impact`
- `root_cause_summary`
- `preventive_action_owner`

## Governance

- Weekly review: Support + Engineering on-call inspect top repeated classes.
- Monthly review: Product + Ops validate taxonomy drift and add/merge classes if needed.

## Related Documents

- `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`
- `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
- `docs/Q2_REVIEW_MEETING_NOTES_2026_04_17.md`
