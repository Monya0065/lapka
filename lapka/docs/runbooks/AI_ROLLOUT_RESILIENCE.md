# AI Rollout Resilience

## Objective

Ship AI model/prompt changes safely with automatic rollback criteria.

## Rollout Stages

1. Offline eval pass (golden cases)
2. Canary traffic (5-10%)
3. Progressive rollout (25% -> 50% -> 100%)

## Guardrail Thresholds

- Policy violation rate must not regress
- Runtime failure rate must stay below target
- P95 latency must remain within SLO budget

## Rollback Rules

- Immediate rollback on policy violation spike
- Immediate rollback on sustained 5xx increase
- Rollback if canary score < baseline by threshold

## Ownership

- Incident commander: AI platform owner
- Approval: product + engineering lead
