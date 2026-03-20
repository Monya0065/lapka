# Phase 4 & 5 Implementation Summary

## Phase 4: AI/LLM Integration

### Provider Abstraction
- **`backend/src/ai/`** — new module
  - `providers/base.py` — `LLMProvider` interface (complete, is_available)
  - `providers/noop.py` — rule-based fallback, no external calls
  - `providers/openai_provider.py` — OpenAI API (when `OPENAI_API_KEY` set)
  - `providers/registry.py` — resolves provider from `LLM_PROVIDER` env (noop | openai)

### Integration Points
- **visit_structuring.py** — uses LLM when available to extract SOAP fields from transcript
- **lab_explainer.py** — uses LLM when available for lab text summary
- **ai_safe.structure_notes** — uses LLM when available for protocol suggestions

### New Endpoint
- `GET /api/v1/ai/provider-status` — returns active provider name and availability (vet/admin only)

### Configuration
- `LLM_PROVIDER=noop` (default) or `openai`
- `OPENAI_API_KEY` — required for OpenAI
- `OPENAI_MODEL` — optional, default `gpt-4o-mini`

### Dependencies
- `openai>=1.0.0` added to requirements.txt

---

## Phase 5: Production Hardening

### Config
- `CORS_ORIGINS` — comma-separated extra origins (e.g. `https://app.lapka.io`)
- `SENTRY_DSN` — optional Sentry DSN
- `SENTRY_ENVIRONMENT` — optional, default `development`

### CORS
- Base origins: `localhost:3000`, `127.0.0.1:3000`
- Additional origins from `CORS_ORIGINS` env

### Sentry
- When `SENTRY_DSN` is set, initializes Sentry with FastAPI integration
- `traces_sample_rate=0.1`, `send_default_pii=False`
- Graceful skip if `sentry-sdk` not installed

### Dependencies
- `sentry-sdk[fastapi]>=1.40.0` added to requirements.txt

---

## Files Changed

| File | Change |
|------|--------|
| `backend/requirements.txt` | openai, sentry-sdk |
| `backend/src/core/config.py` | cors_origins, sentry_dsn, sentry_environment |
| `backend/src/main.py` | CORS from env, Sentry init |
| `backend/src/ai/__init__.py` | New |
| `backend/src/ai/providers/__init__.py` | New |
| `backend/src/ai/providers/base.py` | New |
| `backend/src/ai/providers/noop.py` | New |
| `backend/src/ai/providers/openai_provider.py` | New |
| `backend/src/ai/providers/registry.py` | New |
| `backend/src/ai_assistant/visit_structuring.py` | LLM integration |
| `backend/src/ai_assistant/lab_explainer.py` | LLM integration |
| `backend/src/services/ai_safe.py` | structure_notes LLM |
| `backend/src/api/routes/ai_safe.py` | provider-status endpoint |
