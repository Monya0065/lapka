# Step 1 — AI Architecture Baseline

This document fixes the AI architecture baseline for implementation steps 2-10.
It is aligned with `AI_IMPLEMENTATION_PLAN.md` and must not be changed without explicit approval.

## 1) AI scope and goals

- Owner-facing AI:
  - urgency triage (GREEN/YELLOW/RED),
  - safe document explanation,
  - strict rejection of treatment/dosage instructions.
- Vet-facing AI:
  - transcription assistance,
  - visit note structuring,
  - lab explanation support.
- Platform AI:
  - provider/routing/safety control plane,
  - usage logging and governance constraints.

## 2) Layered architecture

- **API routes layer**
  - `backend/src/api/routes/ai_safe.py`
  - `backend/src/api/routes/ai_assistant.py`
  - `backend/src/api/routes/platform_ai.py`
- **Service/orchestration layer**
  - `backend/src/services/ai_runtime.py`
  - `backend/src/services/ai_safe.py`
- **Provider layer**
  - `backend/src/ai/providers/registry.py`
  - `backend/src/ai/providers/openai_provider.py`
  - `backend/src/ai/providers/noop.py`
- **Assistant modules**
  - `backend/src/ai_assistant/transcription.py`
  - `backend/src/ai_assistant/visit_structuring.py`
  - `backend/src/ai_assistant/lab_explainer.py`

Rule: business logic remains in services/modules; routes only orchestrate request/response and auth dependencies.

## 3) Provider and fallback model

- Primary provider path: provider selected by route/runtime policy.
- Fallback path:
  1. route/provider fallback via runtime config,
  2. deterministic safe fallback in assistant/safe service logic when provider fails/unavailable.
- Mandatory behavior on provider/runtime failure:
  - no unsafe output,
  - controlled error contract (`AI_RUNTIME_FAILED`) or deterministic safe fallback output.

## 4) Safety and policy constraints

- Owner requests that imply treatment instructions, dosages, injections, or self-medication must be blocked.
- Blocking contract:
  - HTTP `422`,
  - code `POLICY_VIOLATION`.
- AI must not output treatment plans/doses for owners even when fallback is active.

## 5) Governance and control plane

- Source of governance:
  - route configuration,
  - role/clinic overrides,
  - limits and budget checks,
  - usage logging.
- Control plane endpoint:
  - `/api/v1/platform/ai/control-plane` (`GET`/`PUT`).
- Runtime execution contract:
  - prepare execution (provider/model/policy),
  - enforce limits/budget,
  - execute runner,
  - persist usage outcome.

## 6) Configuration baseline

- Backend env vars:
  - `LLM_PROVIDER` — primary registry slug (e.g. `openai`, `noop`).
  - `LLM_FALLBACK_PROVIDER` — secondary slug when primary is unavailable.
  - `OPENAI_API_KEY` / `OPENAI_MODEL` — used when OpenAI is selected.
- Frontend env var (backend API URL):
  - `NEXT_PUBLIC_API_URL`

See `backend/.env.example` for the full list. With `noop` or missing keys, assistant modules still return deterministic safe payloads (no LLM calls).

### Operations quick check

- AI regression (Docker API image):  
  `docker compose run --rm --no-deps api sh -c "PYTHONPATH=/app pytest tests/test_ai_regression_unit.py -v"`
- After changing backend sources, rebuild the API image before that command (no bind mount on `api` by default).

No additional provider architecture is introduced in step 1.

## 7) Error contracts baseline

- `POLICY_VIOLATION` (owner safety block) -> `422`.
- `AI_RUNTIME_FAILED` (runtime failure wrapper) -> `503`.
- `AI_RATE_LIMIT` / `AI_BUDGET_EXCEEDED` -> `429` where applicable.

## 8) Integration boundaries (do not cross in AI steps)

- Do not change non-AI owner UX/copy/layout tasks.
- Do not modify non-AI business modules unless directly required by AI route execution.
- Do not refactor RBAC/consent modules beyond AI route dependencies.
- Do not run broad refactors or legacy directory cleanup.

## 9) Step 1 completion criteria

Step 1 is considered completed when:
- architecture baseline is documented and fixed,
- provider/fallback/safety/control-plane contracts are explicitly defined,
- boundaries and non-goals are explicit for next implementation steps.
