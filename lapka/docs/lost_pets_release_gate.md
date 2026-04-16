# Lost Pets Release Gate (Pre-Release)

This checklist is a release-control gate for shipping Lost Pets changes safely.

Use together with:

- `docs/lost_pets_quality_gate.md`
- `docs/lost_pets_branch_protection.md`
- `docs/russia_2026_lost_pets_payments_legal.md`
- `.github/workflows/lost-pets-release-gate-run.yml` (manual one-click smoke + release issue update)
- `.github/workflows/lost-pets-release-gate-status.yml` (automatic READY/BLOCKED evaluation + issue close/reopen)
- `.github/workflows/lost-pets-release-gate-watchdog.yml` (daily watchdog for stale BLOCKED gate issues)
- `.github/workflows/lost-pets-release-gate-metrics.yml` (daily KPI snapshot for release-gate process)
- `.github/workflows/lost-pets-governance-summary.yml` (daily aggregated governance dashboard artifact)
- `.github/workflows/lost-pets-governance-self-check.yml` (contract validator for markers and required governance doc references)
- `.github/lost-pets-governance-contract.json` (single source for markers, required checks, and checklist mappings)
- Self-check report artifacts: `artifacts/lost-pets-governance-contract-report.json` and `artifacts/lost-pets-governance-contract-report.md`
- Self-check PR sticky comment marker: `<!-- lost-pets-governance-self-check -->`
- Governance digest self-check history marker: `<!-- lost-pets-self-check-health -->`
- Governance digest self-check impact snapshot marker: `<!-- lost-pets-self-check-impact -->`
- Governance digest self-check impact history marker: `<!-- lost-pets-self-check-impact-history -->`
- Governance digest self-check impact trend alert marker: `<!-- lost-pets-self-check-impact-alert -->`
- Governance digest self-check recovery marker: `<!-- lost-pets-self-check-recovery -->`
- Governance digest self-check escalation marker: `<!-- lost-pets-self-check-escalation -->`
- Self-check drift report includes impact level/class and routing owners
- Self-check PR comment surfaces impact-aware routing for current drift
- Governance summary `GREEN/YELLOW/RED` rollup includes latest self-check impact
- Governance weekly scorecard `A/B/C/D` includes self-check impact severity
- Governance weekly grade history tracks self-check impact contribution
- Governance degradation/recovery alerts reference self-check contribution when relevant
- Governance incident mode also reacts to severe worsening self-check drift
- Governance incident exit requires self-check state to be safe, not only anomaly disappearance
- Governance `Recovery Confirmed` now depends on self-check recovery as well
- Governance incident lifecycle KPI/MTTR also waits for self-check recovery
- Governance SLO breach reasons include `recovery_blocked_by_self_check`
- Governance SLO action plan escalates specifically to release owner + backend/platform for self-check-blocked recovery
- Release-gate issue template contract is auto-validated against run/status/watchdog workflows
- Critical release checklist coverage is auto-validated against the issue template

## Release Candidate Metadata

- Release tag/version:
- Planned rollout date (UTC):
- Release owner:
- Security reviewer:
- Legal reviewer:
- Incident rollback owner:

## 1) Runtime and Migration Gate

- [ ] `docker compose up --build -d` succeeds
- [ ] `GET /health` = 200
- [ ] `GET /docs` = 200
- [ ] `alembic upgrade head` succeeds on clean DB
- [ ] Seed run is idempotent (`python -m src.seed` repeated)

## 2) Lost Pets Smoke Gate

- [ ] `make lost-pets-verify-report` passed locally or in CI
- [ ] `artifacts/lost-pets-smoke-report.json` status is `passed`
- [ ] `artifacts/lost-pets-smoke-summary.md` reviewed
- [ ] PR sticky smoke comment shows latest `passed` status

## 3) Payments and Monetization Controls

- [ ] Promotion payment flow validated (`checkout` -> `confirm`)
- [ ] Idempotency verified (same key does not double-charge)
- [ ] Ad budget entries validated (`allocate`/`spend` consistency)
- [ ] Failed/partial payment scenarios reviewed (no inconsistent promo state)
- [ ] Audit events for payment-critical actions verified

## 4) Privacy and Consent Controls

- [ ] Phone visibility respects `allow_phone_public`
- [ ] Geolocation storage and exposure reviewed (least privilege)
- [ ] Vet/clinic access checks still enforce membership + consent + scope
- [ ] Public endpoints do not leak protected fields
- [ ] Abuse/messaging controls resist spam/enumeration paths

## 5) Moderation and Safety Controls

- [ ] Moderation queue paths tested (approve/reject/block)
- [ ] Abuse report lifecycle tested (open -> resolve/reject)
- [ ] Risk scoring and auto-pending behavior validated
- [ ] Owner-facing AI behavior checked for policy-safe output
- [ ] No treatment/dose guidance leakage in owner-safe AI flows

## 6) Notifications and Hotspots

- [ ] Nearby clinic detection/notify flow validated
- [ ] Hotspot subscription create/list/delete validated
- [ ] Notification preferences + quiet hours respected
- [ ] Delivery analytics endpoint responds and has expected shape

## 7) Legal and Compliance (RU 2026)

- [ ] 152-FZ personal data handling requirements reviewed
- [ ] 54-FZ fiscal/payment obligations reviewed for scope changes
- [ ] Public listing UX includes required consent/privacy controls
- [ ] Legal text/consent wording updated if behavior changed
- [ ] Compliance notes updated in docs where applicable

## 8) Frontend Product Readiness

- [ ] Lost Pets map and list ranking (promoted first) verified
- [ ] Promoted visual distinction verified in UI
- [ ] Owner/non-owner listing flows verified
- [ ] Chat UX tested for both owner and finder roles
- [ ] Empty/error states reviewed for critical screens

## 9) Go/No-Go Decision

- [ ] All critical checks completed
- [ ] Known risks documented and accepted
- [ ] Rollback plan documented and tested
- [ ] Final release approval recorded by release owner

## 10) Post-Release Verification (T+0 / T+1)

- [ ] Smoke run re-executed on release environment
- [ ] Error rates/log anomalies checked
- [ ] Payment anomalies checked (duplicates/failures)
- [ ] Notification delivery health checked
- [ ] Incident channel on standby for 24h

## One-Click Operational Run

You can run a manual release gate smoke from GitHub Actions:

- Workflow: `Lost Pets Release Gate Run`
- Inputs:
  - `release_tag` (required)
  - `release_owner` (optional)
  - `issue_number` (optional, to reuse existing gate issue)

Behavior:

- runs `scripts/verify-lost-pets-stack.sh` with JSON + Markdown artifacts
- uploads artifacts as `lost-pets-release-gate-artifacts`
- creates (or reuses) release issue labeled `lost-pets`, `release-gate`
- posts/updates a sticky run summary comment in that issue

## Automatic Gate State Manager

Workflow `Lost Pets Release Gate Status` automatically evaluates gate issue state:

- triggers on issue edits/labels/comments and manual dispatch
- checks:
  - all checklist boxes in issue body are checked
  - latest smoke run comment contains `Overall status: \`passed\``
- decision:
  - `READY` -> closes issue (`completed`)
  - `BLOCKED` -> keeps issue open (or reopens if previously closed)

## Daily Watchdog

Workflow `Lost Pets Release Gate Watchdog` runs on schedule and manual dispatch:

- scans open issues labeled `lost-pets` + `release-gate`
- reads latest state and smoke comments
- posts/updates watchdog comment with:
  - gate status
  - last smoke status
  - issue and run age
- if gate remains BLOCKED for >= 24h, applies label:
  - `release-gate-blocked`
- if gate remains BLOCKED for >= 48h, applies label:
  - `release-gate-critical`
- escalation notifications:
  - 24h -> mentions `Release owner` from issue metadata
  - 48h -> mentions `Security reviewer` and `Legal reviewer` from issue metadata

## Operational Metrics

Workflow `Lost Pets Release Gate Metrics` produces management KPIs:

- sample size of release-gate issues
- open/closed split
- blocked >= 24h and >= 48h counts
- blocked share
- smoke pass rate
- avg and median time-to-ready (hours)

Outputs:

- `artifacts/lost-pets-release-gate-metrics.json`
- `artifacts/lost-pets-release-gate-metrics.md`

## Governance Dashboard Artifact

Workflow `Lost Pets Governance Summary` aggregates key governance signals:

- workflow health snapshot (smoke/governance/status/watchdog/metrics)
- release-gate issue totals and open READY/BLOCKED split
- open issue table with latest decision/smoke status
- operational risk signal (`GREEN` / `YELLOW` / `RED`) based on blocked/critical issues and workflow failures
- trend block for last 7/30 days (created/closed issues, escalations, smoke pass/fail events)
- auto-generated action hints for current risk level
- owner-routing hints (who must act first based on blocker type)
- SLA breach counters and chronic issue radar (prioritized by chronic score)
- weekly remediation digest (top-3 chronic issues + owner-routing plan)
- weekly remediation effectiveness metrics (resolved chronic count, net delta, efficiency ratio)
- weekly scorecard grade (`A`/`B`/`C`/`D`) for management-level health signal

Outputs:

- `artifacts/lost-pets-governance-summary.json`
- `artifacts/lost-pets-governance-summary.md`
- sticky digest comment in dedicated issue:
  - title: `[Lost Pets Governance] Operational Digest`
  - labels: `lost-pets`, `governance-digest`
- sticky weekly remediation comment in same issue:
  - marker: `<!-- lost-pets-weekly-remediation -->`
  - content: top-3 chronic issues with owner-routing actions
- sticky weekly grade history comment in same issue:
  - marker: `<!-- lost-pets-weekly-grade-history -->`
  - content: last 4 weekly grades (`A/B/C/D`) + trend hint
- degradation alert:
  - marker: `<!-- lost-pets-grade-decline-alert -->`
  - triggers when grade declines for 2+ consecutive weeks
- recovery confirmation:
  - marker: `<!-- lost-pets-grade-recovery -->`
  - triggers when grade improves for 2+ consecutive weeks
- combined anomaly incident mode:
  - marker: `<!-- lost-pets-combined-anomaly -->`
  - triggers when `RED` risk + declining trend + `open_blocked_48h > 0`
  - publishes incident playbook checklist in governance digest issue
- incident exit report:
  - marker: `<!-- lost-pets-incident-exit -->`
  - triggers after 3 consecutive runs without combined anomaly
  - publishes post-incident summary template (root cause + preventive actions)
- incident lifecycle KPI:
  - incidents started (last 30d)
  - mean time to recovery (hours)
  - active incident duration (hours)
- incident lifecycle SLO evaluation:
  - status: `SLO OK` / `SLO BREACH`
  - targets:
    - MTTR <= 72h
    - incidents/30d <= 2
    - active incident duration <= 24h
- SLO breach escalation policy:
  - marker: `<!-- lost-pets-slo-status -->`
  - triggers mandatory action plan when `SLO BREACH` persists for 2+ consecutive runs
  - includes required acknowledgements:
    - Release owner acknowledged
    - Security/legal reviewed
    - ETA set for SLO recovery
    - Backend/platform confirmed contract path restored (when breach reason is `recovery_blocked_by_self_check`)
- acknowledgement escalation:
  - marker: `<!-- lost-pets-slo-ack-escalation -->`
  - triggers when required acknowledgements stay incomplete for 2+ consecutive runs
  - uses `self_check_blocked` routing mode (includes backend/platform) when breach reason is `recovery_blocked_by_self_check`
  - governance digest labels: `slo-ack-escalated` always during escalation, plus `slo-ack-self-check-blocked` in self-check-blocked mode
  - SLA monitor marker: `<!-- lost-pets-slo-ack-sla -->` with 24h/48h timers and routing recommendations
  - SLA labels: `slo-ack-sla-24h` and `slo-ack-sla-48h` when timer thresholds are exceeded
  - chronic SLA label: `slo-ack-sla-chronic` when 24h or 48h breach streak persists for 2+ runs
  - governance summary includes `SLO Ack Escalation Digest` section for consolidated triage visibility
  - digest section includes status-based `Recommended ack actions` for immediate response
  - digest severity also uplifts top-level governance risk and weekly grade (`warning_chronic`/`critical`/`critical_chronic`)
  - `critical`/`critical_chronic` ack status can activate incident anomaly amplifier and enforce exit blocking until recovered
  - lifecycle KPI now reports ack escalation status/age and adds `recovery_blocked_by_ack_escalation` SLO breach reason when applicable
  - trend table includes ack-SLA warning/critical counts and average escalation age (7d/30d) for speed-of-recovery monitoring
  - marker `<!-- lost-pets-ack-age-trend-alert -->` publishes worsening/recovery signal for ack escalation age trajectory
  - sustained ack-age worsening now uplifts risk reason/routing/action hints in the top governance summary
  - weekly grade history tracks `ack status` and `ack-age trend`, plus explicit ack-age contribution text for decline/recovery
  - incident anomaly/exit/recovery comments include ack-age contribution snapshots for clearer root-cause attribution
  - incident exit postmortem template now has a dedicated `Ack-age contribution` field for mandatory attribution
  - incident exit monitoring now reports postmortem ack-age field status (`complete`/`incomplete`)
