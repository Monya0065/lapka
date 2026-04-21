# Lapka VPN — Инфраструктура для 1 млн пользователей

## Архитектура масштабирования

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CDN (CloudFlare)                            │
│                      edge.lapka.ru:443                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Load Balancer (HAProxy/nginx)                       │
│                  lb.lapka.ru:443, :80                            │
│                    Health checks, SSL termination                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┬───────────────┬───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │  API-1     │ │  API-2     │ │  API-3     │
            │ :8000      │ │ :8000      │ │ :8000      │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                           ▼
            ┌─────────────────┐     ┌─────────────────┐
            │  PostgreSQL    │     │    Redis       │
            │  Primary +     │     │    Cluster     │
            │  Read Replica │     │  (6 nodes)     │
            └─────────────────┘     └─────────────────┘
```

---

## 1. База данных PostgreSQL

### 1.1 Partitioning таблиц

```sql
-- Partitioning users по ID (sharding)
 CREATE TABLE users (
     id UUID,
     email VARCHAR(255),
     password_hash VARCHAR(255),
     role VARCHAR(20),
     created_at TIMESTAMP,
     PRIMARY KEY (id)
 ) PARTITION BY HASH (id);

-- Partitioning sessions
 CREATE TABLE sessions (
     id UUID,
     user_id UUID,
     token_hash VARCHAR(255),
     expires_at TIMESTAMP,
     created_at TIMESTAMP,
     PRIMARY KEY (id, created_at)
 ) PARTITION BY RANGE (created_at);

-- Partitioning audit_events ( 时间 partitioning)
 CREATE TABLE audit_events (
     id UUID,
     action VARCHAR(50),
     entity VARCHAR(50),
     entity_id UUID,
     actor_id UUID,
     created_at TIMESTAMP,
     PRIMARY KEY (id, created_at)
 ) PARTITION BY RANGE (created_at);

-- Partitioning payments
 CREATE TABLE payments (
     id UUID,
     user_id UUID,
     provider VARCHAR(20),
     amount DECIMAL(10,2),
     status VARCHAR(20),
     created_at TIMESTAMP,
     PRIMARY KEY (id, created_at)
 ) PARTITION BY RANGE (created_at);
```

### 1.2 Индексы для высокой нагрузки

```sql
-- Оптимизированные индексы
 CREATE INDEX idx_users_email ON users USING hash (email);
 CREATE INDEX idx_sessions_user_id ON sessions (user_id);
 CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
 CREATE INDEX idx_devices_user_id ON devices (user_id);
 CREATE INDEX idx_vpn_profiles_user_id ON vpn_profiles (user_id);
 CREATE INDEX idx_devices_status ON devices (status);
 CREATE INDEX idx_subscriptions_status ON subscriptions (status);

-- Composite индексы
 CREATE INDEX idx_devices_user_status ON devices (user_id, status);
 CREATE INDEX idx_subscriptions_user_status ON subscriptions (user_id, status);
 CREATE INDEX idx_payments_user_status ON payments (user_id, status);
```

### 1.3 Connection Pooling (PgBouncer)

```yaml
# docker-compose.production.yml
services:
  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/vpn
      POOL_MODE: transaction
      MIN_CLIENT_CONN: 10
      MAX_CLIENT_CONN: 500
      DEFAULT_POOL_SIZE: 50
      MIN_POOL_SIZE: 20
      MAX_DB_CONNECTIONS: 200
      MAX_USER_CONNECTIONS: 100
    ports:
      - "6432:5432"
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

### 1.4 Read Replica для чтения

```sql
-- Primary + Replica setup
-- Читающие запросы на replica
-- Пишущие на primary
```

### 1.5 Конфигурация PostgreSQL для 1M

```bash
# postgresql.conf
max_connections = 500
shared_buffers = 8GB
effective_cache_size = 24GB
maintenance_work_mem = 2GB
checkpoint_completion_target = 0.9
wal_buffers = 64MB
default_statistics_target = 500
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 16MB
min_wal_size = 4GB
max_wal_size = 16GB

# Query optimizations
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
```

---

## 2. Redis Clustering

### 2.1 Redis Sentinel для HA

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 4gb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 6G

  redis-sentinel:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
```

### 2.2 Redis конфигурация

```python
# app/redis_config.py
REDIS_CLUSTER_CONFIG = {
    "nodes": [
        "redis-1:6379",
        "redis-2:6379",
        "redis-3:6379",
    ],
    "max_connections": 100,
    "socket_timeout": 5,
    "socket_connect_timeout": 5,
    "retry_on_timeout": True,
}

# Кэширование
CACHE_TTL = {
    "subscription": 300,      # 5 минут
    "user_session": 1800,      # 30 минут  
    "vpn_node": 60,          # 1 минута
    "device_list": 60,        # 1 минута
}
```

### 2.3 Key Strategies

```
# Использование Redis:
- User sessions (JWT refresh tokens)
- Subscription cache
- VPN node health
- Rate limiting
- Device online status
- Temporary auth codes
```

---

## 3. API Горизонтальное масштабирование

### 3.1 Docker Compose д��я н��скольких API

```yaml
# docker-compose.scaling.yml
services:
  api:
    image: lapka-vpn-api:latest
    deploy:
      replicas: 5
    environment:
      DATABASE_URL: postgresql://user:pass@postgres:5432/vpn
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    ports:
      - "8000"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    resources:
      limits:
        cpus: '2'
        memory: 2G

  redis:
    image: redis:7-alpine
    deploy:
      replicas: 3

  postgres:
    image: postgres:16
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 16G
```

### 3.2 Nginx Load Balancer

```nginx
# nginx.conf
upstream api_backend {
    least_conn;
    
    server api-1:8000 max_fails=3 fail_timeout=30s;
    server api-2:8000 max_fails=3 fail_timeout=30s;
    server api-3:8000 max_fails=3 fail_timeout=30s;
    server api-4:8000 max_fails=3 fail_timeout=30s;
    server api-5:8000 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.lapka.ru;
    
    ssl_certificate /etc/ssl/lapka.crt;
    ssl_certificate_key /etc/ssl/lapka.key;
    
    location / {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

### 3.3 Health Checks

```python
# app/api/routers/health.py
@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "lapka-vpn",
        "version": "1.0.0",
        "checks": {
            "database": await check_db(),
            "redis": await check_redis(),
        }
    }

@router.get("/health/ready")
async def readiness_check():
    # Проверка всех зависимостей
    db_ok = await check_db()
    redis_ok = await check_redis()
    
    if not db_ok or not redis_ok:
        raise HTTPException(status_code=503)
    
    return {"ready": True}
```

---

## 4. VPN Infrastructure для 1M

### 4.1 Архитектура

```
                          ┌──────────────────────┐
                          │   VPN Gateway        │
                          │   (BGP Router)      │
               ┌──────────┤   + WireGuard     ├──────────┐
               │         └──────────────────────┘         │
               ▼                                   ▼
        ┌────────────┐                        ┌────────────┐
        │ Node 1   │                        │ Node 2   │
        │ eu-west  │                        │ rueast  │
        └────────────┘                        └────────────┘
```

### 4.2 VPN Node Terraform

```hcl
# terraform/vpn-nodes.tf
resource "digitalocean_droplet" "vpn_node" {
  count = 20
  name  = "vpn-node-${count.index}"
  image = "ubuntu-22-04-x64"
  size  = "s-4vcpu-8gb"
  region = ["ams3", "fra1", "spb2"][count.index % 3]
  
  ssh_keys = var.ssh_keys
  
  user_data = <<-EOF
    #!/bin/bash
    set -e
    
    export WG_INTERFACE_NAME=wg0
    export WG_SERVER_IP=${self.ipv4_address}
    export WG_PORT=51820
    export WG_PRIVATE_KEY=${var.wg_private_key}
    export WG_PUBLIC_KEY=${var.wg_public_key}
    
    # WireGuard install
    apt update && apt install -y wireguard-tools
    
    # Generate server config
    cat > /etc/wireguard/wg0.conf
    # ... WireGuard server config
    
    systemctl enable wg-quick@wg0
    systemctl start wg-quick@wg0
  EOF
}

resource "digitalocean_tag" "vpn_nodes" {
  name = "vpn-node"
}
```

### 4.3 VPN Node Registry

```python
# app/services/vpn_node_manager.py
class VPNNodeManager:
    def __init__(self):
        self.nodes = []
        self.health_threshold = 70
        
    async def select_node(self, user_location: str = None) -> VPNNode:
        """Выбор оптимальной ноды для пользователя"""
        # Сортировка по health score
        # Географическое соответствие
        active_nodes = [n for n in self.nodes if n.is_active]
        if not active_nodes:
            raise NoNodesAvailable()
        return min(active_nodes, key=lambda n: n.load)
    
    async def health_check(self) -> Dict[str, Any]:
        """Мониторинг состояния нод"""
        results = []
        for node in self.nodes:
            result = await self._check_node_health(node)
            results.append(result)
            if result['score'] < self.health_threshold:
                await self._alert_low_health(node)
        return results
    
    async def _check_node_health(self, node: VPNNode) -> Dict:
        # Ping + bandwidth test + connection test
        return {
            'node_id': node.id,
            'score': 100,
            'load': 45,
            'latency': 20,
        }
```

### 4.4 Auto-scaling VPN

```python
# Kubernetes HPA для VPN нод
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vpn-node-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vpn-nodes
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

---

## 5. Rate Limiting

### 5.1 API Rate Limits

```python
# app/middleware/rate_limit.py
from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

RATE_LIMITS = {
    "login": "5/minute",
    "register": "3/minute",
    "device_create": "10/minute",
    "vpn_connect": "30/minute",
    "default": "100/minute",
}

@router.post("/auth/login")
@limiter.limit(RATE_LIMITS["login"])
async def login(request: Request, ...):
    ...
```

### 5.2 Redis-based Rate Limiting

```python
class RateLimiter:
    def __init__(self, redis):
        self.redis = redis
    
    async def is_allowed(self, key: str, limit: int, window: int) -> bool:
        now = time.time()
        window_start = now - window
        
        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zadd(key, {str(now): now})
        pipe.zcard(key)
        pipe.expire(key, window)
        results = await pipe.execute()
        
        return results[2] <= limit
```

---

## 6. CDN и Static Files

```python
# CloudFlare configuration
CDN_CONFIG = {
    "domain": "lapka.ru",
    "cache_rules": [
        # Статические файлы - long cache
        {
            "pattern": "/_next/static/*",
            "edge_ttl": 31536000,
            "browser_ttl": 86400,
        },
        # API - no cache
        {
            "pattern": "/api/*",
            "edge_ttl": 0,
            "browser_ttl": 0,
        },
    ],
}
```

---

## 7. Мониторинг и Alerting

### 7.1 Metrics (Prometheus + Grafana)

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin

  # alertmanager
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
```

### 7.2 Key Metrics

```
# Приложение
- api_requests_total
- api_request_duration_seconds
- api_errors_total
- active_connections
- vpn_sessions_active

# БД  
- pg_connections
- pg_queries_total
- pg_transaction_duration

# Redis
- redis_connected_clients
- redis_memory_used
- redis_commands_total

# VPN
- vpn_nodes_active
- vpn_connections_active
- vpn_bandwidth_bytes
- vpn_latency_ms
```

### 7.3 Alerting Rules

```yaml
groups:
- name: api_alerts
  rules:
  - alert: HighErrorRate
    expr: rate(api_errors_total[5m]) > 0.05
    for: 2m
    annotations:
      summary: "High error rate detected"
      
  - alert: DatabaseDown
    expr: up{job="postgres"} == 0
    for: 1m
    annotations:
      summary: "Database is down"
      
  - alert: HighLatency
    expr: histogram_quantile(0.95, api_request_duration_seconds) > 5
    for: 5m
    annotations:
      summary: "API latency exceeds 5s"
```

---

## 8. Backup Strategy

### 8.1 PostgreSQL Backup

```bash
# daily_backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M)
BACKUP_DIR=/backups/postgres

# Full backup
pg_dump -Fc -f ${BACKUP_DIR}/full_${DATE}.dump

# Incremental (WAL archive)
wal-g backup-push ${BACKUP_DIR}/incremental_${DATE}

# S3 upload
aws s3 cp ${BACKUP_DIR}/full_${DATE}.dump s3://lapka-backups/postgres/

# Retention - 30 days local, 1 year S3
find ${BACKUP_DIR} -mtime +30 -delete
```

### 8.2 Redis Backup

```bash
# redis_backup.sh
#!/bin/bash
redis-cli BGSAVE
# Copy RDB file to S3
aws s3 cp /data/dump.rdb s3://lapka-backups/redis/
```

### 8.3 Backup Schedule

| Тип | Частота | Хранение |
|-----|---------|----------|
| Full DB | Daily | 30 days |
| WAL | Continuous | 7 days |
| Redis | Hourly | 24 hours |
| Config | Weekly | 90 days |

---

## 9. Disaster Recovery

### 9.1 RTO/RPO Targets

- **RTO** (Recovery Time Objective): 1 hour
- **RPO** (Recovery Point Objective): 1 hour

### 9.2 Recovery Procedures

```bash
# postgres_restore.sh
#!/bin/bash
# Остановка записи
psql -c "SELECT pg_switch_wal();"

# Восстановление
pg_restore -Fc -d vpn /backups/postgres/full_latest.dump

# Verify
psql -d vpn -c "SELECT count(*) FROM users;"
```

### 9.3 Failover Strategy

```
Primary DB ──[replication]──> Standby DB
    │                              │
    │                        [auto-failover]
    ▼                        ▼
Write to Primary            Promote Standby
```

---

## 10. Security для 1M

### 10.1 Network Policies

```yaml
# kubernetes/network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-network-policy
spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
```

### 10.2 DDoS Protection

```
CloudFlare Enterprise Plan:
- Bot management
- DDoS protection ( Terb)
- Rate limiting
- JavaScript challenge
- IP reputation
```

---

## 11. Cost Estimation (1M users)

| Ресурс | Monthly Cost |
|--------|------------|
| Cloud (AWS/DO cluster) | $15,000 |
| CDN (CloudFlare) | $2,000 |
| VPN nodes (20) | $3,000 |
| Monitoring | $500 |
| Backups | $200 |
| **Total** | **$20,700/месяц** |

---

## 12. План развертывания

### Phase 1: Infrastructure (Week 1-2)
- [ ] Настроить PostgreSQL cluster
- [ ] Настроить Redis cluster
- [ ] Настроить 3 API instances
- [ ] Настроить nginx load balancer
- [ ] Настроить monitoring

### Phase 2: VPN Nodes (Week 3-4)
- [ ] Развернуть 10 VPN nodes
- [ ] Настроить auto-scaling
- [ ] Настроить health checks

### Phase 3: Testing (Week 5)
- [ ] Load testing (100k users)
- [ ] Stress testing (500k)
- [ ] Failover testing
- [ ] Backup restore testing

### Phase 4: Production (Week 6)
- [ ] DNS switch
- [ ] Gradual rollout
- [ ] Monitor metrics
- [ ] Alert response

---

## 13. Auto-scaling Triggers

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory  
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    scaleDown:
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```