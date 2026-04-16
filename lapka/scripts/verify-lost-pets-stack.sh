#!/usr/bin/env bash
# End-to-end smoke for lost pets product contour:
# - build/start stack
# - migrate DB to head
# - health/docs checks
# - targeted integration tests for lost pets modules
# Optional machine-readable report:
#   REPORT_PATH=artifacts/lost-pets-smoke-report.json ./scripts/verify-lost-pets-stack.sh
# Optional markdown summary:
#   REPORT_PATH=... SUMMARY_PATH=artifacts/lost-pets-smoke-summary.md ./scripts/verify-lost-pets-stack.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REPORT_PATH="${REPORT_PATH:-}"
SUMMARY_PATH="${SUMMARY_PATH:-}"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
RUN_STATUS="failed"
FAILED_STEP=""
STEP_ROWS=""

record_step() {
  local name="$1"
  local status="$2"
  local duration_ms="$3"
  STEP_ROWS+="${name}|${status}|${duration_ms}"$'\n'
}

write_report_if_requested() {
  if [[ -z "$REPORT_PATH" && -z "$SUMMARY_PATH" ]]; then
    return 0
  fi

  if [[ -n "$REPORT_PATH" ]]; then
    mkdir -p "$(dirname "$REPORT_PATH")"
  fi
  if [[ -n "$SUMMARY_PATH" ]]; then
    mkdir -p "$(dirname "$SUMMARY_PATH")"
  fi

  export STEP_ROWS STARTED_AT RUN_STATUS FAILED_STEP REPORT_PATH SUMMARY_PATH
  python3 - <<'PY'
import json
import os
from datetime import datetime, timezone

rows = os.environ.get("STEP_ROWS", "").strip().splitlines()
steps = []
for row in rows:
    parts = row.split("|")
    if len(parts) != 3:
        continue
    name, status, duration_ms = parts
    steps.append({
        "name": name,
        "status": status,
        "duration_ms": int(duration_ms),
    })

payload = {
    "suite": "lost-pets-smoke",
    "started_at": os.environ.get("STARTED_AT"),
    "finished_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "status": os.environ.get("RUN_STATUS", "failed"),
    "failed_step": os.environ.get("FAILED_STEP") or None,
    "steps": steps,
}

report_path = os.environ.get("REPORT_PATH", "")
summary_path = os.environ.get("SUMMARY_PATH", "")

if report_path:
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

if summary_path:
    failed_step = payload.get("failed_step") or "none"
    total = len(steps)
    passed = sum(1 for s in steps if s["status"] == "passed")
    failed = sum(1 for s in steps if s["status"] == "failed")
    lines = [
        "# Lost Pets Smoke Summary",
        "",
        f"- Suite: `{payload['suite']}`",
        f"- Started at (UTC): `{payload['started_at']}`",
        f"- Finished at (UTC): `{payload['finished_at']}`",
        f"- Overall status: `{payload['status']}`",
        f"- Failed step: `{failed_step}`",
        f"- Steps: total `{total}`, passed `{passed}`, failed `{failed}`",
        "",
        "## Steps",
        "",
        "| Step | Status | Duration (ms) |",
        "|---|---|---:|",
    ]
    for step in steps:
        lines.append(f"| `{step['name']}` | `{step['status']}` | {step['duration_ms']} |")
    lines.append("")
    with open(summary_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
PY
}

run_step() {
  local name="$1"
  shift

  echo "==> ${name}"
  local start_ms
  start_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

  if "$@"; then
    local end_ms duration_ms
    end_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
    duration_ms=$((end_ms - start_ms))
    record_step "$name" "passed" "$duration_ms"
    echo "OK: ${name}"
    return 0
  fi

  local end_ms duration_ms
  end_ms="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"
  duration_ms=$((end_ms - start_ms))
  record_step "$name" "failed" "$duration_ms"
  FAILED_STEP="$name"
  echo "FAILED: ${name}" >&2
  return 1
}

step_build_stack() {
  docker compose up --build -d
}

step_wait_health() {
  for i in $(seq 1 60); do
    if curl -fsS "http://localhost:8000/health" >/dev/null 2>&1; then
      echo "API healthy"
      return 0
    fi
    sleep 2
  done
  echo "API did not become healthy" >&2
  docker compose logs api >&2 || true
  return 1
}

step_swagger() {
  curl -fsS "http://localhost:8000/docs" >/dev/null
}

step_migrate() {
  docker compose exec -T api alembic upgrade head
}

step_public_lost_pets_smoke() {
  curl -fsS "http://localhost:8000/api/v1/lost-pets?include_found=true" >/dev/null
}

step_targeted_tests() {
  docker compose exec -T api pytest -q tests/test_growth_loops.py -k "lost_pet or hotspot or ads_budget or abuse_report"
}

trap 'write_report_if_requested' EXIT

if ! run_step "build_stack" step_build_stack; then
  exit 1
fi
if ! run_step "wait_health" step_wait_health; then
  exit 1
fi
if ! run_step "swagger_check" step_swagger; then
  exit 1
fi
if ! run_step "migrate_db" step_migrate; then
  exit 1
fi
if ! run_step "public_lost_pets_endpoint" step_public_lost_pets_smoke; then
  exit 1
fi
if ! run_step "targeted_growth_tests" step_targeted_tests; then
  exit 1
fi

RUN_STATUS="passed"
echo "==> lost pets stack verification passed"
