# KPI Escalation Contact Mapping v1

## Purpose

Define explicit escalation contacts for KPI misses, satisfying M1-B2 execution requirement.

## Escalation Levels

- L1: Accountable Owner
- L2: Deputy
- L3: Functional Lead
- L4: Executive Escalation

## Mapping Table

| KPI Group | L1 Owner | L2 Deputy | L3 Functional Lead | L4 Executive Escalation |
|---|---|---|---|---|
| Revenue conversion KPIs | Head of Growth | CS Lead | Product Lead | CEO/GM |
| Financial KPIs (ARPA/NRR) | Finance Ops Lead | Revenue Ops Lead | Head of Growth | CFO/CEO |
| Clinic operations KPIs | CS Ops Lead | Clinic Success Lead | Product Lead | COO |
| SLA and support KPIs | Support Lead | Engineering On-call Lead | Platform Ops Lead | CTO/COO |
| AI safety/moat KPIs | AI Lead | Platform Security Lead | Product Lead | CTO |
| Enterprise proof KPIs | Platform Security Lead | CS Lead | Engineering Lead | COO/CTO |

## Trigger Rules

- Trigger L2 if KPI misses target in 1 cycle.
- Trigger L3 if KPI misses target in 2 consecutive cycles.
- Trigger L4 if KPI misses target in 3 consecutive cycles or if severity is critical.

## Communication SLA

- L1 acknowledgment: within 1 business day
- L2 acknowledgment: within 1 business day after escalation
- L3 action plan: within 2 business days
- L4 decision/override: within 3 business days

## Audit Requirements

Each escalation event must record:

- KPI id
- trigger condition
- escalation level
- timestamp
- owner and decision note

## Related Documents

- `docs/KPI_OWNERSHIP_MATRIX.md`
- `docs/SPRINT_TASK_BOARD_TEMPLATE.md`
- `docs/M1_SPRINT_BOARD_2026_04_17.md`
