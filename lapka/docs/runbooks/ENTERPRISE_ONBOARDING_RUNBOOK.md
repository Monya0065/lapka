# Enterprise Onboarding Runbook

## Purpose

Standardize enterprise onboarding for clinic chains so that legal, security, technical rollout, and operations launch are reproducible.

## Scope

- Target: clinic chains (2-20+ branches)
- Roles involved: platform security, engineering, customer success, clinic admins, executive sponsor
- Onboarding window target: 2-6 weeks (depends on integration scope)

## Phase 0: Pre-Kickoff Readiness

- Confirm commercial scope:
  - number of clinics/branches
  - modules included
  - integration domains in scope
- Assign owners:
  - program owner
  - technical owner
  - security/compliance owner
  - customer success owner
- Create onboarding workspace:
  - timeline, risks, evidence links, escalation contacts

Exit gate:

- All owners assigned, kickoff agenda approved, target go-live date agreed.

## Phase 1: Identity, Legal, and Security Setup

1. Identity and access:
   - role mapping confirmed for owner/vet/clinic_admin/network operators
   - identity mode selected (current + target state for SSO/SAML/OIDC)
2. Legal:
   - legal acceptance flow confirmed
   - document/version ownership and refresh policy confirmed
3. Security:
   - tenant isolation assumptions reviewed
   - audit logging requirements aligned

Evidence required:

- `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md`

Exit gate:

- No critical `missing` item in identity/isolation/compliance sections.

## Phase 2: Data and Operational Configuration

1. Data onboarding:
   - clinic and branch registry validation
   - service/template baseline imported
2. Operational setup:
   - schedule/flowboard/inpatient routes validated
   - SLA/system-task workflow enabled
3. KPI baseline capture:
   - baseline window for ROI metrics fixed and frozen

Evidence required:

- rollout scorecard baseline record
- ROI baseline evidence template initialized

Exit gate:

- Branch operations visible and usable in platform dashboards.

## Phase 3: Controlled Activation

1. Activate first branch (pilot branch).
2. Run daily operational checks (7-14 days):
   - flow stability
   - no-show mitigation loop
   - protocol usage and visit closure cycle
3. Weekly checkpoint with executive sponsor:
   - blockers, risk status, decision log

Evidence required:

- `docs/gtm/CLINIC_CHAIN_ROLLOUT_SCORECARD.md`

Exit gate:

- Pilot branch score is yellow/green and no unresolved critical incidents.

## Phase 4: Expansion Across Branches

1. Add branches in waves (batch size agreed at kickoff).
2. Repeat readiness checks for each branch batch.
3. Monitor support SLA adherence and incident quality.

Evidence required:

- branch-by-branch rollout checklist
- SLA incident metrics and response logs

Exit gate:

- Expansion readiness criteria met in scorecard, support SLA stable.

## Phase 5: Stabilization and Handover

1. Final KPI checkpoint against baseline:
   - no-show, throughput, closure time, protocol quality, risk indicators
2. Hand over operating cadence:
   - weekly ops review
   - monthly ROI review
   - quarterly governance review
3. Final risk review and next-quarter commitments.

Exit gate:

- Handover package approved by customer success and clinic sponsor.

## Escalation Rules

- Use `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md` for severity and response targets.
- Trigger executive escalation when:
  - Sev-1 > 4h in enterprise tier
  - onboarding milestone delayed > 7 days without approved mitigation

## Related Documents

- `docs/runbooks/ENTERPRISE_READINESS_PROOF_CHECKLIST.md`
- `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md`
- `docs/gtm/CLINIC_CHAIN_ROLLOUT_SCORECARD.md`
- `docs/metrics/ROI_EVIDENCE_TEMPLATE_5_20_CLINICS.md`
