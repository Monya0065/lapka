# Demo Walkthrough Checklist

Дата проверки: 2026-03-06
Среда запуска: Docker (`lapka-api`, `lapka-db`, `lapka-frontend`)

## Owner flow

- [x] Логин owner через `/login` (реальный `POST /api/v1/auth/login`)
- [x] `/owner/dashboard` загружается с карточками питомцев и событиями
- [x] `/owner/pets` показывает реальные данные (`Барсик` и другие питомцы владельца)
- [x] `/owner/pet/{id}` открывает профиль питомца
- [x] `/owner/pet/{id}/records` открывает историю визитов, экспорт PDF
- [x] `/owner/pet/{id}/documents` показывает список документов и загрузку
- [x] `/owner/calendar` и `/owner/pet/{id}/calendar` работают
- [x] `/owner/inpatient` и `/owner/inpatient/{stayId}` показывают стационар
- [x] `/owner/pet/{id}/consents` работает (grant/revoke)
- [x] `/owner/pet/{id}/passport` работает (QR паспорт)
- [x] `/owner/pharmacy` и `/owner/drugs/{id}` работают
- [x] `/owner/market`, `/owner/clinic/{id}`, `/owner/vet/{id}` работают
- [x] `/owner/notifications` API-поток подтверждён (`GET /api/v1/notifications`)

## Vet flow

- [x] Логин vet через `/login`
- [x] `/vet/patients` поиск пациента работает (маскирование без consent)
- [x] `/vet/patient/{id}` открывается при активном consent
- [x] Создание визита (`POST /api/v1/visits`) работает
- [x] Старт визита (`POST /api/v1/visits/{id}/start`) работает
- [x] Финализация визита (`POST /api/v1/visits/{id}/finalize`) работает
- [x] Экспорт PDF (`GET /api/v1/visits/{id}/export/pdf`) работает
- [x] Генерация public Rx link (`POST /api/v1/public-links/prescription`) работает
- [x] `/vet/inpatient/{stayId}`: добавление update/photo работает

## Clinic Admin flow

- [x] Логин clinic_admin через `/login`
- [x] `/clinic/dashboard` открывается с KPI
- [x] `/clinic/schedule` загружает календарь и действия по записям
- [x] `/clinic/checkin` поиск/QR check-in работает
- [x] `/clinic/doctors` загружает staff из API
- [x] `/clinic/services` CRUD услуг работает
- [x] `/clinic/billing` и `/clinic/billing/{id}` работают
- [x] `/clinic/analytics` показывает метрики
- [x] `/clinic/audit` показывает логи + moderation reviews
- [x] `/clinic/templates` сохранение шаблонов работает

## Dead buttons policy

- [x] Кнопки с действием подключены к API или роутингу
- [x] Если действие не реализовано, кнопка выключена и имеет tooltip `coming soon`/объяснение
- [x] Не найдено «мёртвых» активных кнопок без обработчика

## Автоматизация проверки

- Playwright e2e: `frontend/tests/e2e/auth-and-role-flows.spec.ts`
  - owner happy path
  - vet happy path
  - clinic_admin happy path
  - role guard redirect
- Backend integration tests: `backend/tests/*.py` (RBAC, consent, public links, inpatient, patient search)
