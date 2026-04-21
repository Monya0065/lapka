# Integration Roadmap (LIS, PACS, Payments, Insurance)

## Objective

Define a phased integration path that increases switching cost and operational depth for clinic chains while keeping rollout risk controlled.

## Integration Domains

- LIS (lab information systems)
- PACS/imaging exchange
- Payments/fiscal providers
- Insurance/claims gateways

## Delivery Principles

- Integrations must be tenant-safe (clinic/branch scoped).
- Every connector ships with audit and retry visibility.
- No hard dependency at launch: feature flags and fallback paths required.
- Contract-first approach: schemas + validation before live traffic.

## Dependency Map

| Capability | Depends On | Why |
|---|---|---|
| External connector registry | RBAC + tenant scoping + config storage | connector credentials and scope isolation |
| Event-driven sync workers | queue/backoff/idempotency | reliable external writes/reads |
| Reconciliation dashboard | audit logs + connector status telemetry | operational trust and incident triage |
| Enterprise proof pack | audit + SLA + legal evidence | procurement/security review support |

## Phase Plan

### Phase A (0-1 quarter): Foundation

1. Define connector contract (`auth`, `sync mode`, `scope`, `retry policy`).
2. Add integration registry schema and admin UI skeleton.
3. Add sync job envelope with idempotency key and audit event.
4. Add connector health model (`healthy`, `degraded`, `failed`, `paused`).

Exit criteria:

- One connector can be registered and health-checked in a non-prod tenant.
- Audit trail exists for config changes and sync attempts.

### Phase B (1-2 quarters): Payments + Insurance first

Reason: fastest measurable ROI and compliance value.

1. Payments:
   - server-side verified payment status sync
   - refund/reversal status mapping
   - reconciliation report (internal vs provider)
2. Insurance:
   - claim submission status sync
   - claim state machine mapping to clinic billing UI
   - retry/dead-letter handling for claim failures

Exit criteria:

- Payment and claim status parity >= 99% in pilot tenants.
- Reconciliation workflow used in weekly ops review.

### Phase C (2-3 quarters): LIS integration

1. Inbound lab result ingestion with schema validation.
2. Outbound lab order sync and status updates.
3. Per-tenant mapping rules for tests/panels and units.

Exit criteria:

- End-to-end order->result cycle is traceable for pilot clinics.
- Manual reconciliation effort reduced by agreed threshold.

### Phase D (3-4 quarters): PACS/imaging integration

1. Imaging metadata ingestion and link association to patient records.
2. Secure access strategy (signed links/tokens) for imaging artifacts.
3. Workflow hooks in vet/clinic UI for imaging-aware decisions.

Exit criteria:

- Imaging references visible in clinical workflow with audit coverage.
- Access controls validated for tenant and consent scope.

## Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Connector-specific schema drift | sync failures | contract tests + schema versioning |
| Cross-tenant leakage through mis-scoped credentials | critical | strict scope model + automated deny tests |
| Provider downtime | delayed operations | queue retries + circuit breaker + failover mode |
| Fiscal/legal mismatch in payments | compliance risk | legal checklist + reconciliation + immutable audit |

## KPI Layer for Integration Program

- Connector uptime by domain
- Sync success rate and retry rate
- Reconciliation mismatch rate
- Mean time to recover connector failures
- Manual correction volume per tenant

## Ownership

- Product owner: Platform Product Lead
- Technical owner: Integration Engineering Lead
- Compliance owner: Security/Legal
- Operations owner: Customer Success Ops

## Related Documents

- `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md`
- `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
