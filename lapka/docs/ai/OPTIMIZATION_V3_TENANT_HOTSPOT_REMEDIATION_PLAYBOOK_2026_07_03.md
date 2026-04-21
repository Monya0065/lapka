# Optimization v3 Tenant Hotspot Remediation Playbook (2026-07-03)

## Purpose

Define remediation flow for tenant-level AI leakage hotspots identified by variance analytics.

## Trigger Conditions

Escalate tenant to hotspot remediation when any applies:

1. leakage per 1k >= 0.13 for 2 consecutive cycles
2. non-critical leakage count >= 2 in a cycle
3. critical leakage count > 0 in any cycle

## Remediation Flow

### Step 1: Triage (Day 0)

- Confirm affected routes and prompt versions.
- Verify safety policy mapping and last validation date.
- Assign incident owner and deputy.

### Step 2: Containment (Day 0-1)

- Apply stricter fallback guard on hotspot routes.
- Increase route-level monitoring frequency.
- Notify Program Manager and Platform Security Lead.

### Step 3: Correction (Day 1-3)

- Patch prompt/policy assets.
- Run targeted eval scenarios (critical first).
- Validate leakage metrics in shadow cycle.

### Step 4: Verification (Day 3-7)

- Require 2 consecutive cycles below trigger threshold.
- Require no critical leakage incidents.
- Downgrade tenant from hotspot to watch/good.

## Required Evidence

- before/after leakage metrics by tenant and route
- eval pass report for corrected routes
- owner signoff with mitigation completion date

## SLA and Escalation

- Use `docs/runbooks/SUPPORT_SLA_ESCALATION_MATRIX.md` severity ladder.
- Critical leakage -> immediate escalation to Platform Security Lead.

## Related Documents

- `docs/ai/OPTIMIZATION_AI_LEAKAGE_ANALYTICS_V2_EVIDENCE_2026_06_26.md`
- `docs/ai/PHASE3_M3_AI_TENANT_LEAKAGE_VARIANCE_2026_05_29.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
