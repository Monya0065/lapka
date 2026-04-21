# Optimization v25 Signal Triage and Noise Compression Spec (2027-10-01)

## Purpose

Specify autonomous observability signal triage and noise compression controls for optimization v25.

## Signal Triage Loop

1. Ingest observability events, SLO burn, dependency health, and audit-adjacent runtime signals.
2. Score causal confidence, blast radius, and SLA relevance for each signal cluster.
3. Deduplicate correlated signals into single triage threads with ranked hypotheses.
4. Route triage outcomes to owners using deterministic escalation matrices.
5. Record triage lineage for replay and calibration feedback.

## Noise Compression Loop

1. Identify high-cardinality noise sources and apply bounded aggregation rules.
2. Preserve protected lanes for safety, isolation, and authentication anomaly classes.
3. Compress repetitive alerts into summarized windows with freshness guarantees.
4. Escalate compression quality regressions when false-negative risk rises.
5. Publish weekly compression quality and missed-signal audits to governance.

## Trigger Thresholds

- `triage_watch`: causal confidence < 0.82 on active cluster
- `triage_high`: duplicate storm rate >= 0.35 in rolling 60 min
- `noise_guard`: false-positive ratio > 0.08 in rolling 7-day window
- `critical_lane_protect`: any signal tagged safety-critical bypasses aggressive compression
- `missed_signal_watch`: missed regression count >= 1 in rolling 30 days

## Validation

- Weekly checks for triage precision, assignment latency, and missed critical signals.
- Weekly checks for compression effectiveness, false-positive reduction, and hypothesis speed.
- Monthly governance audit for traceability and protected-lane compliance.

## Related Documents

- `docs/OPTIMIZATION_V25_SCOPE_AND_BASELINE_2027_10_01.md`
- `docs/INCIDENT_TAXONOMY_V1.md`
