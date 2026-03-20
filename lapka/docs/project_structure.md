# Project Structure Verification (RC1)

Verified on `2026-03-07`.

```text
lapka/
  backend/
    alembic/
    src/
      api/routes/
      ai_assistant/
      core/
      db/
      integrations/
      models/
      repositories/
      schemas/
      security/
      services/
    tests/
  frontend/
    app/
      (marketing)/
      owner/
      vet/
      clinic/
      login/
      public-rx/
    components/
      auth/
      blocks/
      drugs/
      layouts/
      ui/
    lib/
    public/
  docs/
  scripts/
  docker-compose.yml
  README.md
```

Notes:

- Legacy static prototype pages were removed from `frontend/` in RC1.
- Active frontend runtime is Next.js App Router only.
- Active backend runtime is FastAPI with modular route layer.
