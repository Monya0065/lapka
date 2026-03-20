# Lapka Release Notes — RC1 (2026-03-07)

## Scope

This release candidate prepares Lapka for demo and stabilization before GA.

## Included in RC1

- Consolidated frontend to Next.js App Router runtime-only implementation.
- Demo Mode improvements:
  - credentials on login
  - guided scenarios for owner/vet/clinic_admin
  - floating "Try demo actions" helper
- Role dashboards and route groups verified:
  - owner
  - vet
  - clinic_admin
- Core backend domain modules verified:
  - auth, RBAC, consent
  - visits, documents, appointments, inpatient
  - billing, insurance, labs, analytics
  - marketplace, pharmacy, growth, notifications, audit
- Documentation refresh:
  - module catalog
  - docs index
  - release-candidate quick start

## Cleanup done

- Removed legacy static prototype frontend layer:
  - `frontend/index.html`
  - `frontend/pages/*.html`
  - `frontend/js/app.js`
  - duplicate `frontend/assets/*`
- Kept only active Next.js frontend sources.

## Validation snapshot

- Backend tests: `15 passed`
- Frontend production build: success (warnings only)
- Backend routes available in Swagger at `/docs`

## Known limitations (non-blocking for RC demo)

- Frontend lint warnings remain for:
  - `react-hooks/exhaustive-deps`
  - `next/no-img-element`
- Temporary runtime artifacts (`.next`, Playwright reports) are generated locally after build/test runs.
- Some advanced flows still rely on demo providers (payments/labs/pharmacy availability).

## Recommended next steps to GA

1. Resolve lint warnings and switch heavy `<img>` usage to `next/image`.
2. Add strict CI gate for lint + tests + type checks.
3. Finalize release tagging/versioning strategy.
4. Run full end-to-end regression in Docker with seeded data.
