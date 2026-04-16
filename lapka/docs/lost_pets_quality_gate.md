# Lost Pets Quality Gate

This document defines the operational quality gate for the `Lost Pets` contour.

## Purpose

Gate blocks unsafe regressions in the Lost Pets module before merge or release by enforcing a deterministic smoke flow over backend runtime, migrations, and target integration checks.

## Gate Entry Points

- Local quick run:
  - `make lost-pets-verify`
- Local run with artifacts:
  - `make lost-pets-verify-report`
- CI workflow:
  - `.github/workflows/lost-pets-smoke.yml`

## Pass Criteria

Gate is `PASS` only if all steps below are green:

1. `build_stack`
   - `docker compose up --build -d` succeeds.
2. `wait_health`
   - `GET /health` returns HTTP 200 in timeout window.
3. `swagger_check`
   - `GET /docs` returns HTTP 200.
4. `migrate_db`
   - `alembic upgrade head` succeeds in `api` container.
5. `public_lost_pets_endpoint`
   - `GET /api/v1/lost-pets?include_found=true` returns HTTP 200.
6. `targeted_growth_tests`
   - `pytest -q tests/test_growth_loops.py -k "lost_pet or hotspot or ads_budget or abuse_report"` passes.

If any step fails, gate status is `FAIL`.

## Artifacts

When `REPORT_PATH` / `SUMMARY_PATH` are provided:

- JSON machine-readable report:
  - `artifacts/lost-pets-smoke-report.json`
- Markdown human-readable summary:
  - `artifacts/lost-pets-smoke-summary.md`

CI uploads both as workflow artifacts and posts a sticky PR comment (updated in place) with latest summary.

## PR Signal

For pull requests, workflow updates one sticky comment with marker:

- `<!-- lost-pets-smoke-summary -->`

This avoids noisy duplicate comments and keeps one canonical smoke result per PR.

## PR Governance

Repository also enforces a PR governance check for Lost Pets scope:

- Workflow: `.github/workflows/lost-pets-governance.yml`
- Trigger: pull requests (`opened`, `edited`, `synchronize`, `reopened`)
- Mechanism:
  - detects Lost Pets-related file changes by path filter
  - requires checked items in PR body checklist (`.github/pull_request_template.md`)

If Lost Pets files are changed and checklist is incomplete, governance check fails.

## Code Ownership and Merge Blocking

- CODEOWNERS file: `.github/CODEOWNERS`
- Branch protection runbook: `docs/lost_pets_branch_protection.md`

To make the gate truly merge-blocking, enable required status checks and required Code Owner review for `main`.

## Release Control Pack

For pre-release control, use:

- Release checklist doc: `docs/lost_pets_release_gate.md`
- Release issue template: `.github/ISSUE_TEMPLATE/lost-pets-release-gate.yml`
- Structure validation workflow: `.github/workflows/lost-pets-release-gate-docs.yml`
- Manual operational run workflow: `.github/workflows/lost-pets-release-gate-run.yml`
- Automatic issue state workflow: `.github/workflows/lost-pets-release-gate-status.yml`
- Daily watchdog workflow: `.github/workflows/lost-pets-release-gate-watchdog.yml`
- Metrics workflow: `.github/workflows/lost-pets-release-gate-metrics.yml`
- Governance summary workflow: `.github/workflows/lost-pets-governance-summary.yml`
- Governance self-check workflow: `.github/workflows/lost-pets-governance-self-check.yml`
- Governance contract source: `.github/lost-pets-governance-contract.json`
- Governance contract report artifacts:
  - `artifacts/lost-pets-governance-contract-report.json`
  - `artifacts/lost-pets-governance-contract-report.md`
- Governance self-check PR sticky comment marker:
  - `<!-- lost-pets-governance-self-check -->`
- Governance digest self-check history marker:
  - `<!-- lost-pets-self-check-health -->`
- Governance digest self-check impact snapshot marker:
  - `<!-- lost-pets-self-check-impact -->`
- Governance digest self-check impact history marker:
  - `<!-- lost-pets-self-check-impact-history -->`
- Governance digest self-check impact trend alert marker:
  - `<!-- lost-pets-self-check-impact-alert -->`
- Governance digest self-check recovery marker:
  - `<!-- lost-pets-self-check-recovery -->`
- Governance digest self-check escalation marker:
  - `<!-- lost-pets-self-check-escalation -->`
- Governance summary includes risk signal: `GREEN` / `YELLOW` / `RED`
- Governance summary includes recommended actions based on risk level
- Governance summary includes owner-routing hints (release/security/legal/backend)
- Governance summary includes SLA breach counters and chronic issue prioritization
- Governance summary includes weekly remediation digest (top-3 chronic issues)
- Governance digest issue includes sticky weekly remediation plan comment
- Governance summary includes weekly remediation effectiveness metrics
- Governance summary includes weekly scorecard grade (`A`/`B`/`C`/`D`)
- Governance digest issue includes weekly grade history (last 4 weeks)
- Governance digest raises degradation alert on 2+ week declining grade trend
- Governance digest confirms recovery on 2+ week improving grade trend
- Governance digest enters incident mode on combined anomaly condition
- Governance digest auto-publishes incident exit report after stable runs
- Governance digest includes incident lifecycle KPI (incidents/month, MTTR, active duration)
- Governance digest includes incident lifecycle SLO status (`SLO OK` / `SLO BREACH`)
- Governance digest enforces SLO action plan on 2+ consecutive breach runs
- Governance digest tracks SLO ownership acknowledgements (owner/security/ETA)
- Governance digest escalates if acknowledgements are missing for 2+ runs
- Governance self-check fails CI if required sticky markers or doc references drift
- Governance self-check also validates release-gate issue template and workflow/body label contract
- Governance self-check validates critical release checklist sections and checkbox coverage
- Governance self-check reads machine-readable requirements from the governance contract file
- Governance self-check uploads drift reports even on failure for faster triage
- Governance self-check updates one sticky PR comment with current contract drift summary
- Governance digest tracks self-check failure streak and recent history
- Governance digest escalates self-check failures after 2+ consecutive runs
- Governance self-check classifies drift impact (`low`/`medium`/`high`/`critical`) and routing
- Governance self-check PR summary includes impact-aware routing banner
- Governance digest self-check escalation reuses latest synced impact snapshot
- Governance digest tracks self-check impact trend and worsening streak
- Governance digest raises a dedicated alert when self-check impact worsens for 2+ cycles
- Governance summary risk rollup now includes latest self-check impact severity
- Governance weekly scorecard now degrades when self-check impact severity increases
- Governance weekly grade history now records self-check impact contribution
- Governance degradation/recovery alerts now explain when self-check drives the grade shift
- Governance incident mode now treats severe self-check degradation as an anomaly amplifier
- Governance incident exit is blocked while self-check remains in a severe or worsening state
- Governance digest publishes a dedicated self-check recovery signal after stabilization
- Governance overall recovery confirmation now requires self-check recovery, not only grade improvement
- Governance incident lifecycle KPI now closes recovery only after self-check stabilization
- Governance SLO monitor flags `recovery_blocked_by_self_check` when closure is delayed by self-check
- Governance SLO action plan now applies targeted routing when breach is blocked by self-check recovery
- Governance SLO acknowledgements expand to include backend/platform contract-path confirmation when blocked
- Governance SLO ack escalation switches to self-check-blocked routing mode when applicable
- Governance SLO ack escalation now also manages digest labels for fast triage routing
- Governance SLO ack escalation now publishes a dedicated SLA timer (24h/48h) with owner routing
- Governance SLO ack SLA now tracks breach streaks and marks chronic delays for repeated overruns
- Governance main summary now includes an SLO ack escalation digest block (status/mode/age/streak/labels)
- Governance SLO ack digest now prints status-based recommended next actions
- Governance risk signal and weekly grade now include ack escalation severity uplift
- Governance incident mode now treats critical ack escalation as an anomaly amplifier
- Governance incident exit is blocked while ack escalation remains in critical state
- Incident lifecycle KPI and SLO breach reasoning now explicitly include ack-escalation-based recovery blocking
- Trend summary now tracks ack-SLA warning/critical event counts and average escalation age for 7d/30d windows
- Governance digest now raises an ack-age trend alert when 7d average escalation age worsens for 2+ cycles
- Top-level risk reasons/action hints now automatically include sustained ack-age worsening
- Weekly grade history now includes ack status/trend columns and ack-age contribution signals
- Incident/recovery messaging now includes ack-age contribution snapshots for anomaly/exit/recovery context
- Incident exit postmortem now requires explicit ack-age contribution capture
- Incident exit monitoring now validates ack-age postmortem field completeness

## Failure Triage Runbook

1. Open the failing step in the workflow log.
2. Download smoke artifacts and inspect:
   - `status`
   - `failed_step`
   - per-step durations (possible timeout regressions)
3. Reproduce locally:
   - `make lost-pets-verify-report`
4. If `migrate_db` fails:
   - verify latest migration revision chain and rerun `alembic upgrade head`.
5. If `targeted_growth_tests` fails:
   - run exact pytest command from gate and inspect impacted endpoint/domain change.
6. Re-run workflow after fix and confirm sticky PR comment updates to `passed`.

## Security Notes

- Gate includes migration and endpoint smoke checks to reduce risk of runtime drift.
- Do not skip gate for changes touching:
  - lost pets endpoints/models/migrations
  - moderation/abuse flow
  - promotion payment and ads budget logic
  - hotspot notification delivery logic
