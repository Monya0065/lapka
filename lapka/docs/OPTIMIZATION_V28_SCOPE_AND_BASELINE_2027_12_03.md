# Optimization v28 Scope and Baseline (2027-12-03)

## Purpose

Define optimization v28 focused on autonomous regulatory evidence export integrity and custody-chain quality.

## v28 Scope

### 1) Autonomous Regulatory Evidence Export Integrity

- Produce regulator-ready export bundles with deterministic completeness and versioning.
- Detect missing, stale, or inconsistent evidence links before bundle release.
- Align exports with jurisdiction-specific packaging rules where applicable.

### 2) Custody-Chain Quality

- Maintain end-to-end custody chain from source systems through export handoff.
- Detect custody breaks, unauthorized access, and tamper signals before attestation.
- Reduce rework cycles caused by custody or integrity failures during reviews.

## Baseline Metrics

| Metric | Baseline | v28 Target |
|---|---:|---:|
| Export bundle integrity score | 84% | >= 96% |
| Mean export preparation cycle time | 11.2h | <= 3.5h |
| Custody-chain completeness | 91% | >= 99% |
| Custody anomaly detection precision | 80% | >= 92% |
| Regulatory review blockers from integrity gaps (monthly) | 4 | <= 1 |
| Unauthorized access attempts on export artifacts (monthly) | 3 | <= 1 |

## Guardrails

1. No critical incident caused by autonomous export integrity or custody-chain controls.
2. Safety and tenant isolation policies remain enforced.
3. Readiness state remains `Ready` or higher.

## Related Documents

- `docs/OPTIMIZATION_V27_CERTIFICATION_PACKET_2027_11_26.md`
- `docs/OPTIMIZATION_V17_EVIDENCE_REPLAY_AUDIT_COMPRESSION_SPEC_2027_04_16.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
