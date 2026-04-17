# Non-AI issues (log only — do not fix per product scope)

Items observed or reported outside the AI module boundary. Tracked here to avoid scope creep.

1. **Frontend supply chain:** `npm audit` reports vulnerabilities in the Next.js dependency tree; upgrading is a platform-wide change, not AI-specific.
2. **Pytest config:** `pytest.ini` may reference an unknown `env` key (PytestConfigWarning); test harness hygiene, not AI runtime.
3. **Docker Compose:** orphan observability containers (`prometheus`/`grafana`) can appear when compose definitions drift; infra cleanup, not AI.
4. **Backup build artifacts:** `frontend/.next.bak.*` (if present) is generated clutter; removal is repo hygiene, not AI.

_Add new rows as you discover issues; keep fixes out of this file unless the task explicitly expands scope._
