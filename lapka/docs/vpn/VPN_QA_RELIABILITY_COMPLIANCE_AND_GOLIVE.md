# VPN QA, Reliability, Compliance Test Plan and Go-Live Gates

Date: 2026-04-17
Status: Launch verification baseline

## 1. Test Streams

- Security verification.
- Reliability and disaster recovery.
- Billing and financial correctness.
- Device activation and VPN profile integrity.
- Compliance and legal evidence checks.

## 2. Security Test Plan

## 2.1 Automated in CI

- SAST on backend/frontend code.
- Dependency vulnerability scan for runtime and build deps.
- Secret scan for repository and pipeline artifacts.
- IaC policy scan for Terraform/network configurations.

## 2.2 Pre-Release Manual/Automated

- API DAST for auth, billing, and device claim endpoints.
- Credential stuffing simulation on login and step-up endpoints.
- Webhook replay and tampering scenarios.
- Token abuse tests:
  - expired link,
  - reused one-time token,
  - mismatched device binding.

## 3. Reliability and Resilience Tests

- Multi-region failover drill:
  - control-plane primary outage.
  - verify API and profile issuance recovery.
- Database restore drill:
  - point-in-time recovery from encrypted backups.
- Queue and worker stress:
  - delayed webhook bursts.
  - subscription reconciliation under backlog.
- VPN node degradation:
  - automatic node quarantine and profile reassignment.

## 4. Billing Correctness Tests

- Checkout creation across all providers.
- Successful capture -> subscription activation.
- Failed and delayed webhook handling.
- Duplicate webhook idempotency behavior.
- Refund and partial refund processing.
- Daily reconciliation mismatch detection and escalation.

## 5. Telegram and Device Claim E2E Tests

- Bot deep-link issued with valid signature.
- Web claim session expires correctly.
- Manual import in app activates connect button only after validation.
- Device limit enforcement across plans.
- Device revoke immediately blocks connect authorization.

## 6. Compliance Validation Tests

- Legal links visible in web and app onboarding/payment flow.
- Consent capture events persisted with version and timestamp.
- Data subject request dry run:
  - export user data package.
  - delete request with retention exceptions.
- Audit integrity:
  - critical actions are present and immutable.

## 7. Observability and Alerting Readiness

- Alert tests:
  - webhook signature failures.
  - auth brute-force spike.
  - unusual geo-velocity.
  - payment provider outage.
- SLO dashboard availability:
  - auth latency.
  - checkout success ratio.
  - claim/import success ratio.
  - connect authorization success ratio.

## 8. Exit Criteria (Go-Live)

- End-to-end scenario passes on iOS, Android, macOS, Windows:
  - payment -> Telegram link -> web claim -> app import -> connect.
- Zero open critical/high vulnerabilities in release perimeter.
- Failover and restore drills completed with documented evidence.
- Payment reconciliation passes two consecutive daily cycles.
- Legal package approved and published.
- Incident runbooks and on-call rotations confirmed.

## 9. Launch Stages

- Stage 0: internal dogfood.
- Stage 1: closed beta (1-5% users).
- Stage 2: controlled rollout (25%).
- Stage 3: full rollout with enhanced monitoring for 7 days.

Rollback rule:
- any Sev-1 or unresolved billing inconsistency -> revert rollout stage.

## 10. Evidence Pack Checklist

- Test run reports (CI and pre-release).
- Penetration findings and remediation status.
- Failover/restore drill logs.
- Financial reconciliation reports.
- Legal publication snapshot and version ids.
- Signed launch approval record (engineering, security, legal, operations).
