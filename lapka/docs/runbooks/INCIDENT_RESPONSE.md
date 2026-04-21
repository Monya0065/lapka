# Incident Response Runbook

## Severity

- Sev-1: service unavailable / data integrity risk
- Sev-2: critical workflow degraded
- Sev-3: partial degradation with workaround

## Immediate Steps

1. Assign incident commander
2. Open incident channel
3. Capture timeline (UTC)
4. Stabilize first, investigate second

## Communication

- Internal updates every 15 minutes for Sev-1
- External customer update every 30 minutes for Sev-1

## Resolution

- Validate fix in production
- Monitor for 60 minutes minimum
- Publish postmortem within 48 hours

## Postmortem Template

- Trigger
- Impact
- Root cause
- Corrective actions
- Prevention actions
