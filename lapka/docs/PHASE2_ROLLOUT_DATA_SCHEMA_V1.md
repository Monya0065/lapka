# Phase 2 Rollout Data Schema v1

## Purpose

Define a normalized schema for M1 rollout widgets:

- rollout score by chain
- phase gate completion
- blocker aging

## Entities

### 1) `rollout_chain_status`

| Field | Type | Required | Notes |
|---|---|---|---|
| `chain_id` | string | yes | unique rollout chain identifier |
| `chain_name` | string | yes | human-readable chain name |
| `score` | integer | yes | range 0..100 |
| `status` | enum | yes | `green` / `yellow` / `red` |
| `review_date` | date | yes | snapshot date |
| `owner_role` | string | yes | primary owner role |
| `updated_at` | datetime | yes | freshness checkpoint |

Validation:

- `score` must be within 0..100
- `status` must match score band policy from readiness spec

### 2) `rollout_phase_gate`

| Field | Type | Required | Notes |
|---|---|---|---|
| `chain_id` | string | yes | foreign key to chain status |
| `phase_name` | enum | yes | `pre_kickoff`/`tech_readiness`/`branch_activation`/`stabilization`/`expansion` |
| `phase_state` | enum | yes | `not_started`/`in_progress`/`passed`/`blocked` |
| `owner_role` | string | yes | gate owner |
| `updated_at` | datetime | yes | freshness checkpoint |

Validation:

- one row per (`chain_id`, `phase_name`)
- `phase_state` must be from allowed enum

### 3) `rollout_blocker_log`

| Field | Type | Required | Notes |
|---|---|---|---|
| `blocker_id` | string | yes | unique blocker id |
| `chain_id` | string | yes | affected chain |
| `title` | string | yes | short blocker title |
| `severity` | enum | yes | `low`/`medium`/`high`/`critical` |
| `owner_role` | string | yes | blocker owner |
| `created_at` | datetime | yes | used for aging |
| `resolved_at` | datetime | no | null if open |
| `status` | enum | yes | `open`/`resolved` |
| `source` | string | yes | review/incident/legal/etc |

Derived field:

- `age_days = today - created_at` when `status = open`

Validation:

- open blocker must have null `resolved_at`
- resolved blocker must have `resolved_at >= created_at`

## Weekly Export Contract (M1)

Export name: `phase2_rollout_weekly_snapshot`

Columns:

- chain-level: `chain_id`, `chain_name`, `score`, `status`, `updated_at`
- gate-level aggregate: `gates_total`, `gates_passed`, `gates_blocked`
- blocker-level aggregate: `open_blockers`, `critical_open_blockers`, `max_blocker_age_days`

Freshness SLA:

- snapshot generated weekly (<= 7 days)

Quality checks:

1. every chain row has non-null `chain_id`, `score`, `status`
2. score/status consistency check passes
3. blocker aggregate matches source blocker rows

## Related Documents

- `docs/M1_SPRINT_BOARD_2026_04_17.md`
- `docs/PHASE2_WIDGET_DATA_CONTRACTS.md`
- `docs/PHASE2_WIDGET_DATA_CONTRACTS_INITIAL_VALUES_2026_04_17.md`
