# Lapka Production-Grade Audit and Master Plan

**Date:** 2026-03-08  
**Scope:** Full-stack veterinary medical platform — production readiness assessment

---

## 1. EXECUTIVE SUMMARY

Lapka is a veterinary digital ecosystem MVP with solid foundations: FastAPI backend, Next.js App Router frontend, PostgreSQL, JWT auth, RBAC, consent-scoped access, and audit logging. The domain model covers pets, visits, documents, appointments, inpatient, marketplace, billing, growth mechanics (QR passport, lost pets, referrals). AI features include triage, document explanation, and visit structuring with safety guards.

**Key gaps to production:** UI/UX layout instability, missing i18n, no real LLM integration, limited medical file handling, notification architecture (in-app only), non-interactive calendar, and several production hardening items.

---

## 2. DETAILED AUDIT

### 2.1 Backend

| Area | Status | Notes |
|------|--------|------|
| Auth | ✅ | JWT access + refresh, sessions, role enum (owner/vet/clinic_admin/network_admin) |
| RBAC | ✅ | require_roles, enforce_pet_scope, consent checks |
| Consent | ✅ | PRESCRIPTIONS_ONLY → CAMERA_VIEW hierarchy, consent requests, audit |
| Audit | ✅ | log_audit for key actions (login, consent, document, visit, public links, camera) |
| Documents | ⚠️ | Metadata + file_ref only; no multipart upload, no DICOM/imaging support |
| PDF | ⚠️ | Raw PDF stream (visits, invoices); no templating, no UTF-8 handling |
| AI | ⚠️ | Rule-based triage, template-based visit structuring; no LLM provider |
| Notifications | ⚠️ | In-app only; no email/SMS/push, no queue, no preferences |
| Appointments | ✅ | CRUD, slots, check-in, status transitions |
| Inpatient | ✅ | Stays, events, photos, camera token, audit |
| Public links / QR | ✅ | TTL, revoke, prescription/document/pet passport tokens |
| File storage | ⚠️ | Local paths (storage/, INPATIENT_UPLOAD_DIR); no S3/object storage |
| Rate limiting | ✅ | Global public/market/lost-pets |
| CSRF | ✅ | Origin + x-csrf-token for mutations |
| Security headers | ✅ | X-Content-Type-Options, X-Frame-Options, etc. |

### 2.2 Frontend

| Area | Status | Notes |
|------|--------|------|
| Next.js App Router | ✅ | 14.2, App Router |
| Layouts | ⚠️ | AppLayout with TopNav + Sidebar + rightColumn; grid can break on resize |
| Owner sidebar | ⚠️ | Links to /owner/records, /owner/documents etc.; no pet switcher or multi-pet nav |
| Vet/Clinic layouts | ⚠️ | Similar structure; sidebar links fixed |
| Pet cards | ⚠️ | Horizontal cards; many small elements, text overflow issues |
| i18n | ❌ | None; all strings hardcoded (RU/EN mix) |
| Responsiveness | ⚠️ | Tailwind grid; breakpoints exist but layout instability reported |
| Pet navigation | ⚠️ | /owner/pet/[id]/...; need to go via /owner/pets first; no pet dropdown in pet pages |
| Home/back | ⚠️ | Top links include "Главная"; post-login flow unclear |
| Empty/loading states | ✅ | Skeleton, EmptyState, ErrorBanner |

### 2.3 Database

| Area | Status | Notes |
|------|--------|------|
| Schema | ✅ | UUID PKs, indexes, consent/audit tables |
| Migrations | ✅ | Alembic 001–019; consistent structure |
| Document model | ⚠️ | doc_type, file_ref; no mime_type, file_size, imaging metadata |
| Notification model | ✅ | user_id, type, title, body, metadata_json, is_read |

### 2.4 Docker / Infra

| Area | Status | Notes |
|------|--------|------|
| docker-compose | ✅ | db, api, frontend, backup profile |
| Healthchecks | ✅ | pg_isready, API /health |
| Secrets | ⚠️ | JWT_SECRET in env; no external secrets manager |
| Production config | ⚠️ | CORS only localhost; no Sentry, no structured logging target |

### 2.5 AI / LLM

| Area | Status | Notes |
|------|--------|------|
| Triage | ✅ | Rule-based RED/YELLOW/GREEN, policy violation check |
| Visit structuring | ⚠️ | Template-based; first sentence → complaints, static hints |
| Lab explain | ⚠️ | Likely template; no real LLM |
| Transcription | ⚠️ | transcribe_audio_file present; implementation unclear |
| Safety guard | ✅ | apply_safety_guard, DISALLOWED_OWNER_PATTERNS |
| Provider abstraction | ❌ | No OpenAI/Anthropic/etc. integration |

### 2.6 Medical Documents & Files

| Area | Status | Notes |
|------|--------|------|
| Upload | ⚠️ | upload-metadata with file_ref; no multipart binary upload |
| Supported formats | ❌ | No explicit PDF/PNG/JPG/DICOM handling |
| DICOM / imaging | ❌ | Not implemented |
| Preview | ❌ | Document viewer not production-grade |
| Versioning | ❌ | None |
| Object storage | ❌ | Local filesystem only |

### 2.7 Calendar & Appointments

| Area | Status | Notes |
|------|--------|------|
| API | ✅ | slots, create, confirm, cancel, check-in |
| Frontend calendar | ⚠️ | Monthly view; not interactive (no drag-drop, no create from calendar) |
| Doctor schedule | ✅ | doctor-schedules endpoints |
| Filters | ⚠️ | Backend supports; frontend filters limited |

### 2.8 Notifications

| Area | Status | Notes |
|------|--------|------|
| In-app | ✅ | create_notification, list, mark read |
| Email | ❌ | None |
| SMS | ❌ | None |
| Push | ❌ | None |
| Preferences | ❌ | None |
| Templates | ❌ | Ad-hoc title/body |
| Queue / async | ❌ | Sync create in request path |

### 2.9 QR & PDF

| Area | Status | Notes |
|------|--------|------|
| QR passport | ✅ | Generate, revoke, public token |
| Public prescription | ✅ | Token, TTL, revoke |
| Visit PDF | ✅ | Raw PDF stream |
| Invoice PDF | ✅ | Raw PDF stream |
| PDF quality | ⚠️ | Basic; no branding, no UTF-8 Cyrillic properly |

### 2.10 Security Risks

- **JWT_SECRET** in plain env — should use secrets manager in prod
- **Document file_ref** — path traversal risk if not validated
- **Public token enumeration** — rate limit helps; consider signed tokens
- **CORS** — only localhost; prod origins must be configurable
- **network_admin** — exists but no dedicated super-admin UI/flow

### 2.11 Production Gaps

- No Sentry/error monitoring
- No structured logging aggregation
- No metrics export (Prometheus/StatsD)
- No rate limit per user (only global public)
- No data export/import flows
- No soft delete / archival strategy
- No file retention policy
- No onboarding/empty-state guidance
- No accessibility audit (a11y)

---

## 3. PROBLEMS LIST (PRIORITIZED)

### Critical
1. **No i18n** — all UI strings hardcoded; RU/EN mix
2. **Layout instability** — grid/cards overflow on resize; weak breakpoints
3. **Owner multi-pet navigation** — no pet switcher in sidebar; must go via /owner/pets
4. **Post-login navigation** — unclear home/back; top nav redundant or confusing
5. **Document handling** — metadata-only; no multipart upload, no DICOM/imaging

### High
6. **AI not LLM-based** — triage/visit structuring are rules; need provider abstraction
7. **Notifications** — in-app only; no email/SMS/push, no queue
8. **Calendar** — not interactive (no drag-drop, no create from UI)
9. **PDF** — raw streams; no templating, poor Cyrillic support
10. **File storage** — local only; no S3/object storage strategy

### Medium
11. **Visual hierarchy** — too many small cards; long texts; weak hierarchy
12. **Responsiveness** — desktop-first; tablet/mobile needs verification
13. **Role super_admin** — network_admin exists; no explicit super_admin
14. **Audit scope** — some actions may not be logged
15. **Observability** — no Sentry, no metrics

### Low
16. **Offline/PWA** — present but not fully validated
17. **Drug/reference DB** — demo data; no real formularies
18. **Speech-to-text** — stub; needs real ASR provider

---

## 4. MISSING FEATURES

- i18n (ru/en) with language switcher
- Multi-pet switcher in owner pet context
- Multipart document upload (binary)
- DICOM / medical imaging viewer (e.g. Cornerstone.js)
- Object storage (S3/MinIO) for files
- Email/SMS/push notifications + queue
- Notification preferences
- Interactive calendar (FullCalendar or similar)
- LLM provider integration (OpenAI/Anthropic)
- Real-time protocol assistance (suggestions while typing)
- Speech-to-text for vet dictation
- External drug/symptom reference integration
- Data export (GDPR-style)
- Admin dashboard for network_admin
- Accessibility improvements (a11y)

---

## 5. ARCHITECTURE PLAN

### 5.1 File Storage Strategy

- **Dev:** Local `storage/` with multipart upload
- **Prod:** S3-compatible (AWS S3, MinIO) with signed URLs
- **Documents:** `documents/{pet_id}/{doc_id}.{ext}`; metadata in DB
- **Imaging:** Store DICOM/PNG; serve via CDN or signed URL; viewer client-side (Cornerstone3D)

### 5.2 Notification Architecture

- **Event bus:** Application events (appointment_created, visit_finalized, etc.)
- **Notification service:** Consumes events; resolves user prefs; enqueues to channel queues
- **Channels:** In-app (DB), email (SendGrid/SES), SMS (Twilio), push (FCM)
- **Queue:** Redis/RabbitMQ or SQS for async delivery
- **Templates:** Jinja2 or similar; per channel, per type

### 5.3 AI / LLM Layer

- **Provider abstraction:** `LLMProvider` interface; implementations: OpenAI, Anthropic, local
- **Use cases:** Triage (structured output), visit structuring, lab explain, protocol suggestions
- **Safety:** Always apply safety_guard; clinician-in-the-loop for high-risk
- **Audit:** Every AI request logged with action_type, model, tokens

### 5.4 PDF Generation

- **Library:** WeasyPrint (HTML→PDF) or ReportLab for complex layouts
- **Templates:** Jinja2 HTML; separate template per document type
- **UTF-8:** Embed fonts; ensure Cyrillic support

---

## 6. UI/UX PLAN

### 6.1 Layout Redesign

- **Replace small cards** with larger rectangular blocks
- **Stable grid:** `min-w-0` to prevent overflow; `overflow-hidden` on text
- **Breakpoints:** sm (640), md (768), lg (1024), xl (1280); test tablet (768–1024)
- **Sidebar:** Sticky; collapsible on mobile
- **Top nav:** Simplify; after login show: Logo | Role Dashboard | Notifications | Profile

### 6.2 Navigation

- **Home:** Always link to role dashboard (/owner/dashboard, /vet/dashboard, /clinic/dashboard)
- **Back:** Breadcrumbs or back button on detail pages
- **Owner pet context:** Add pet switcher dropdown when in /owner/pet/[id]/* routes
- **Sidebar:** Owner sidebar: Dashboard, Pets (list), Appointments; under "Pets" sub-nav or switcher for current pet

### 6.3 Information Architecture

- **Owner:** Main (Dashboard, Pets, Appointments) | Medical (Records, Documents, Inpatient) | Tools (Triage, Pharmacy, Calculators) | Settings
- **Vet:** Main | Patients | Appointments | Visits | Documents | Labs | Inpatient | Tools
- **Clinic admin:** Main | Schedule | Check-in | Billing | Analytics | Audit | Settings

### 6.4 Visual Hierarchy

- **Primary actions** — one per block; high contrast
- **Secondary actions** — in overflow menu (⋯)
- **Reduce text** — shorten labels; tooltips for long content
- **Consistent spacing** — 4/6/8 scale

---

## 7. AI/LLM PLAN

### 7.1 Provider Abstraction

```
LLMProvider (interface)
  - complete(prompt, system, max_tokens) -> str
  - complete_structured(prompt, schema) -> dict

Implementations: OpenAIClient, AnthropicClient, NoOpClient (rules fallback)
```

### 7.2 Use Cases

| Use Case | Role | Safety | Implementation |
|----------|------|--------|----------------|
| Triage | owner | Block treatment requests | LLM + rule fallback |
| Document explain | owner/vet | Safe summary only | LLM + guard |
| Visit structure | vet | Vet context | LLM + guard |
| Lab explain | vet | Vet context | LLM + guard |
| Protocol suggestions | vet | Suggestions only | LLM, clinician review |
| Speech→structured note | vet | Vet context | ASR + LLM |

### 7.3 OpenVet / AAVSB Alignment

- Clinician-in-the-loop for high-risk outputs
- Explicit uncertainty disclosure
- No diagnosis/treatment to owner
- Traceability (audit logs)

---

## 8. FILES/MODULES TO CHANGE

### Phase 2 (Critical)

**Frontend:**
- `frontend/package.json` — add i18next, react-i18next
- `frontend/` — new `locales/ru/`, `locales/en/`
- `frontend/` — i18n config, provider
- `frontend/components/layouts/AppLayout.jsx`
- `frontend/components/layouts/OwnerLayout.jsx`
- `frontend/components/layouts/VetLayout.jsx`
- `frontend/components/layouts/ClinicLayout.jsx`
- `frontend/components/ui/Sidebar.jsx`
- `frontend/components/ui/TopNavigation.jsx`
- `frontend/components/ui/OwnerPetTabs.jsx` — add pet switcher
- `frontend/app/owner/pet/[id]/layout.jsx` — pet context + switcher
- `frontend/app/owner/dashboard/page.jsx`
- `frontend/app/owner/pets/page.jsx`
- `frontend/styles/` — layout fixes, breakpoints
- Key pages: replace hardcoded strings with t()

**Backend:** None for Phase 2 (i18n is frontend-only for UI)

### Phase 3

- `backend/src/api/routes/documents.py` — multipart upload
- `backend/src/models/entities.py` — document metadata
- New migration — document fields
- `backend/` — file storage service (local + S3 adapter)
- `frontend/` — document upload component, viewer
- `backend/src/services/notifications.py` — extend for channels
- `backend/` — notification queue, templates
- `frontend/` — FullCalendar or similar
- `backend/` — QR/PDF improvements

### Phase 4

- `backend/` — LLM provider module
- `backend/src/services/ai_safe.py` — integrate LLM
- `backend/src/ai_assistant/` — visit structuring, lab explain
- `frontend/` — protocol form with suggestions

### Phase 5

- Sentry, metrics
- Production config
- Security hardening

---

## 9. ROADMAP BY STAGES

### Stage 1 — Audit ✅
- Audit complete (this document)
- Problem list, missing features, plans defined

### Stage 2 — Critical Fixes
- i18n foundation (ru/en)
- Layout stability (grid, overflow, breakpoints)
- Navigation (home, back, pet switcher)
- Multi-pet owner flows
- Role-based navigation clarity

### Stage 3 — Documents, Calendar, Notifications, QR/PDF
- Multipart document upload
- File storage adapter (local + S3-ready)
- DICOM/imaging viewer strategy
- Interactive calendar
- Notification architecture (queue, templates, email stub)
- PDF templating (WeasyPrint)
- QR improvements

### Stage 4 — AI/LLM
- Provider abstraction
- Triage/visit-structure with LLM
- Protocol assistance (suggestions)
- Speech-to-text integration point
- Safety guard enhancements

### Stage 5 — Production Hardening
- Sentry, metrics
- Rate limit per user
- Secrets management
- Observability
- Accessibility
- Final QA

---

## 10. REFERENCES

- OpenVet Veterinary AI Safety Charter (Jan 2026)
- AAVSB AI Guidance Whitepaper (Mar 2025)
- VetCalc Hub, Calf Health Scorer — clinical calculators
- Cornerstone3D — DICOM viewer
- FullCalendar — scheduling
- react-i18next + next-i18n-router — i18n for App Router
- WeasyPrint — PDF from HTML
- Vetspire, Instinct — vet EMR UX patterns
