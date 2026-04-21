.PHONY: help dev build up down logs status psql redis-cli test lint init-db partition migrate clean health scale ssl

help:
	@echo "Lapka - Veterinary Platform Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make build        - Build all containers"
	@echo "  make up          - Start all services"
	@echo "  make down        - Stop all services"
	@echo "  make logs        - View logs (all containers)"
	@echo "  make status      - Show container status"
	@echo ""
	@echo "Database:"
	@echo "  make psql       - Connect to database"
	@echo "  make redis-cli  - Connect to Redis"
	@echo "  make init-db    - Initialize database"
	@echo "  make partition  - Setup partitioning"
	@echo "  make migrate    - Run migrations"
	@echo ""
	@echo "Production:"
	@echo "  make scale      - Scale API replicas"
	@echo "  make ssl       - Generate SSL certificates"
	@echo "  make health    - Check health endpoints"
	@echo ""
	@echo "Testing:"
	@echo "  make test       - Run tests"
	@echo "  make lint       - Run linting"

dev:
	docker compose up -d
	@echo "Running at http://localhost:3000"

build:
	docker compose build --no-cache

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

status:
	docker compose ps

psql:
	docker exec -it lapka-db psql -U lapka -d lapka

redis-cli:
	docker exec -it lapka-redis redis-cli

init-db:
	docker exec -i lapka-db psql -U lapka -d lapka < database/init/01-init.sql

partition:
	docker exec -i lapka-db psql -U lapka -d lapka < database/partitioning.sql

migrate:
	docker exec lapka-api alembic upgrade head

clean:
	docker compose down -v --rmi local

health:
	@echo "API Health: $$(curl -s http://localhost:8000/health | jq -r '.status')"
	@echo "DB Health: $$(curl -s http://localhost:8000/health/ready | jq -r '.checks.database')"
	@echo "Redis Health: $$(curl -s http://localhost:8000/health/ready | jq -r '.checks.redis')"

test:
	cd backend && .venv/bin/python -m pytest tests/ -v

lint:
	cd frontend && npm run lint

scale:
	docker compose up -d --scale api=3 --scale api-replica-1=2

ssl:
	mkdir -p infrastructure/nginx/ssl
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
		-keyout infrastructure/nginx/ssl/key.pem \
		-out infrastructure/nginx/ssl/cert.pem \
		-subj "/C=RU/ST=SPB/L=St. Petersburg/O=Lapka/CN=lapka.example.com"

start-production:
	docker compose -f docker-compose.yml up -d db pgbouncer redis redis-cache
	sleep 10
	docker compose -f docker-compose.yml up -d api
	docker compose -f docker-compose.yml up -d frontend nginx

monitoring:
	docker compose -f docker-compose.yml --profile monitoring up -d prometheus grafana loki
	@echo "Grafana: http://localhost:3001 (admin/lapka2024)"
	@echo "Prometheus: http://localhost:9090"
	@echo "Loki: http://localhost:3100"

backup:
	docker compose -f docker-compose.yml --profile backup up -d lapka-backup

deploy-k8s:
	kubectl apply -f infrastructure/kubernetes/
	kubectl apply -f infrastructure/kubernetes/backend-deployment.yaml
	kubectl apply -f infrastructure/kubernetes/frontend-deployment.yaml
	kubectl apply -f infrastructure/kubernetes/ingress.yaml

restart-api:
	docker compose restart api

restart-frontend:
	docker compose restart frontend

shell-api:
	docker exec -it lapka-api /bin/bash

shell-frontend:
	docker exec -it lapka-frontend /bin/sh

# Secrets management (production)
rotate-secrets:
	@echo "Generating new JWT secret..."
	@openssl rand -base64 32

# Cleanup old images
prune:
	docker system prune -af --volumes
	docker image prune -f