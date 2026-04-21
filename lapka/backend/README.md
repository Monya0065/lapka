# Lapka Backend

## Quick start

```bash
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
python -m src.seed
uvicorn src.main:app --reload
```

## Tests

- Recommended: Python **3.12** + venv: `python3.12 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- **Unit-only (no Docker):** `LAPKA_SKIP_INTEGRATION=1 python -m pytest -q`
- **Full suite:** start the stack (`docker compose up --build` from repo root), then `python -m pytest -q` from `backend/`. If the API is down, integration tests are **skipped** locally (not failed); CI sets `LAPKA_REQUIRE_API=1` so missing API fails the job.
- **Tune API wait:** `LAPKA_API_WAIT_SEC` (default `25`). **Strict CI-style exit:** `LAPKA_REQUIRE_API=1`.

## LLM (free tier)

- **YandexGPT (Russia-friendly):** `LLM_PROVIDER=yandexgpt` + `YANDEX_CLOUD_API_KEY` + `YANDEX_CLOUD_FOLDER_ID` from [Yandex Cloud](https://console.yandex.cloud/) (Foundation Models / YandexGPT enabled for the folder). Optional `YANDEXGPT_MODEL` (default `yandexgpt-lite/latest`). Alternatively set `YANDEX_CLOUD_IAM_TOKEN` (short-lived `Bearer`) instead of the API key.
- **Groq:** set `LLM_PROVIDER=groq` and `GROQ_API_KEY` (https://console.groq.com/). Optional `GROQ_MODEL` (default `llama-3.3-70b-versatile`). Uses the official `openai` Python package against Groq’s OpenAI-compatible endpoint. **GroqCloud is not served from several regions** (including Russia): you will get **`403 Forbidden`** — use **YandexGPT**, **Ollama**, or **OpenAI**.
- **Ollama (local):** run `ollama serve`, then `LLM_PROVIDER=ollama` and `OLLAMA_BASE_URL=http://127.0.0.1:11434` (from Docker API use `http://host.docker.internal:11434` on macOS/Windows).
- **OpenAI:** `LLM_PROVIDER=openai` + `OPENAI_API_KEY`. If nothing is configured, routing falls back to **noop** (rule-based / empty completions where applicable).

## API base

`/api/v1`

## Implemented domains

- auth
- consents
- pets
- visits
- documents
- inpatient
- audit
- catalog
- ai-safe
- medical-engine

## Medical engine endpoints

### Symptoms and triage

- `GET /api/v1/medical/symptoms`
- `GET /api/v1/medical/symptoms/red-flags`
- `POST /api/v1/medical/triage`

### Vet AI Assistant (new)

- `POST /api/v1/ai/transcribe` (multipart `audio_file`: wav/mp3/m4a, vet only)
- `POST /api/v1/ai/visit-structure` (vet only)
- `POST /api/v1/ai/lab-explain` (vet only)
- All outputs pass through `safety_guard`.
- Every AI request is written to `audit_events` with `action_type`.

### Disease and medication reference

- `GET /api/v1/medical/diseases` (vet only)
- `GET /api/v1/medical/medications` (vet/clinic_admin/network_admin)

### Veterinary calculators

- `POST /api/v1/medical/calculators/rer`
- `POST /api/v1/medical/calculators/der`
- `POST /api/v1/medical/calculators/fluid-therapy`
- `POST /api/v1/medical/calculators/drug-dosage`
- `POST /api/v1/medical/calculators/transfusion`

### Visit protocol generator

- `GET /api/v1/medical/visit-protocols/{visit_id}`
- `GET /api/v1/medical/visit-protocols/{visit_id}/pdf-structure`

## Safety rules

- AI endpoints do not return diagnosis as fact and do not prescribe treatment.
- Owner requests asking for dosage/treatment/injections are blocked with `422 POLICY_VIOLATION`.
- Public QR links return only limited prescription/document payload with TTL + revoke.
