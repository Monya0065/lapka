# Phase 2 M1 Widget Extracts (2026-04-17)

## Purpose

Provide first extract snapshot for M1 dashboard widgets using currently available artifacts.

## Snapshot Metadata

- Snapshot date: 2026-04-17
- Prepared by: Program Manager (working draft)
- Data mode: pre-automation baseline (document-derived)

## M1 Widget Snapshot

### Rollout readiness widgets

| Widget | Value | Source | Freshness | Status |
|---|---|---|---|---|
| Rollout score by chain | not yet numeric | `docs/gtm/CLINIC_CHAIN_ROLLOUT_SCORECARD.md` | current | partial |
| Phase gate completion count | not yet tracked per chain | `docs/runbooks/ENTERPRISE_ONBOARDING_RUNBOOK.md` | current | gap |
| Top blocker aging | blocker list exists in Q2 notes | `docs/Q2_REVIEW_MEETING_NOTES_2026_04_17.md` | current | partial |

### KPI ownership widgets

| Widget | Value | Source | Freshness | Status |
|---|---|---|---|---|
| On-target/off-target split | not yet generated weekly | `docs/KPI_OWNERSHIP_MATRIX.md` | current | partial |
| Ownerless/escalated KPI count | ownerless: 0 (matrix complete by role) | `docs/KPI_OWNERSHIP_MATRIX.md` | current | partial |
| Deputy takeover count | no event feed | none | n/a | gap |

## Data Gap Register (M1 focus)

1. Missing machine-readable rollout score records by chain.
2. Missing structured phase gate state dataset.
3. Missing blocker log with timestamps and ownership.
4. Missing weekly KPI status feed and deputy takeover events.

## Next Extract Update

- Target date: 2026-04-24 (mid-sprint)
- Required inputs:
  - normalized rollout schema records
  - first KPI weekly status sheet
  - blocker log v1 with aging fields

## Related Documents

- `docs/PHASE2_ROLLOUT_DATA_SCHEMA_V1.md`
- `docs/M1_SPRINT_BOARD_2026_04_17.md`
