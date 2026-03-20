# OSS Candidates (Pattern Adoption Scan)

Дата: 2026-03-06
Цель: взять **паттерны** (структура, best practices), без копипаста больших кусков кода.

| Repo | Ссылка | Что даёт | Риски | План адаптации в Lapka |
|---|---|---|---|---|
| `shadcn-ui/ui` | https://github.com/shadcn-ui/ui | Эталонный набор паттернов компонентов (card, table, dialog, tabs, toast, form states). | Избыточное количество компонентов, риск «перестройки ради перестройки». | Использовать как reference для унификации API компонентов (`Card`, `Modal`, `Tabs`, `Table`) и состояния focus/hover/disabled. Не копировать полный boilerplate. |
| `vercel/next.js` (official examples) | https://github.com/vercel/next.js/tree/canary/examples | Production-паттерны App Router, route grouping, layout nesting, data fetching patterns. | Примеры разношёрстные, нужен строгий отбор. | Зафиксировать целевой routing-style для owner/vet/clinic разделов, унифицировать loading/error boundaries и route-level skeleton patterns. |
| `tiangolo/full-stack-fastapi-template` | https://github.com/fastapi/full-stack-fastapi-template | Структура production FastAPI: settings, env, alembic, auth flow, сервисный слой. | Шаблон шире, чем текущие цели MVP. | Адаптировать подход к конфигурации и модульным сервисам (без миграции всего проекта). Использовать как чеклист для security headers, env hygiene и тестовой организации. |
| `fastapi` docs (security/JWT patterns) | https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/ | Официальные и поддерживаемые практики auth и security dependencies. | Нужно сопоставлять с текущей JWT/refresh архитектурой Lapka. | Провести точечный diff: token lifecycle, exceptions, dependency wiring; усилить единый ErrorResponse для auth/permission отказов. |
| `microsoft/playwright` | https://github.com/microsoft/playwright | Надёжные e2e-подходы, trace artifacts, retries, role-based login fixtures. | Возможна флейковость без стабилизации селекторов. | Ввести page-object для login/dashboard, расширить happy-path до consent/public link flows и добавить artifact upload в CI. |
| `astral-sh/ruff` + `pre-commit/pre-commit` | https://github.com/astral-sh/ruff , https://github.com/pre-commit/pre-commit | Быстрый линт/формат + предкоммит-контроль качества на backend. | Добавление нового инструмента требует выравнивания правил команды. | На следующем шаге: подключить `ruff` (lint + import sort), pre-commit hooks для backend/frontend, без блокировки release (warn-only rollout). |

## Рекомендованный порядок внедрения

1. UI consistency: shadcn-style patterns + Next route-level loading/error composition.
2. Backend hygiene: FastAPI config/security checklist alignment.
3. Test depth: Playwright page-objects + стабильные сценарии consent/RBAC.
4. Tooling: `ruff`/pre-commit после фикса основных UX/flow задач.

## Ограничения принятия

- Никакого wholesale copy-paste из сторонних репозиториев.
- Каждая адаптация проходит через security review (RBAC/consent/audit).
- AI safety policy остаётся приоритетом: owner-facing endpoints без лечения/дозировок.
