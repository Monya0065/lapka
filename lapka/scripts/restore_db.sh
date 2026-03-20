#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/lapka_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "[restore] dump not found: ${DUMP_FILE}"
  exit 1
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-lapka}"
DB_USER="${DB_USER:-lapka}"
DB_PASSWORD="${DB_PASSWORD:-lapka}"

echo "[restore] restoring ${DUMP_FILE} into ${DB_NAME}@${DB_HOST}:${DB_PORT}"
gzip -dc "${DUMP_FILE}" | PGPASSWORD="${DB_PASSWORD}" psql \
  --host "${DB_HOST}" \
  --port "${DB_PORT}" \
  --username "${DB_USER}" \
  --dbname "${DB_NAME}" \
  --set ON_ERROR_STOP=on

echo "[restore] completed"

