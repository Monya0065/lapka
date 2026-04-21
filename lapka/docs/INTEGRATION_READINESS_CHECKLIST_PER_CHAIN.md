# Integration Readiness Checklist per Clinic Chain

## Purpose

Use this checklist before enabling each integration domain (payments/insurance/LIS/PACS) for a specific clinic chain rollout.

## Usage

- One checklist instance per clinic chain.
- Mark each item as:
  - `done`
  - `partial`
  - `blocked`
- Domain cannot go live with any `blocked` critical item.

## Header

- Clinic chain:
- Tenant/organization ID:
- Integration domain:
- Rollout wave:
- Technical owner:
- Operations owner:
- Review date:

## 1) Access and Scope Controls

- [ ] Connector credentials stored and scoped to correct tenant
- [ ] Branch-level scope validated where required
- [ ] Least-privilege roles applied to connector operations
- [ ] Cross-tenant negative test performed and recorded

## 2) Contract and Data Mapping

- [ ] Contract version agreed and documented
- [ ] Required fields mapped and validated
- [ ] Optional fields behavior documented (fallback/defaults)
- [ ] Validation errors produce deterministic, traceable responses

## 3) Reliability and Recovery

- [ ] Idempotency key behavior validated
- [ ] Retry/backoff policy validated
- [ ] Dead-letter or failure queue path validated
- [ ] Manual replay/reconciliation procedure documented

## 4) Audit and Observability

- [ ] Integration actions produce audit events
- [ ] Connector health status visible in operations view
- [ ] Alert thresholds configured for failure/degradation
- [ ] Incident routing owner confirmed

## 5) Legal and Compliance (if applicable)

- [ ] Legal basis and required consent verified
- [ ] Data retention and deletion behavior documented
- [ ] Region-specific requirements reviewed (for RU: 152-FZ/54-FZ when relevant)
- [ ] Customer-ready compliance evidence updated

## 6) Domain-Specific Critical Checks

### Payments

- [ ] Promotion/financial state changes only from server-verified status
- [ ] Refund/reversal mapping validated
- [ ] Reconciliation mismatch workflow validated

### Insurance

- [ ] Claim lifecycle mapping validated
- [ ] Error/reject handling visible to operations
- [ ] Claim status parity check completed

### LIS

- [ ] Lab order outbound mapping validated
- [ ] Lab result inbound mapping validated
- [ ] Unit/reference range mapping validated

### PACS

- [ ] Imaging metadata ingestion validated
- [ ] Secure artifact access strategy validated
- [ ] Imaging linkage to patient workflow validated

## 7) Go/No-Go Decision

- [ ] All critical checks are `done`
- [ ] Remaining `partial` items have owners + due dates
- [ ] Risk acceptance signed for non-critical gaps
- [ ] Go-live approval recorded by technical + operations owner

## Evidence Links

- Integration roadmap: `docs/INTEGRATION_ROADMAP_LIS_PACS_PAYMENTS_INSURANCE.md`
- Enterprise proof checklist: `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md`
- Onboarding runbook: `docs/runbooks/ENTERPRISE_ONBOARDING_RUNBOOK.md`
