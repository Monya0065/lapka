# Lapka Backend

## Quick start

```bash
cp .env.example .env
pip install -r requirements.txt
alembic upgrade head
python -m src.seed
uvicorn src.main:app --reload
```

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
