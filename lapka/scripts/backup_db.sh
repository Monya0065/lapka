#!/usr/bin/env bash
set -euo pipefail

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-lapka}"
DB_USER="${DB_USER:-lapka}"
DB_PASSWORD="${DB_PASSWORD:-lapka}"
BACKUP_DIR="${BACKUP_DIR:-/backups/db}"

mkdir -p "${BACKUP_DIR}"
timestamp="$(date +%Y%m%d_%H%M%S)"
backup_file="${BACKUP_DIR}/lapka_${timestamp}.sql.gz"

echo "[backup] creating dump ${backup_file}"
PGPASSWORD="${DB_PASSWORD}" pg_dump \
  --host "${DB_HOST}" \
  --port "${DB_PORT}" \
  --username "${DB_USER}" \
  --dbname "${DB_NAME}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  | gzip -9 > "${backup_file}"

echo "[backup] done: ${backup_file}"

