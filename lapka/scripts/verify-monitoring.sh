#!/usr/bin/env bash
# Verify local monitoring profile: Prometheus targets/rules + Grafana health/dashboard.
set -euo pipefail

PROM_URL="${PROM_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"

echo "==> ensure API + monitoring (Prometheus depends on healthy api target)"
docker compose --profile monitoring up -d redis api prometheus grafana >/dev/null

echo "==> wait for Prometheus readiness"
for i in $(seq 1 60); do
  if curl -fsS "${PROM_URL}/-/ready" >/dev/null 2>&1; then
    echo "Prometheus is ready"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Prometheus did not become ready in time" >&2
    docker compose --profile monitoring logs prometheus >&2 || true
    exit 1
  fi
  sleep 2
done

echo "==> reload Prometheus rule files (bind mounts do not auto-apply)"
curl -fsS -X POST "${PROM_URL}/-/reload" >/dev/null || true
sleep 2

echo "==> wait for Grafana health endpoint"
for i in $(seq 1 60); do
  if curl -fsS "${GRAFANA_URL}/api/health" >/dev/null 2>&1; then
    echo "Grafana is ready"
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "Grafana did not become ready in time" >&2
    docker compose --profile monitoring logs grafana >&2 || true
    exit 1
  fi
  sleep 2
done

echo "==> verify Prometheus target state (lapka-api)"
targets_json="$(curl -fsS "${PROM_URL}/api/v1/targets")"
if ! echo "$targets_json" | jq -e '.data.activeTargets[]? | select(.labels.job=="lapka-api" and .health=="up")' >/dev/null; then
  echo "No healthy lapka-api target found in Prometheus" >&2
  echo "$targets_json" | jq '.data.activeTargets[]? | {job: .labels.job, health: .health, lastError: .lastError}' >&2 || true
  exit 1
fi

echo "==> verify alert rules loaded"
rules_json="$(curl -fsS "${PROM_URL}/api/v1/rules")"
for group in lapka-security-messaging lapka-operations; do
  if ! echo "$rules_json" | jq -e --arg g "$group" '.data.groups[]? | select(.name==$g)' >/dev/null; then
    echo "Prometheus alert group ${group} not loaded" >&2
    exit 1
  fi
done
for alert_name in \
  LapkaSecureMessagingCooldownSpike \
  LapkaSecureMessagingRateLimitedSpike \
  LapkaSecureMessagingAbuseCritical \
  LapkaNoShowAutoRunnerMissedNightlyWarning \
  LapkaNoShowAutoRunnerMissedNightlyCritical; do
  if ! echo "$rules_json" | jq -e --arg n "$alert_name" '.data.groups[]?.rules[]? | select(.name==$n)' >/dev/null; then
    echo "Prometheus alert ${alert_name} not loaded" >&2
    exit 1
  fi
done

echo "==> verify security metric exists"
if ! curl -fsS "${PROM_URL}/api/v1/query?query=lapka_security_events_total" | jq -e '.status=="success"' >/dev/null; then
  echo "Security metric query failed" >&2
  exit 1
fi

echo "==> verify no-show auto-runner aggregate metric (scraped from API /metrics)"
if ! curl -fsS "${PROM_URL}/api/v1/query?query=lapka_no_show_auto_runner_stale_clinics" | jq -e '.status=="success"' >/dev/null; then
  echo "No-show auto-runner metric query failed" >&2
  exit 1
fi

echo "==> verify Grafana dashboard provisioning"
dash_json="$(curl -fsS -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "${GRAFANA_URL}/api/search?query=Lapka%20Security%20Messaging")"
if ! echo "$dash_json" | jq -e '.[]? | select(.uid=="lapka-security-messaging")' >/dev/null; then
  echo "Grafana dashboard lapka-security-messaging not found" >&2
  echo "$dash_json" | jq '.' >&2 || true
  exit 1
fi

dash_auto="$(curl -fsS -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "${GRAFANA_URL}/api/search?query=Lapka%20No-show%20Auto-runner")"
if ! echo "$dash_auto" | jq -e '.[]? | select(.uid=="lapka-no-show-auto-runner")' >/dev/null; then
  echo "Grafana dashboard lapka-no-show-auto-runner not found" >&2
  echo "$dash_auto" | jq '.' >&2 || true
  exit 1
fi

echo "==> monitoring verification passed"
