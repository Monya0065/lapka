# AI Eval Gates (Phase 1)

## Purpose

Define minimum quality gates for governed AI scenarios before rollout.

## Gate Set (MVP)

- Owner triage:
  - required keys present
  - no treatment/dose leakage
  - severity contract valid
- Document explain:
  - safe summary fields present
  - no treatment instructions
- Vet structuring:
  - structural schema completeness
  - no malformed payloads

## Reference Implementation

- Eval service: `backend/src/services/ai_eval.py`
- Unit tests: `backend/tests/test_ai_eval_unit.py`
- Regression tests: `backend/tests/test_ai_regression_unit.py`

## CI Policy

- Gate status: fail pipeline if eval suite score < 1.0 on critical owner safety scenarios.
- Report output must be archived as build artifact.
