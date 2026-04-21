# Optimization v10 Policy Graph and Recovery Choreography Spec (2026-11-20)

## Purpose

Specify antifragile policy graph controls and autonomous recovery choreography for optimization v10.

## Antifragile Policy Graph Loop

1. Build and refresh policy dependency graph from production signals.
2. Score paths by resilience, recurrence risk, and blast radius.
3. Promote robust paths after repeated stable outcomes.
4. Quarantine fragile paths that violate recurrence or stability thresholds.
5. Revalidate graph edges after each incident/recovery cycle.

## Autonomous Recovery Choreography Loop

1. Detect incident context and map required recovery stages.
2. Generate recovery sequence candidates with dependency constraints.
3. Select optimal sequence by safety-first objective and expected convergence.
4. Auto-execute low-risk choreography steps with guard checkpoints.
5. Abort/rollback on guardrail breach and switch to safe fallback sequence.

## Trigger Thresholds

- `fragile_path_watch`: recurrence risk >= 0.18
- `fragile_path_high`: recurrence risk >= 0.27
- `choreo_watch`: convergence score < 0.72
- `choreo_high`: convergence score < 0.61
- `choreo_autorun`: risk tier = low and confidence >= 0.82

## Validation

- Weekly checks for graph resilience and fragile-path recurrence.
- Weekly checks for choreography precision, duration, and thrash.
- Monthly governance audit for safety, tenant isolation, and decision traces.

## Related Documents

- `docs/OPTIMIZATION_V10_SCOPE_AND_BASELINE_2026_11_20.md`
- `docs/runbooks/INCIDENT_RESPONSE.md`
