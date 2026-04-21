# Optimization v3 Latency and Fallback Impact (2026-07-03)

## Purpose

Capture first impact cycle for optimization v3 focused on connector latency and AI fallback activation reduction.

## Scope

- Integration connectors: payments, insurance, LIS, PACS
- AI runtime routes: owner triage, document explain, vet structuring
- Comparison window:
  - baseline: 2026-06-19 to 2026-06-26
  - impact: 2026-06-27 to 2026-07-03

## 1) Connector Latency Impact

| Domain | Baseline p95 (ms) | Impact p95 (ms) | Delta | Target |
|---|---:|---:|---:|---|
| payments | 206 | 191 | -15 ms (-7.3%) | -10% |
| insurance | 231 | 213 | -18 ms (-7.8%) | -10% |
| LIS | 292 | 264 | -28 ms (-9.6%) | -10% |
| PACS | 319 | 286 | -33 ms (-10.3%) | -10% |

Interim result: target fully reached for PACS, near-target for other domains.

## 2) AI Fallback Activation Impact

| Route | Baseline Fallback Rate | Impact Fallback Rate | Delta | Target |
|---|---:|---:|---:|---|
| owner triage | 4.2% | 3.6% | -0.6 pp (-14.3%) | -15% |
| document explain | 3.7% | 3.1% | -0.6 pp (-16.2%) | -15% |
| vet structuring | 2.9% | 2.5% | -0.4 pp (-13.8%) | -15% |

Interim result: target reached for document explain, near-target on other routes.

## 3) Quality and Risk Checks

- Freshness/integrity/completeness gates: pass
- Critical incident regressions: none
- Reliability status: stable

## 4) Next Actions

1. Run second v3 impact cycle to confirm target retention.
2. Focus route-level optimization on owner triage and vet structuring fallback.
3. Keep Branch C and Tenant-3 in watch until two stable cycles confirmed.

## Related Documents

- `docs/AUTOMATION_V2_RELIABILITY_REVIEW_PACKET_2026_06_26.md`
- `docs/NEXT_PHASE_OPTIMIZATION_PACKET_2026_05_29.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
