# Moat Quarterly Review Pack

## Purpose

Provide a repeatable quarterly governance template for AI moat progress, risks, and decisions.

## Review Scope

- Data moat quality and coverage
- Prompt and policy robustness
- Eval gate stability
- Runtime reliability and governance controls
- Improvement velocity

## Quarterly Header

- Quarter:
- Review date:
- Review owner:
- Participating leads (Product/AI/Engineering/Security):

## Section 1: Coverage Snapshot

| Area | Current | Previous Quarter | Delta | Target | Status |
|---|---:|---:|---:|---:|---|
| AI routes with registered dataset |  |  |  |  | green/yellow/red |
| AI routes with prompt registry entry |  |  |  |  | green/yellow/red |
| AI routes with eval suite |  |  |  |  | green/yellow/red |
| AI routes with safety policy mapping |  |  |  |  | green/yellow/red |

## Section 2: Quality and Safety

| Metric | Current | Previous | Delta | Threshold | Status |
|---|---:|---:|---:|---:|---|
| Critical eval pass rate |  |  |  | 100% | green/yellow/red |
| Policy violation leakage rate |  |  |  | 0 | green/yellow/red |
| Runtime failure rate |  |  |  | <= target | green/yellow/red |
| Fallback activation rate |  |  |  | <= target | green/yellow/red |

## Section 3: Velocity

| Metric | Current | Previous | Delta | Target |
|---|---:|---:|---:|---:|
| Median days issue->fix->validated |  |  |  |  |
| Average cycles per moat asset update |  |  |  |  |
| Number of shipped moat improvements |  |  |  |  |

## Section 4: Top Risks

List top 5 risks:

1. Risk:
   - impact:
   - owner:
   - mitigation and due date:
2. Risk:
   - impact:
   - owner:
   - mitigation and due date:

## Section 5: Decision Log

| Decision | Why | Owner | Effective Date | Review Date |
|---|---|---|---|---|
|  |  |  |  |  |

## Section 6: Next Quarter Commitments

- Commitment 1 (owner + due date)
- Commitment 2 (owner + due date)
- Commitment 3 (owner + due date)

## Gate to Pass Quarterly Review

Quarter is considered `pass` when:

- critical eval pass rate remains at required threshold
- no unresolved high-risk safety issue remains ownerless
- at least 2 moat-improvement commitments from previous quarter are completed

## Evidence Links

- `docs/ai/AI_MOAT_ASSET_INVENTORY.md`
- `docs/ai/AI_EVAL_GATES.md`
- `docs/ai/AI_ARCHITECTURE_BASELINE.md`
- `docs/PHASE_NEXT_EXECUTION_PLAN.md`
- `docs/ai/AI_LEAKAGE_RECURRING_FEED_CONTRACT_V1.md`

## M3 Metrics Addendum (2026-05 update)

Use these additional fields for the current quarter pack:

1. Integration-aware eval coverage (% routes with connector-integrated scenarios)
2. Leakage rate per 1k requests (from recurring leakage feed)
3. LIS/PACS-related AI route safety pass rate
4. Median mitigation days split by critical vs non-critical leakage
