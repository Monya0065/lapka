# VPN Security Baseline and Threat Model

Date: 2026-04-17
Status: Execution baseline

## 1. Security Objectives

- Protect customer identity, payment, and session data.
- Prevent account takeover and malicious device enrollment.
- Keep VPN control-plane resilient during provider or region outages.
- Preserve evidence integrity via immutable audit logging.

## 2. Threat Model

## 2.1 Assets

- User accounts, sessions, and 2FA metadata.
- Device claim tokens and VPN profile material.
- Payment webhook authenticity and subscription state.
- Service credentials, TLS keys, and signing keys.

## 2.2 Trust Boundaries

- Public clients -> API Gateway.
- Third-party payment systems -> webhook ingress.
- Telegram bot traffic -> activation API.
- Internal services -> data stores and message queue.

## 2.3 Primary Abuse Cases

- A1: credential stuffing against auth endpoints.
- A2: replay of payment webhooks to fake paid status.
- A3: reuse of device claim token from leaked import link.
- A4: session theft through refresh token exfiltration.
- A5: rogue admin action without traceability.
- A6: node compromise to exfiltrate active profile configuration.

## 3. Security Controls Matrix

| Threat | Preventive controls | Detective controls | Recovery controls |
| --- | --- | --- | --- |
| A1 | rate-limit + CAPTCHA challenge + breached-password check | login anomaly alerts | account temporary lock and forced reset |
| A2 | webhook signature verify + nonce window + idempotency key | duplicate event detector | payment state reconciliation job |
| A3 | one-time token hash + TTL <= 10 min + device binding | token reuse alert | immediate token invalidation and user re-issue |
| A4 | refresh rotation + token family invalidation + device fingerprint | unusual session chain alert | revoke all sessions, step-up reauth |
| A5 | least-privilege RBAC + just-in-time admin grants | immutable audit stream + dual-control alerts | emergency admin freeze runbook |
| A6 | node hardening + no plaintext secrets on node + mTLS | node posture drift detection | isolate node, rotate keys, reprovision |

## 4. Hardening Plan by Layer

## 4.1 Application Layer

- Enforce secure local storage:
  - iOS/macOS Keychain.
  - Android Keystore.
  - Windows DPAPI/Credential Locker.
- Implement app lock and inactivity timeout.
- Prevent profile export in plaintext unless explicitly requested by user.
- Enforce TLS certificate pinning where platform permits stable pin lifecycle.

## 4.2 API Layer

- OAuth2/JWT with:
  - access TTL 10 min.
  - refresh TTL 30 days, rotation on each refresh.
  - token family revoke on suspicious chain.
- Step-up required for:
  - security settings changes.
  - device revoke.
  - billing method updates.
- Strict input validation (Pydantic schemas), deny unknown fields.
- API gateway controls:
  - IP and account-based quotas.
  - geo-velocity rule triggers.
  - WAF baseline for OWASP top threats.

## 4.3 Infrastructure Layer

- mTLS service mesh for internal traffic.
- Segmented VPCs:
  - public ingress.
  - control-plane private subnet.
  - data-plane subnet.
- Secrets in Vault/KMS, not in application environment files in production.
- Signed image deployment, SBOM generation, image vulnerability gate.
- Backup strategy:
  - daily encrypted snapshots.
  - WAL/archive every 5 min.
  - quarterly restore drill.

## 5. Identity and Access Governance

- RBAC roles: `support_read`, `support_write_limited`, `security_admin`, `infra_admin`.
- Production access:
  - short-lived credentials only.
  - mandatory MFA for all admin access.
  - break-glass account with monitored use and post-use rotation.

## 6. Logging and Detection

- Centralized logs:
  - auth events.
  - webhook verification outcomes.
  - device claim and profile events.
  - admin actions.
- Security telemetry SLAs:
  - critical signal ingestion < 30 s.
  - Sev-1 alert dispatch < 2 min.
- Mandatory alert sets:
  - impossible travel.
  - 5x failed step-up.
  - repeated webhook signature failures.
  - repeated token replay attempts.

## 7. Security Testing Program

- CI gates:
  - SAST, dependency scanning, secret scanning.
  - IaC scanning (Terraform policies).
- Pre-release:
  - API DAST.
  - webhook replay test.
  - red-team style ATO scenario.
- Post-release:
  - monthly vulnerability review.
  - quarterly external penetration test.

## 8. Incident and Key Rotation Standards

- TLS cert rotation every 60-90 days.
- Signing key rotation every 90 days with overlap window.
- Emergency full-profile revoke pipeline tested monthly.
- Incident handling aligned to `docs/runbooks/INCIDENT_RESPONSE.md`.
