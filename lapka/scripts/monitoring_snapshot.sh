#!/usr/bin/env bash
set -euo pipefail

PROM_URL="${PROM_URL:-http://localhost:9090}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3001}"
GRAFANA_USER="${GRAFANA_USER:-admin}"
GRAFANA_PASSWORD="${GRAFANA_PASSWORD:-admin}"
OUTPUT_PATH="${1:-}"

targets_json="$(curl -fsS "${PROM_URL}/api/v1/targets")"
rules_json="$(curl -fsS "${PROM_URL}/api/v1/rules")"
security_json="$(curl -fsS --get --data-urlencode 'query=sum(increase(lapka_security_events_total{event=~"messages\\.(cooldown_active|rate_limited)"}[5m])) or vector(0)' "${PROM_URL}/api/v1/query")"
stale_json="$(curl -fsS --get --data-urlencode 'query=lapka_no_show_auto_runner_stale_clinics or vector(0)' "${PROM_URL}/api/v1/query")"
missed_json="$(curl -fsS --get --data-urlencode 'query=max(lapka_no_show_auto_runner_consecutive_missed_days) or vector(0)' "${PROM_URL}/api/v1/query")"
dash_json="$(curl -fsS -u "${GRAFANA_USER}:${GRAFANA_PASSWORD}" "${GRAFANA_URL}/api/search?query=Lapka")"

payload="$(jq -n \
  --arg ts "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" \
  --argjson targets "$targets_json" \
  --argjson rules "$rules_json" \
  --argjson security "$security_json" \
  --argjson stale "$stale_json" \
  --argjson missed "$missed_json" \
  --argjson dashboards "$dash_json" \
  '{
    generated_at_utc: $ts,
    prometheus: {
      up_targets: [
        $targets.data.activeTargets[]?
        | select(.labels.job == "lapka-api")
        | {health, scrapeUrl: .scrapeUrl, lastError: .lastError}
      ],
      rule_groups: [ $rules.data.groups[]?.name ],
      alert_names: [ $rules.data.groups[]?.rules[]?.name ],
      metric_values: {
        security_blocks_5m: ($security.data.result[0].value[1] // "0"),
        stale_clinics: ($stale.data.result[0].value[1] // "0"),
        max_missed_days: ($missed.data.result[0].value[1] // "0")
      }
    },
    grafana: {
      dashboards: [
        $dashboards[]?
        | select(.uid == "lapka-security-messaging" or .uid == "lapka-no-show-auto-runner")
        | {uid, title}
      ]
    }
  }')"

if [[ -n "$OUTPUT_PATH" ]]; then
  printf '%s\n' "$payload" > "$OUTPUT_PATH"
else
  printf '%s\n' "$payload"
fi
