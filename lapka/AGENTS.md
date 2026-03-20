# AGENTS.md — Lapka (Codex Operating Guide)

## 0) Purpose
This file defines how we work in this repository.
Goal: produce a working, secure MVP of **Lapka** — a veterinary digital ecosystem.

**Hard safety rule:** never generate treatment instructions or drug dosages for pet owners.
AI features are limited to triage urgency, document explanation, and vet note structuring.

## 1) Repo layout
Backend is authoritative for domain rules (RBAC, consent, audit).

## 2) Definition of Done (DoD)
A task is done only when:
- `docker compose up --build` starts successfully
- backend `/health` returns 200
- swagger docs available (`/docs`)
- database migrations apply cleanly
- seed data loads idempotently
- role access is enforced (owner/vet/admin)
- consent is enforced on pet/visit/document/inpatient reads
- audit events are written for key actions

## 3) Engineering priorities
1. Correctness & security (RBAC, consent, audit, validation)
2. Deterministic, testable code
3. Clear structure (services/repositories separation)
4. Good UX wiring (role dashboards)
5. Performance (indexes, pagination)

## 4) Core domain rules
### Roles
- `owner`: owns pets; can view own data; can grant/revoke consent
- `vet`: clinic member; can create visits; can view pet history only with active consent
- `clinic_admin`: clinic member; manages operations; **read-only medical**

### Consent scopes
- `PRESCRIPTIONS_ONLY`
- `BASIC_MEDICAL`
- `FULL_RECORD`
- `INPATIENT_VIEW`
- `CAMERA_VIEW` (requires inpatient active + INPATIENT_VIEW)

### Consent enforcement
For `vet` and `clinic_admin` on pet profile, visits, documents, inpatient:
1) membership in clinic
2) active consent for pet + clinic
3) required scope

### Audit
Append-only events for:
- login/logout/refresh
- consent grant/update/revoke
- document upload/view/download
- visit create/update/finalize
- public link create/view/revoke
- camera token issue/view

## 5) AI rules
- Reject owner requests for treatment/dose/injection/steps
- Return `422 POLICY_VIOLATION` + safe message
- Triage returns only GREEN/YELLOW/RED + reasons + questions + next steps
- Document explanation returns safe summary + questions for vet

## 6) Backend architecture
- Routers call services
- Services call repositories
- Repositories contain DB operations
- No business logic in routers

## 7) Database
- UUID PKs
- timestamps on major entities
- unique active appointment slot `(vet_id, start_at)`
- index active consents
- audit/access logs partition-ready (MVP can be non-partitioned)

## 8) Frontend requirements
- Separate dashboards per role
- Client-side role guards
- Tabs for large sections
- Owner supports multiple pets + photo preview

## 9) Task execution protocol
1) Backend endpoints + tests
2) DB changes + migrations
3) Seed updates
4) Frontend wiring
5) Run tests/lints and `docker compose up --build`

## 10) Mandatory tests
- RBAC denies
- consent denies
- appointment conflict 409
- public link expired/revoked denies
- audit events on document view

## 11) Seed scenario
Must include:
- Clinic “Lapka Demo Clinic”
- owner, vet, clinic_admin
- Pet “Барсик”
- Active consent for clinic
- One visit
- One document metadata
- One active inpatient stay + cameras
- One public prescription link

## 12) Run commands
- `docker compose up --build`
- `GET http://localhost:8000/health`
- `http://localhost:8000/docs`

## 13) Ambiguity rule
Prefer safest behavior:
- deny by default (403)
- missing consent = no access
- AI fallback = “contact veterinarian”
