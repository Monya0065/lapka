# AI Implementation Plan (Immutable Baseline)

## 0) One-time project analysis snapshot

### Technology and structure
- Frontend: Next.js 14 (App Router), React 18, Tailwind, i18next.
- Backend: FastAPI, SQLAlchemy async, Alembic, Redis, OpenAI SDK in dependencies.
- Infra: Docker Compose (`db`, `redis`, `api`, `frontend`).
- Key roots: `backend/`, `frontend/`, `docs/`, `ai/`, `scripts/`, `database/`, `infrastructure/`.

### Existing AI capabilities
- Owner-safe AI API (`/api/v1/ai/*`) with policy constraints:
  - `/ai/triage`
  - `/ai/explain-doc`
  - `/ai/structure-notes`
  - `/ai/protocol-completeness`
  - `/ai/visit-summary`
  - `/ai/provider-status`
- Vet assistant endpoints:
  - `/ai/transcribe`
  - `/ai/visit-structure`
  - `/ai/lab-explain`
- AI control-plane endpoint:
  - `/platform/ai/control-plane` (`GET`/`PUT`)
- Frontend integration already exists in:
  - owner triage flow
  - platform AI control page

### Real broken/risky issues found (non-stylistic)
1. Potential backend crash if Sentry is enabled (`logger` used before initialization in `backend/src/main.py`).
2. Frontend API env inconsistency for billing links (`NEXT_PUBLIC_API_BASE` vs project standard `NEXT_PUBLIC_API_URL`).
3. Duplicate legacy directories (`backend/src/ai 2`, `backend/src/integrations 2`) create maintenance/import risk.

### Main AI goal
- Safe veterinary AI assistant:
  - Owner: urgency triage + safe document explanation.
  - Vet: transcription + structuring + lab explanation support.
  - Strictly no owner treatment/dosage guidance.
  - Governed by routing/limits/budget/audit controls.

---

## 1) AI integration architecture (target)

### Provider and routing
- Primary provider: OpenAI via backend provider registry.
- Fallback provider: `noop` provider and deterministic rule/template fallback paths already in assistant modules.
- Runtime governance layer remains mandatory: per-route metadata, role checks, limits, budget checks, usage logs.

### API contract placement
- Keep AI orchestration in backend service layer:
  - `backend/src/services/ai_runtime.py`
  - `backend/src/services/ai_safe.py`
- Keep role-facing endpoints in routes layer:
  - `backend/src/api/routes/ai_safe.py`
  - `backend/src/api/routes/ai_assistant.py`
  - `backend/src/api/routes/platform_ai.py`

### Keys and config
- Backend env:
  - `LLM_PROVIDER`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL`
- Frontend env:
  - unify on `NEXT_PUBLIC_API_URL` for backend base URL usage.

### Observability / safety
- Preserve POLICY_VIOLATION (`422`) behavior for owner treatment/dosage requests.
- Preserve AI usage governance in control plane and runtime checks.
- Add/keep deterministic fallback for provider unavailability.

---

## 2) Files to be changed or created

### Backend (planned)
- `backend/src/main.py` (Sentry logger init order fix).
- `backend/src/core/config.py` (only if required by AI config normalization).
- `backend/src/services/ai_runtime.py` (only if wiring fixes are required by tests).
- `backend/src/services/ai_safe.py` (only if policy/test gaps are found).
- `backend/src/api/routes/ai_safe.py` (only if response contract mismatch is found).
- `backend/src/api/routes/ai_assistant.py` (only if contract mismatch is found).
- `backend/src/api/routes/platform_ai.py` (only if control-plane contract mismatch is found).
- `backend/.env.example` (if any missing AI env vars are needed).

### Frontend (planned)
- `frontend/lib/auth.js` / `frontend/lib/constants.js` (base API URL normalization if needed).
- `frontend/app/clinic/billing/page.jsx` (env var consistency fix).
- `frontend/app/clinic/billing/[id]/page.jsx` (env var consistency fix).
- AI-connected UI files only if integration issues are detected:
  - `frontend/components/ui/AIWidget.jsx`
  - `frontend/app/owner/triage/page.jsx`
  - `frontend/app/platform/ai/page.jsx`

### Documentation and tests (planned)
- `docs/*` (only for AI architecture/runbook updates).
- Backend tests under `backend/tests/*` (AI safety/runtime regressions).
- Frontend e2e tests under `frontend/tests/*` (AI UI smoke paths), if needed.

---

## 3) Execution order (max 10 steps, each a complete block)

### Step 1 — Stabilize backend boot for AI-enabled deployments
- Scope: fix Sentry logger initialization order in backend startup.
- Done criteria:
  - Backend starts successfully with and without `sentry_dsn`.
  - `/health` responds 200.

### Step 2 — Normalize frontend API base env usage
- Scope: replace inconsistent `NEXT_PUBLIC_API_BASE` usage with project-standard `NEXT_PUBLIC_API_URL` path logic.
- Done criteria:
  - Billing links/API-dependent actions work under docker/default env.
  - No runtime `undefined` base URL behavior.

### Step 3 — Validate and lock provider/fallback chain
- Scope: verify provider registry + noop + deterministic fallback paths for AI-safe and assistant flows.
- Done criteria:
  - AI endpoints return deterministic safe outputs when provider unavailable.
  - No unhandled exceptions in AI routes for provider outages.

### Step 4 — Enforce and verify owner safety policy contract
- Scope: hard-check owner policy behavior for treatment/dosage requests.
- Done criteria:
  - Owner-prohibited prompts return `422 POLICY_VIOLATION`.
  - Allowed owner-safe prompts still produce structured responses.

### Step 5 — Verify AI control plane governance path
- Scope: ensure control-plane read/write applies to runtime routing and guardrails.
- Done criteria:
  - `/platform/ai/control-plane` read/write works.
  - Runtime reflects configured provider/limits/budget behavior.

### Step 6 — Vet assistant endpoint contract verification
- Scope: validate `/ai/transcribe`, `/ai/visit-structure`, `/ai/lab-explain` request/response and fallback behavior.
- Done criteria:
  - All three endpoints return valid structured payloads under normal and fallback paths.

### Step 7 — Frontend AI integration verification and minimal fixes
- Scope: ensure owner triage UI and platform AI page correctly handle backend contracts/errors.
- Done criteria:
  - Owner triage path works end-to-end.
  - Platform AI page loads/saves without breaking states.

### Step 8 — AI-focused regression tests
- Scope: add/update backend + (if needed) frontend tests covering safety, fallback, and control-plane behavior.
- Done criteria:
  - Test suite includes AI safety and fallback regression coverage.
  - Local run passes for modified test scopes.

### Step 9 — Documentation/runbook update
- Scope: update AI setup and operational docs for env vars, fallback behavior, and safety constraints.
- Done criteria:
  - Clear run instructions for provider setup and safe fallback.
  - Clear statement of owner safety policy and expected error contracts.

### Step 10 — Final integration validation
- Scope: full verification pass after all AI changes.
- Done criteria:
  - `docker compose up --build` succeeds.
  - `/health` is 200.
  - `/docs` accessible.
  - AI key paths manually validated (owner triage, safe explain, vet assistant, control plane).

---

## 4) Step completion output format (fixed)
- Step N completed.
- What exactly was implemented.
- What can be manually verified now.
- Next step.

---

## 5) NE TROGAT (Out of AI scope, do not modify)
- Non-AI UX localization tasks and unrelated owner page copy/layout.
- Non-AI business modules: pharmacy/catalog/marketplace behavior unless they directly break AI steps.
- RBAC/consent domain rules outside AI route execution path.
- Broad refactors or architecture rewrites not required by listed steps.
- Legacy directory cleanup (`ai 2`, `integrations 2`) unless explicitly approved as a dedicated step.

---

## 6) Plan immutability rule
- This document is the single baseline execution plan.
- No architecture or step-order changes without explicit user approval.
- No new side quests unless they block the active step.
