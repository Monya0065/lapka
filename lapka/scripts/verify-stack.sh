#!/usr/bin/env bash
# Full local verification: build stack, wait for API health, run backend integration tests, curl docs.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> docker compose up --build -d"
docker compose up --build -d

echo "==> wait for GET /health"
for i in $(seq 1 60); do
  if curl -fsS "http://localhost:8000/health" >/dev/null 2>&1; then
    echo "API healthy"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "API did not become healthy" >&2
    docker compose logs api >&2 || true
    exit 1
  fi
  sleep 2
done

curl -fsS "http://localhost:8000/docs" >/dev/null
echo "Swagger reachable"

echo "==> backend pytest (integration)"
docker compose exec -T api pytest -q

echo "==> OK"
