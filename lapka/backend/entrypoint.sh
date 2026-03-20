#!/usr/bin/env sh
set -eu

export PYTHONPATH=/app

python - <<'PY'
import asyncio
import os

import asyncpg

sync_url = os.getenv("SYNC_DATABASE_URL", "postgresql://lapka:lapka@db:5432/lapka")


async def wait_for_db() -> None:
    for _ in range(60):
        try:
            conn = await asyncpg.connect(sync_url)
            await conn.close()
            print("Database is ready")
            return
        except Exception as exc:
            print(f"Waiting for database: {exc}")
            await asyncio.sleep(2)
    raise SystemExit("Database is not reachable")


asyncio.run(wait_for_db())
PY

alembic upgrade head
python -m src.seed
exec uvicorn src.main:app --host 0.0.0.0 --port 8000
