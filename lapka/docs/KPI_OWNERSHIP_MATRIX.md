# KPI Ownership Matrix

## Purpose

Assign accountable owners and escalation deputies to core PMF, growth, enterprise, and moat KPIs.

## Ownership Rules

- `Accountable Owner` is responsible for target achievement and corrective actions.
- `Deputy` acts when owner is unavailable and co-owns escalation execution.
- Every KPI must have:
  - source definition,
  - refresh cadence,
  - dashboard/report destination.

## Matrix

| KPI | Formula/Definition | Accountable Owner | Deputy | Cadence | Escalation Trigger |
|---|---|---|---|---|---|
| Demo to Pilot Conversion | pilots / demos | Head of Growth | CS Lead | weekly | 2-week decline vs target |
| Pilot to Paid Conversion | paid clinics / pilots | Head of Growth | Product Lead | weekly | below threshold 2 cycles |
| ARPA | MRR / active paid clinics | Finance Ops Lead | Head of Growth | monthly | >10% drop QoQ |
| NRR | net retained expansion ratio | Revenue Ops Lead | Finance Ops Lead | monthly | below target quarter |
| No-show rate | no_show / scheduled | CS Ops Lead | Clinic Success Lead | weekly | +10% adverse delta |
| Visit closure cycle time | avg(finalized_at - started_at) | Product Lead | Clinical Ops Lead | weekly | >15% slower baseline |
| Branch utilization | completed_visits / available_slots | Clinic Success Lead | Product Lead | weekly | below baseline 2 cycles |
| Protocol completeness | complete_protocol_visits / finalized_visits | Clinical Ops Lead | Product Lead | weekly | below target 2 cycles |
| SLA breach rate | breached incidents / total incidents | Support Lead | Engineering On-call Lead | weekly | breach streak > 1 cycle |
| MTTA | mean time to acknowledge incidents | Support Lead | Platform Ops Lead | weekly | exceeds SLA tier |
| MTTR | mean time to recover incidents | Engineering On-call Lead | Support Lead | weekly | exceeds SLA tier |
| Critical eval pass rate | must-pass AI safety scenarios | AI Lead | Platform Security Lead | weekly | < required threshold |
| Policy leakage rate | unsafe owner outputs / owner AI outputs | Platform Security Lead | AI Lead | weekly | any non-zero critical leak |
| Moat improvement velocity | median issue->validated fix time | AI Lead | Product Lead | monthly | > target for 2 cycles |

## Escalation Ladder

1. Owner -> Deputy (same cycle)
2. Owner/Deputy -> Functional lead (next cycle if unresolved)
3. Functional lead -> Executive review (2+ missed cycles)

## Review Rhythm

- Weekly: operational KPIs (growth, usage, SLA, AI safety)
- Monthly: financial and retention KPIs
- Quarterly: moat and enterprise proof KPIs

## Related Documents

- `docs/metrics/REVENUE_ENGINE_KPI_SPEC.md`
- `docs/metrics/RETENTION_LOOP_SPEC.md`
- `docs/metrics/OUTCOME_METRICS_TREE.md`
- `docs/EXECUTION_CALENDAR_RITUALS_AND_OWNERS.md`
