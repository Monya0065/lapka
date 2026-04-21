# M1 Sprint Board (2026-04-17 to 2026-05-01)

## Sprint Header

- Sprint name: Phase 2 M1 Baseline Operations
- Start date: 2026-04-17
- End date: 2026-05-01
- Sprint owner: Product Lead
- Review date: 2026-05-01

## Capacity

| Team | Available points/hours | Reserved for incidents | Net delivery capacity |
|---|---:|---:|---:|
| Product | 40h | 8h | 32h |
| Engineering | 80h | 16h | 64h |
| QA | 30h | 6h | 24h |
| Security/Ops | 24h | 6h | 18h |

## Epic-to-Task Breakdown

| Task ID | Epic | Task | Owner | Deputy | Estimate | Priority | Dependency | Acceptance Test | Status |
|---|---|---|---|---|---:|---|---|---|---|
| M1-A1 | A | Define chain rollout score operational schema and status enum | Product Lead | Program Manager | 8h | P0 | scorecard spec | Given score payload, when validated, then status and score persist with valid enum/range | done |
| M1-A2 | A | Add blocker aging fields and weekly export contract | Analytics Lead | Program Manager | 12h | P0 | A1 | Given blocker record, when exported weekly, then age_days/owner/created_at are present | done |
| M1-A3 | A | Add phase-gate completion counters for onboarding flow | Engineering Lead | Product Lead | 10h | P0 | A1 | Given chain phase states, when aggregated, then completion counts match source | done |
| M1-B1 | B | Finalize owner/deputy assignment for all KPI rows | Head of Growth | Product Lead | 6h | P0 | KPI matrix | Given KPI matrix, when reviewed, then no blank owner/deputy rows remain | done |
| M1-B2 | B | Define escalation contact mapping for KPI misses | Program Manager | Head of Growth | 8h | P0 | B1 | Given off-target KPI, when escalation triggered, then mapped owner/deputy contacts resolve | done |
| M1-B3 | B | Publish weekly KPI status sheet format and first sample | Head of Growth | Analytics Lead | 10h | P0 | B1, B2 | Given weekly update cycle, when sheet generated, then on/off-target split is visible and auditable | done |
| M1-QA1 | A+B | QA checks for schema/range/completeness rules | QA Lead | Engineering Lead | 8h | P0 | A1..B3 | Given M1 datasets, when QA checks run, then all critical validation checks pass | done |
| M1-OPS1 | A+B | Review stale/invalid fallback rules for M1 widgets | Platform Ops Lead | Support Lead | 6h | P1 | widget contract doc | Given stale/invalid sample, when evaluated, then readiness fallback state becomes Watch | done |

## Acceptance Test Details

### M1-A1

1. Given rollout score records from two chains  
2. When schema validation runs  
3. Then `score` is within 0..100 and `status` is one of `green/yellow/red`.

Evidence:

- schema snapshot + validation output
- `docs/PHASE2_ROLLOUT_DATA_SCHEMA_V1.md`

### M1-B1

1. Given KPI ownership matrix draft  
2. When ownership completeness check runs  
3. Then every KPI row has both `Accountable Owner` and `Deputy`.

Evidence:

- signed matrix diff
- `docs/KPI_OWNERSHIP_MATRIX.md`

### Evidence links (current)

- `docs/PHASE2_ROLLOUT_DATA_SCHEMA_V1.md`
- `docs/PHASE2_M1_WIDGET_EXTRACTS_2026_04_17.md`
- `docs/PHASE2_WIDGET_DATA_CONTRACTS_INITIAL_VALUES_2026_04_17.md`
- `docs/PHASE2_PHASE_GATE_COUNTERS_BASELINE_2026_04_17.md`
- `docs/KPI_ESCALATION_CONTACT_MAPPING_V1.md`
- `docs/KPI_WEEKLY_STATUS_SHEET_SAMPLE_2026_04_17.md`
- `docs/KPI_OWNERSHIP_COMPLETENESS_CHECK_2026_04_17.md`
- `docs/M1_QA_VALIDATION_REPORT_2026_04_17.md`
- `docs/PHASE2_WIDGET_FALLBACK_VALIDATION_2026_04_17.md`

## Sprint Risk Board

| Risk | Impact | Likelihood | Owner | Mitigation | Trigger to escalate |
|---|---|---|---|---|---|
| Owner assignment delays for KPI rows | high | medium | Head of Growth | pre-schedule owner signoff session | >3 business days slip on B1 |
| Data model mismatch across source docs | medium | medium | Product Lead | freeze M1 schema and version it | QA failure on A1/A2 |
| Incident noise consumes capacity | medium | medium | Program Manager | enforce reserved capacity and scope control | >50% reserve usage in week 1 |

## Mid-Sprint Checkpoint

- Date: 2026-04-24
- Completed tasks: M1-A1, M1-A2, M1-A3, M1-B1, M1-B2, M1-B3, M1-QA1, M1-OPS1
- Slipped tasks:
- Scope change decisions:
- Escalations:

## Sprint Exit

Exit conditions:

- all P0 tasks are `done`
- all `done` tasks have evidence links
- unresolved P1 carry-over has owner and rationale

## Related Documents

- `docs/PHASE2_IMPLEMENTATION_BACKLOG.md`
- `docs/PHASE2_DASHBOARD_ROLLOUT_PLAN.md`
- `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
