# Lapka UX / Product Design Audit (2026-03-07)

## 1) UI problems discovered

1. Sidebar owner был перегружен и дублировал одни и те же сущности (общие разделы + отдельные ссылки на конкретного питомца).
2. Карточки питомцев имели много равноправных кнопок, что ломало иерархию действий.
3. Вторичные действия (документы, календарь, QR, consent, стационар) конкурировали с primary CTA и визуально засоряли список.
4. В owner-dashboard было слишком много одинаковых “быстрых” кнопок без приоритета.
5. Не было отдельного унифицированного API под библиотеку заболеваний (`/api/v1/diseases*`).
6. Калькуляторы были разрозненными и локальными на фронте, без единого реестра и backend-runner API.
7. Отсутствовали чистые owner-входы “records/documents/profile” для логичной навигации без привязки к конкретному pet ID.

## 2) Changes made

### Layout and navigation

- Переработан компонент sidebar для поддержки **группированных секций**.
- Owner sidebar очищен от дублей и разделён на блоки: Main / Medical / Tools / Services / Community / Settings.
- Добавлены owner-страницы:
  - `/owner/records`
  - `/owner/documents`
  - `/owner/profile`

### Pet cards redesign

- Карточка питомца переведена в **горизонтальный формат** (photo + key metadata + status + action column).
- Внедрена модель действий:
  - Primary: `Открыть профиль`
  - Secondary: dropdown `⋯` (medical record, documents, calendar, QR passport, consent, inpatient).
- В owner/pets список переведён на single-column horizontal cards для лучшей плотности информации и читаемости.

### Dashboard declutter

- В owner/dashboard сокращено количество “равных” CTA.
- Быстрые действия собраны в компактные блоки с меньшим визуальным шумом.

### New backend modules

- Добавлены endpoints библиотеки заболеваний:
  - `GET /api/v1/diseases`
  - `GET /api/v1/diseases/{id}`
  - `GET /api/v1/diseases/search?q=`
- Добавлен единый калькуляторный модуль:
  - `GET /api/v1/calculators`
  - `POST /api/v1/calculators/run`
- Реализовано 12 калькуляторов:
  - Drug dosage
  - Fluid therapy
  - RER
  - MER
  - Anesthesia dose range
  - Body surface area
  - Dehydration deficit
  - Blood transfusion volume
  - Heart rate range
  - Respiratory rate range
  - Pet→human age conversion
  - BMI-like condition index
- Для owner ограничен доступ к клинически рискованным калькуляторам (403 для vet-only).

### New frontend modules

- Добавлена страница `/diseases` с:
  - поиском,
  - фильтрами (species/category),
  - emergency indicator (GREEN/YELLOW/RED),
  - owner-safe представлением без схем лечения.
- Добавлена калькуляторная секция:
  - `/owner/tools/calculators`
  - `/tools/calculators` (role-aware entry)
  - `vet/tools` переведён на общий Calculator Suite.

## 3) Updated navigation structure (owner)

### Main
- Dashboard
- Pets
- Appointments

### Medical
- Medical records
- Documents
- Inpatient

### Tools
- AI triage
- Pharmacy
- Calculators
- Disease library

### Services
- Insurance
- Billing
- Referrals

### Community
- Lost pets
- Map nearby

### Settings
- Profile
- Access requests

## 4) Verification summary

- Backend tests: `15 passed`.
- Frontend build: success.
- Docker stack: healthy (`api`, `frontend`, `db`).
- New API visibility: endpoints присутствуют в OpenAPI (`/openapi.json`).
- Runtime spot checks:
  - owner `GET /api/v1/diseases?limit=1` -> 200
  - vet `POST /api/v1/calculators/run` (anesthesia_dose) -> 200
  - owner vet-only calculator call -> 403 (as expected)
