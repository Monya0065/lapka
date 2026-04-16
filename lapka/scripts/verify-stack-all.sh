#!/usr/bin/env bash
# Deterministic full verification: stack health + security suite + core e2e + monitoring.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> docker compose up --build -d"
docker compose up --build -d

echo "==> wait for API health"
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

echo "==> backend security suite"
docker compose exec -T api pytest tests/test_quality_gates_security.py -q

echo "==> frontend core e2e (smoke + auth role flows)"
(
  cd frontend
  npm run test:e2e -- tests/e2e/smoke-stack.spec.ts tests/e2e/auth-and-role-flows.spec.ts
)

echo "==> monitoring verify"
./scripts/verify-monitoring.sh

echo "==> ALL CHECKS PASSED"
