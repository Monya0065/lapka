# Lapka Product QA Report

**Date:** 2026-03-07  
**Environment:** local Docker (`docker compose`)  
**Scope:** runtime + API + role permissions + seed consistency + UI clickability audit for Owner/Vet/Admin modules.

## 1) Runtime verification

### Commands executed

```bash
docker compose up --build -d
docker compose ps
curl -i http://localhost:8000/health
curl -I http://localhost:8000/docs
curl -I http://localhost:3000/login
```

### Result

- API container: `healthy`
- DB container: `healthy`
- Frontend container: `up`
- `/health`: `200 OK`
- Swagger `/docs`: `200 OK`
- Frontend `/login`: `200 OK`

## 2) Seed consistency verification

### SQL checks

```sql
SELECT count(*) FROM master_pets;      -- 100
SELECT count(*) FROM visits;           -- 528
SELECT count(*) FROM documents;        -- 831
SELECT count(*) FROM inpatient_stays;  -- 8
SELECT count(*) FROM invoices;         -- 120
```

### Idempotency

- API service restarted and counts rechecked.
- Counts remained unchanged.
- Seed is idempotent in current environment.

## 3) Modules audit

Legend:
- `OK` = endpoint/page returns expected success
- `PARTIAL` = works, but has caveat
- `BROKEN` = failed in current build

### Owner

| Module | Verification | Status |
|---|---|---|
| Pets | `GET /api/v1/pets` = 200 | OK |
| Medical records | `GET /api/v1/visits?pet_id=...` = 200 | OK |
| Documents | `GET /api/v1/documents?pet_id=...` = 200 | OK |
| Appointments | `GET /api/v1/appointments` = 200 | OK |
| Pharmacy | `GET /api/v1/drugs?q=...` = 200 | OK |
| Calculators | `GET /api/v1/calculators` = 200 | OK |
| QR passport | `GET /api/v1/owner/pets/{id}/passport` = 200 | OK |
| Insurance | `GET /api/v1/owner/insurance/policies` = 200 | OK |
| Billing | `GET /api/v1/owner/invoices` = 200 | OK |
| Inpatient | `GET /api/v1/inpatient/owner/inpatient` = 200 | OK |
| Map nearby | `GET /api/v1/places?type=clinic` = 200 | OK |
| Triage | `POST /api/v1/ai/triage` = 200 | OK |

### Vet

| Module | Verification | Status |
|---|---|---|
| Patient search | `GET /api/v1/clinic/search/patients` = 200 | OK |
| Visit creation | `POST /api/v1/visits` with `pet_id + clinic_id` = 201 | OK |
| Protocol generation | `POST /api/v1/ai/visit-structure` = 200 | OK |
| PDF export | `GET /api/v1/visits/{id}/export/pdf` = 200 | OK |
| Lab results | `GET /api/v1/vet/labs/orders` = 200 | OK |
| Inpatient updates | `POST /api/v1/inpatient/stays/{id}/events` = 201 | OK |

### Clinic Admin

| Module | Verification | Status |
|---|---|---|
| Schedule | `GET /api/v1/appointments` = 200 | OK |
| Doctors | `GET /api/v1/clinics/me/members` = 200 | OK |
| Services | `GET /api/v1/clinic/services` = 200 | OK |
| Billing | `GET /api/v1/clinic/invoices` = 200 | OK |
| Analytics | `GET /api/v1/clinic/analytics/summary` = 200 | OK |
| Audit logs | `GET /api/v1/audit` = 200 | OK |

## 4) Role permissions / security checks

| Rule | Check | Result |
|---|---|---|
| owner cannot open vet data | owner token -> `GET /api/v1/clinic/search/patients...` | 403 (OK) |
| vet cannot open admin mutation | vet token -> `POST /api/v1/clinic/services` | 403 (OK) |
| admin cannot read pet without consent | admin token -> `GET /api/v1/pets/{no_consent_pet}` | 403 (OK) |
| frontend guard vet->clinic | browser redirect `/clinic/*` as vet | redirected to `/vet/dashboard` (OK) |
| frontend guard admin->owner | browser redirect `/owner/*` as admin | redirected to `/clinic/dashboard` (OK) |

## 5) UI clickability audit (dead buttons)

### What was done

- E2E suite executed (`frontend/tests/e2e/*`) including role flows.
- Manual click-through performed across key role routes:
  - Owner: dashboard, pets, appointments, pharmacy, calculators, inpatient, map.
  - Vet: dashboard, patients, visit workspace, labs, inpatient.
  - Admin: dashboard, schedule, services, billing, analytics, audit.

### Result

- No critical dead CTA found on active Next.js role pages.
- Buttons in audited flows are either:
  - wired to backend actions/navigation, or
  - contextually disabled by state (e.g. missing required form data).

### Note

- Legacy static files under `frontend/pages/*.html` are not used in the active Next.js app runtime and were excluded from production QA verdict.

## 6) Frontend route availability check

All checked UI routes returned `HTTP 200` from frontend server:

- `/login`
- `/owner/dashboard`, `/owner/pets`, `/owner/appointments`, `/owner/pharmacy`, `/owner/tools/calculators`, `/owner/insurance`, `/owner/billing`, `/owner/inpatient`, `/owner/map`, `/owner/triage`
- `/vet/patients`, `/vet/visit/{id}`, `/vet/labs`, `/vet/inpatient`
- `/clinic/schedule`, `/clinic/doctors`, `/clinic/services`, `/clinic/billing`, `/clinic/analytics`, `/clinic/audit`

## 7) Automated tests

### Backend

```bash
cd backend
python3 -m pytest -q
```

Result: `15 passed`.

### Frontend E2E

```bash
cd frontend
npm run test:e2e
```

Result: passed in current environment.

## 8) Final status summary

### Modules working

- All requested Owner/Vet/Admin modules are working in current build.

### Modules broken

- None critical in audited scope.

### Modules missing

- None from the requested checklist.

### Non-blocking observations

- Next.js build shows lint warnings (`react-hooks/exhaustive-deps`, `next/no-img-element`) that do not block runtime, but should be cleaned in hardening pass.
