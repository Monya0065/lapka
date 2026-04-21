# Support SLA Escalation Matrix

## Purpose

Define a repeatable support SLA ladder and escalation workflow for clinic chains and enterprise tenants.

## Severity Levels

| Severity | Definition | Example |
|---|---|---|
| Sev-1 | Critical outage or patient-safety impacting workflow failure | core API outage, blocked visit finalization across clinics |
| Sev-2 | Major degradation with workaround | scheduler instability, delayed notifications, partial branch outage |
| Sev-3 | Functional issue with limited impact | report/export defects, non-critical UI failures |
| Sev-4 | Minor issue or request | cosmetic bug, low-priority enhancement |

## SLA Targets by Tier

### Standard Tier

| Severity | First Response | Update Cadence | Target Resolution |
|---|---:|---:|---:|
| Sev-1 | 1 business hour | every 2 hours | 1 business day |
| Sev-2 | 4 business hours | every 1 business day | 3 business days |
| Sev-3 | 1 business day | every 2 business days | 10 business days |
| Sev-4 | 2 business days | weekly | best effort / backlog |

### Enterprise Tier

| Severity | First Response | Update Cadence | Target Resolution |
|---|---:|---:|---:|
| Sev-1 | 15 minutes (24/7) | every 30 minutes | 4 hours mitigation, 24h restoration target |
| Sev-2 | 1 hour (24/7) | every 2 hours | 1 business day |
| Sev-3 | 4 business hours | daily | 5 business days |
| Sev-4 | 1 business day | weekly | planned release |

## Escalation Path

1. L1 Support triage
2. L2 Product specialist
3. L3 Engineering on-call
4. Incident commander (Sev-1 / Sev-2 prolonged)
5. Executive sponsor escalation (customer + internal)

## Trigger Rules

- Escalate to L3 immediately for all Sev-1 incidents.
- Escalate to incident commander if:
  - Sev-1 unresolved for 60 minutes, or
  - Sev-2 misses first update cadence twice.
- Escalate to executive sponsor if enterprise Sev-1 lasts > 4 hours.

## Communication Contract

- Incident ticket must include:
  - affected tenant(s), clinic(s), branch scope
  - start time, severity, owner
  - current impact and mitigation status
- External status updates must include:
  - what is affected
  - what is working
  - next update time

## Post-Incident Requirements

- RCA draft in 24 hours for Sev-1, 72 hours for Sev-2.
- Corrective actions must have owner, due date, and verification note.
- Repeated incident class (same root cause 2+ times/quarter) requires preventive project kickoff.

## Operational Metrics

- MTTA by severity and tier
- MTTR by severity and tier
- SLA breach rate by tenant tier
- Reopen rate after "resolved" status

## Related Documents

- `docs/runbooks/SLO_SLA_OPERATIONS.md`
- `docs/runbooks/INCIDENT_RESPONSE.md`
- `docs/gtm/CLINIC_CHAIN_ROLLOUT_SCORECARD.md`
