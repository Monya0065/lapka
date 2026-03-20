# Lapka Modules Catalog (Release Candidate)

## Backend modules (`backend/src`)

### Platform core

- `api/` — FastAPI routers mounted under `/api/v1`
- `core/` — config, logging, shared errors, app wiring
- `db/` — database session and migration helpers
- `models/` — SQLAlchemy models (RBAC, consent, medical, CRM, marketplace)
- `schemas/` — Pydantic request/response contracts
- `repositories/` — DB access layer
- `services/` — business logic (auth, consent checks, workflows)
- `security/` — JWT, role checks, consent enforcement, guards

### Domain/API modules

- `auth` — register/login/refresh/logout/me
- `pets` — owner and clinic pet access
- `patient_search` — clinic-grade search with masking before consent
- `consents` — grant/revoke/access scopes and requests
- `visits` — visit lifecycle (create/start/finalize/export)
- `documents` — upload/view/download + safe explain flows
- `appointments` — booking/check-in/status transitions
- `inpatient` — stays/events/photos/camera token flow
- `public_links` — tokenized public prescription links (TTL/revoke)
- `notifications` — in-app notification center
- `audit` — append-only event listing/filtering
- `services` / `clinic_suite` — clinic services, invoices, payments, insurance, labs
- `market` / `reviews` — clinics/vets discovery, ratings and moderation
- `drugs` / `catalog` / `diseases` / `medical_engine` / `calculators` — knowledge and clinical tooling
- `places` — map/place discovery
- `growth` — pet passport, lost pets, referrals, clinic invites
- `system` — health/metrics support endpoints
- `ai_safe` + `ai_assistant` — triage/document/note assist with safety guard

### Integrations (adapter-based)

- `integrations/payments_providers/` — payment provider interface + `demo` provider
- `integrations/labs_providers/` — lab provider interface + `demo` provider
- `integrations/pharmacy_providers/` — pharmacy availability interface + `demo` provider

## Frontend modules (`frontend/app`)

### Marketing/public

- `/(marketing)` — landing, about, role pages, pricing, faq, security, map, public passport
- `public-rx/[token]` — public token-based prescription page
- `login` — auth entry with Demo Mode helpers

### Owner app

- `owner/dashboard`, `owner/pets`, `owner/pet/[id]`
- `owner/pet/[id]/records|documents|consents|passport|inpatient`
- `owner/appointments`, `owner/appointments/new`, `owner/appointment/[id]`
- `owner/calendar`, `owner/triage`, `owner/map`, `owner/market`, `owner/pharmacy`, `owner/drugs/[id]`
- `owner/billing`, `owner/insurance`, `owner/notifications`, `owner/referrals`, `owner/requests`, `owner/profile`

### Vet app

- `vet/dashboard`, `vet/patients`, `vet/patient/[id]`
- `vet/visit/[id]`, `vet/documents`, `vet/labs`, `vet/inpatient`, `vet/inpatient/[stayId]`
- `vet/appointments`, `vet/assistant`, `vet/drugs`, `vet/drugs/[id]`, `vet/tools`

### Clinic admin app

- `clinic/dashboard`, `clinic/schedule`, `clinic/checkin`
- `clinic/doctors`, `clinic/patients`, `clinic/services`, `clinic/templates`
- `clinic/billing`, `clinic/billing/[id]`, `clinic/analytics`, `clinic/audit`
- `clinic/inpatient`, `clinic/inpatient/[stayId]`, `clinic/insurance`, `clinic/invites`

### Shared frontend system

- `components/layouts` — role layouts/topbar/sidebar composition
- `components/ui` — design system components (cards, tabs, toasts, helper widgets)
- `components/drugs` and `components/blocks` — feature components
- `lib` — API client, auth helpers, constants, demo mode data

## Safety-critical constraints

- Owner-facing AI output is triage/explanation only, no treatment instructions.
- Vet/admin access to medical records is consent-scoped and audited.
- Public token pages expose minimum safe fields only.
