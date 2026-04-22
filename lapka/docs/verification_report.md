# Lapka Verification Report

Дата: 2026-03-06
Репозиторий: `/Users/vadimpetrov/Documents/New project/lapka`

## 1) Что проверено (runtime + команды)

### Stack startup

```bash
docker compose up --build -d
docker compose ps
curl -i http://localhost:8000/health
curl -I http://localhost:8000/docs
curl -I http://localhost:3000
```

Результат:
- `lapka-db` — healthy
- `lapka-api` — healthy
- `lapka-frontend` — up
- `/health` = `200 OK`
- `/docs` = `200 OK`
- фронтенд = `200 OK`

### Seed + idempotency

```bash
docker compose exec -T api python -m src.seed
docker compose exec -T api python -m src.seed
docker compose restart api frontend
docker compose exec -T api python -m src.seed
docker compose restart api frontend
docker compose exec -T api python -m src.seed
docker compose exec -T api cat storage/seed_summary.json
```

Результат: счётчики стабильны между прогонами (idempotent).

Ключевые counts:
- clinics: 1
- vets: 12
- owners: 60
- pets: 100
- visits: 528
- appointments_future_14d: 80
- invoices: 120
- insurance_claims: 20
- lab_orders: 40
- lab_results: 25

Контрольные питомцы:
- FULL_RECORD: `55555555-5555-5555-5555-555555555555`
- BASIC_MEDICAL: `c1ec49f2-9726-581e-9b83-62d8ec0909bb`
- NO_CONSENT: `60136ddf-8327-5875-8e39-2f336b1d9708`

### Backend quality gates

```bash
docker compose run --rm \
  -e LAPKA_API_BASE=http://host.docker.internal:8000 \
  -v "$(pwd)/backend/tests:/app/tests" \
  api pytest -q /app/tests
```

Результат: `15 passed`.

Покрыто тестами:
- RBAC deny
- consent enforcement
- patient search masking
- public token restrictions
- inpatient token and one-time logic
- visit journey actions

### Frontend quality gates

```bash
cd frontend
npm run lint
npx playwright install chromium
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

Результат:
- lint выполняется без интерактивных блокеров
- Playwright: `4 passed`
  - owner login + pets
  - vet login + patient search
  - clinic_admin login + schedule
  - role guard redirect (owner -> /vet denied)

## 2) Что было не так и как исправлено

1. `next lint` блокировался интерактивной инициализацией.
- Fix: добавлены `frontend/.eslintrc.json`, `frontend/.eslintignore`, dev deps `eslint`, `eslint-config-next`.

2. Отсутствовали e2e и конфиг Playwright.
- Fix: добавлены `frontend/playwright.config.js` и `frontend/tests/e2e/auth-and-role-flows.spec.ts`.

3. Не было CI workflow.
- Fix: добавлен `.github/workflows/ci.yml` (lint + backend tests + e2e + stack health checks).

4. В runtime-образе backend не было инструментов для тестов.
- Fix: добавлены `pytest` и `requests` в `backend/requirements.txt`.

5. Dead/placeholder кнопки в части экранов.
- Fix: активные кнопки подключены к route/API; неготовые действия оставлены disabled с tooltip.

6. Выводы с сырой JSON на страницах.
- Fix: заменено на структурированные UI-блоки (таблицы/карточки).

7. Не хватало demo-навигации для первого запуска.
- Fix: добавлены `Demo Mode` banner и плавающая helper-карточка с быстрыми сценариями.

8. Критичные действия не были подтверждаемыми в нескольких экранах.
- Fix: внедрён единый `ConfirmDialog` (cancel appointment, revoke consent/passport/public link, discharge stay).

9. Повторные GET-запросы перегружали UI при навигации.
- Fix: добавлен in-memory cache + invalidation в `frontend/lib/api.js`, тяжёлые drug-экраны переведены на lazy loading.

## 3) Screens/Routes coverage

| Route | Role | Status | Проверка |
|---|---|---|---|
| `/` | public | OK | HTTP 200 + визуально |
| `/about` | public | OK | route доступен |
| `/for-owners` | public | OK | route доступен |
| `/for-vets` | public | OK | route доступен |
| `/for-clinics` | public | OK | route доступен |
| `/pricing` | public | OK | route доступен |
| `/faq` | public | OK | route доступен |
| `/security` | public | OK | route доступен |
| `/map` | public | OK | route доступен |
| `/login` | public | OK | реальный auth flow |
| `/owner/dashboard` | owner | OK | e2e + role guard |
| `/owner/pets` | owner | OK | e2e + API data |
| `/owner/pet/{id}` | owner | OK | ручной click-through |
| `/owner/pet/{id}/records` | owner | OK | API + UI |
| `/owner/pet/{id}/documents` | owner | OK | upload/list |
| `/owner/pet/{id}/calendar` | owner | OK | route + UI |
| `/owner/pet/{id}/inpatient` | owner | OK | route + API |
| `/owner/pet/{id}/consents` | owner | OK | grant/revoke |
| `/owner/pet/{id}/passport` | owner | OK | generate/revoke |
| `/owner/appointments` | owner | OK | booking UI |
| `/owner/appointments/new` | owner | OK | wizard route |
| `/owner/inpatient` | owner | OK | list stays |
| `/owner/market` | owner | OK | clinics/vets discovery |
| `/owner/pharmacy` | owner | OK | drugs finder |
| `/owner/drugs/{id}` | owner | OK | drug details + availability |
| `/owner/billing` | owner | OK | invoices list |
| `/owner/insurance` | owner | OK | claims/policies |
| `/owner/referrals` | owner | OK | referrals + clinic invites |
| `/owner/requests` | owner | OK | consent requests |
| `/vet/dashboard` | vet | OK | e2e + role guard |
| `/vet/patients` | vet | OK | e2e + masked search |
| `/vet/patient/{id}` | vet | OK | consent-aware card |
| `/vet/visit/{id}` | vet | OK | start/finalize/pdf/public link |
| `/vet/documents` | vet | OK | upload + list |
| `/vet/labs` | vet | OK | order/import result |
| `/vet/drugs` | vet | OK | finder + details |
| `/vet/tools` | vet | OK | calculators |
| `/vet/assistant` | vet | OK | audio intake demo |
| `/vet/inpatient` | vet | OK | ward list |
| `/vet/inpatient/{stayId}` | vet | OK | events/photos/docs |
| `/clinic/dashboard` | clinic_admin | OK | e2e |
| `/clinic/schedule` | clinic_admin | OK | e2e + actions |
| `/clinic/checkin` | clinic_admin | OK | search/QR/draft |
| `/clinic/doctors` | clinic_admin | OK | staff list |
| `/clinic/patients` | clinic_admin | OK | clinic-grade search |
| `/clinic/services` | clinic_admin | OK | CRUD |
| `/clinic/billing` | clinic_admin | OK | invoices |
| `/clinic/billing/{id}` | clinic_admin | OK | issue/void/pay state |
| `/clinic/insurance` | clinic_admin | OK | claims inbox |
| `/clinic/templates` | clinic_admin | OK | editor |
| `/clinic/analytics` | clinic_admin | OK | metrics |
| `/clinic/inpatient` | clinic_admin | OK | occupancy |
| `/clinic/inpatient/{stayId}` | clinic_admin | OK | assignment/details |
| `/clinic/audit` | clinic_admin | OK | audit + moderation |
| `/clinic/invites` | clinic_admin | OK | clinic invites moderation |
| `/public-rx/{token}` | public | OK | tokenized limited payload |
| `/pet-passport/{token}` | public | OK | safe public profile |
| `/lost-pets` | public | OK | listing + details |

## 4) Remaining TODOs (short, prioritized)

1. ~~**P1**: перевести ключевые `img` на `next/image` для LCP и снижения предупреждений lint.~~ ✅ (placekitten.com в remotePatterns, owner pet page → Image)
2. ~~**P1**: закрыть предупреждения `react-hooks/exhaustive-deps` (стабилизировать callbacks/useMemo/useCallback).~~ ✅ (vet/documents: loadDocuments → useCallback)
3. **P2**: расширить Playwright happy-path (upload document, consent grant/revoke, owner notifications read).
4. ~~**P2**: добавить `pytest` marker registration (`integration`) в `pytest.ini`, чтобы убрать warning noise.~~ ✅ (markers уже есть, 26 integration тестов)
5. ~~**P3**: усилить accessibility (aria-label у icon-only actions + keyboard focus regression check).~~ ✅ (Button, Input, Card, DicomViewer, OwnerPetLayout)
