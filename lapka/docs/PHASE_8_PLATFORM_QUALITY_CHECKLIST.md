# Phase 8 Platform Quality Checklist

Date: 2026-04-17
Repository: `/Users/vadimpetrov/Documents/New project/lapka`

## Scope

Phase 8 targets a consistent quality baseline for platform-facing UI:

- i18n consistency (no hardcoded UI copy in platform pages)
- UX consistency (shared patterns, clear feedback states)
- basic a11y hygiene for interactive and status elements
- regression safety (lint/build/tests)

## Implementation Completion

- [x] Platform pages migrated to `useTranslation('common')` patterns.
- [x] Locale coverage extended in `frontend/locales/en/common.json`.
- [x] Locale coverage extended in `frontend/locales/ru/common.json`.
- [x] Remaining hardcoded platform-page strings removed from JSX.
- [x] Shared key reuse applied where possible (branch/clinic/perimeter labels).
- [x] Last known build blocker fixed (`platform/legal` client hook usage).
- [x] Hook dependency warnings addressed on `platform/dashboard`.

## Validation Results

### Frontend

Commands:

```bash
cd frontend
npm run lint
npm run build
npm run test:unit
```

Result:

- `npm run lint` -> PASS (no warnings/errors)
- `npm run build` -> PASS
- `npm run test:unit` -> PASS (10 passed)

### Backend (targeted regression in docker)

Commands:

```bash
docker compose ps
docker compose exec -T api sh -lc 'PYTHONPATH=/app pytest tests/test_analytics_sla_unit.py tests/test_ai_eval_unit.py tests/test_enterprise_foundations_unit.py'
```

Result:

- Core services are up/healthy (`api`, `db`, `frontend`, `redis`)
- Targeted backend suite -> PASS (8 passed)

## Remaining Risk / Follow-ups

- Non-blocking pytest warnings remain (config/deprecation noise in container environment).
- Optional editorial pass for terminology consistency in newly added locale keys (mixed RU/EN product terms).
- Optional final manual smoke for EN/RU UI toggling across all platform routes after merge.

## Exit Criteria Status

- [x] Platform i18n pass complete for target routes.
- [x] Frontend lint/build/unit checks green.
- [x] Targeted backend regression checks green.
- [x] No known P0 blockers for Phase 8 closure.
