.PHONY: monitoring-up monitoring-down monitoring-status monitoring-reload monitoring-rules monitoring-metrics monitoring-dashboards monitoring-snapshot monitoring-snapshot-json monitoring-verify stack-verify-all lost-pets-verify lost-pets-verify-report

monitoring-up:
	docker compose --profile monitoring up -d redis api prometheus grafana

monitoring-down:
	docker compose --profile monitoring stop redis api prometheus grafana

monitoring-status:
	docker compose --profile monitoring ps redis api prometheus grafana

monitoring-reload:
	curl -fsS -X POST http://localhost:9090/-/reload >/dev/null && echo "Prometheus config reloaded"

monitoring-rules:
	curl -fsS http://localhost:9090/api/v1/rules | jq -r '.data.groups[] | "GROUP: \(.name)" , (.rules[]?.name | "  - " + .)'

monitoring-metrics:
	@echo "== Prometheus instant queries (key Lapka metrics) =="
	@echo "- security blocks 5m (cooldown + rate_limited)"; curl -fsS --get --data-urlencode 'query=sum(increase(lapka_security_events_total{event=~"messages\\.(cooldown_active|rate_limited)"}[5m])) or vector(0)' "http://localhost:9090/api/v1/query" | jq -r '.data.result[0].value[1]'
	@echo "- no-show stale clinics"; curl -fsS --get --data-urlencode 'query=lapka_no_show_auto_runner_stale_clinics or vector(0)' "http://localhost:9090/api/v1/query" | jq -r '.data.result[0].value[1]'
	@echo "- no-show max missed days"; curl -fsS --get --data-urlencode 'query=max(lapka_no_show_auto_runner_consecutive_missed_days) or vector(0)' "http://localhost:9090/api/v1/query" | jq -r '.data.result[0].value[1]'

monitoring-dashboards:
	@echo "== Grafana provisioned Lapka dashboards =="
	@curl -fsS -u admin:admin "http://localhost:3001/api/search?query=Lapka" | jq -r '.[] | select(.uid=="lapka-security-messaging" or .uid=="lapka-no-show-auto-runner") | "\(.uid) :: \(.title)"'

monitoring-snapshot:
	@echo "== Monitoring snapshot =="
	@$(MAKE) monitoring-status
	@echo
	@$(MAKE) monitoring-rules
	@echo
	@$(MAKE) monitoring-metrics
	@echo
	@$(MAKE) monitoring-dashboards

monitoring-snapshot-json:
	@bash ./scripts/monitoring_snapshot.sh

monitoring-verify:
	./scripts/verify-monitoring.sh

stack-verify-all:
	./scripts/verify-stack-all.sh

lost-pets-verify:
	./scripts/verify-lost-pets-stack.sh

lost-pets-verify-report:
	mkdir -p artifacts
	REPORT_PATH=artifacts/lost-pets-smoke-report.json SUMMARY_PATH=artifacts/lost-pets-smoke-summary.md ./scripts/verify-lost-pets-stack.sh
	@echo "Report: artifacts/lost-pets-smoke-report.json"
	@echo "Summary: artifacts/lost-pets-smoke-summary.md"
