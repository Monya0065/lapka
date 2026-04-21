# Lapka VPN — Масштабирование до 20 млн пользователей

## Текущее состояние (MVP готов 1M)

| Компонент | Статус 1M | Готовность 20M |
|-----------|-----------|-----------------|
| API (FastAPI) | ✅ | ⚠️ Требует оптимизацию |
| PostgreSQL | ⚠️ Single | ❌ Нужен Sharding |
| Redis | ⚠️ Single | ❌ Нужен Cluster |
| VPN Nodes | ⚠️ 3 | ❌ Нужно 500+ |
| Frontend | ✅ | ⚠️ CDN |
| Monitoring | ❌ | ❌ Нужно |
| CDN | ❌ | ❌ Нужно |

---

## Архитектура для 20M

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Global CDN (CloudFlare Enterprise)                 │
│                    edge-cdn.lapka.ru (年全球)                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Multi-Region Load Balancer                           │
│                  (AWS Global Accelerator + Route53)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │   EU (AMS) │  │   US (NYC) │  │   RU (MSK) │  │   AS (SGP) │       │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
              ┌───────────────────────┴───────────────────────┐
              ▼                                               ▼
┌─────────────────────────────┐                 ┌─────────────────────────────┐
│      Regional API Cluster   │                 │      Regional API Cluster   │
│    (Kubernetes — 50 pods)    │                 │    (Kubernetes — 50 pods)  │
│  ┌──────┐ ┌──────┐ ┌──────┐  │                 │  ┌──────┐ ┌──────┐ ┌──────┐│
│  │ API  │ │ API  │ │ API  │  │                 │  │ API  │ │ API  │ │ API  ││
│  │  #1  │ │  #2  │ │ #50  │  │                 │  │  #1  │ │  #2  │ │ #50  ││
│  └──────┘ └──────┘ └──────┘  │                 │  └──────┘ └──────┘ └──────┘│
└─────────────────────────────┘                 └─────────────────────────────┘
              │                                               │
    ┌─────────┴─────────┐                           ┌─────────┴─────────┐
    ▼                 ▼                           ▼                 ▼
┌───────────┐    ┌───────────┐              ┌───────────┐    ┌───────────┐
│ PostgreSQL│    │PostgreSQL │              │PostgreSQL │    │PostgreSQL │
│ Shard #1  │    │ Shard #2  │              │ Shard #3  │    │ Shard #4  │
│ (10M)     │    │  (10M)    │              │  (10M)    │    │  (10M)    │
└───────────┘    └───────────┘              └───────────┘    └───────────┘
     ▲                ▲                          ▲                ▲
     │                │                          │                │
     └────────────────┴──────────────────────────┴────────────────┘
                              │
                    PostgreSQL Patroni Cluster
                    (HA + Auto-failover)
                              │
┌─────────────────────────────┐
│      Redis Cluster          │
│    (6 primary + 6 replica)  │
│    per region               │
└─────────────────────────────┘
```

---

## 1. База данных — PostgreSQL Sharding

### 1.1 Стратегия sharding

```sql
-- sharding key: user_id modulo n
-- 4 шарда = покрытие 20M пользователей
-- 8 шардов = запас для роста

-- Shard 1: user_id где user_id % 8 = 0, 1
-- Shard 2: user_id % 8 = 2, 3
-- Shard 3: user_id % 8 = 4, 5
-- Shard 4: user_id % 8 = 6, 7
```

### 1.2 Инфраструктура

```hcl
# terraform/postgres-sharding.tf
resource "postgresql_server" "shard_1" {
  count = 4
  name = "vpn-shard-${count.index}"
  
  sku = "MO_Standard_E64s_v3"
  storage = {
    disk_size_gb = 4096  # 4TB per shard
  }
}

resource "postgresql_database" "vpn" {
  for_each = toset([ for i in range(8) : i ])
  name = "vpn_shard_${each.value}"
  owner = "vpn"
}
```

### 1.3 Patroni кластер

```yaml
# kubernetes/patroni.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: patroni-config
data:
  patroni.yml: |
    scope: vpn-cluster
    restapi:
      listen: 0.0.0.0:8008
      connect_address: ${POD_NAME}.patroni.default.svc.local:8008
   bootstrap:
      dcs:
        name: vpn
        ttl: 30
        loop_wait: 10
        retry_timeout: 10
        maximum_lag_on_failover: 1048576
        postgresql:
          use_slots: true
          parameters:
            max_connections: 500
            shared_buffers: 16GB
    postgresql:
      listen: 0.0.0.0:5432
      parameters:
        max_connections: 500
        shared_buffers: 16GB
        work_mem: 16MB
        maintenance_work_mem: 2GB
        checkpoint_completion_target: 0.9
        wal_buffers: 64MB
    watchdog:
      mode: required
      timeout: 5
```

**Стоимость (4 шарда × $3000/мес):**
- ~$12,000/месяц

---

## 2. Redis — Cluster Mode

### 2.1 Конфигурация

```hcl
# terraform/redis-cluster.tf
resource "aws_elasticache_replication_group" "vpn_redis" {
  replication_group_id = "vpn-cluster"
  
  num_node_groups = 6
  replicas_per_node_group = 1
  
  node_type = "cache.r6g.xlarge"  # 32GB RAM
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  automatic_failover_enabled = true
  multi_az_enabled = true
}
```

### 2.2 Стратегия использования

```
Redis данные:
├─ Session tokens: hot (memory)
├─ Rate limiting: hot (memory)
├─ VPN node status: warm (TTL 60s)
├─ Subscription cache: warm (TTL 300s)
├─ Device online status: warm (TTL 30s)
└─ Temporary codes: warm (TTL 600s)
```

**Стоимость (6 nodes × $300/мес):**
- ~$1,800/месяц

---

## 3. API — Kubernetes Auto-scaling

### 3.1 Deployment

```yaml
# kubernetes/api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vpn-api
  namespace: production
spec:
  replicas: 50
  selector:
    matchLabels:
      app: vpn-api
  template:
    metadata:
      labels:
        app: vpn-api
    spec:
      containers:
      - name: api
        image: lapka/vpn-api:v1.0.0
        ports:
        - containerPort: 8000
        resources:
          requests:
            cpu: "1000m"
            memory: "2Gi"
          limits:
            cpu: "2000m"
            memory: "4Gi"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: vpn-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: vpn-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: vpn-secrets
              key: jwt-secret
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
```

### 3.2 HPA (Horizontal Pod Autoscaler)

```yaml
# kubernetes/api-hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vpn-api-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vpn-api
  minReplicas: 20
  maxReplicas: 200
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
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
```

---

## 4. VPN Infrastructure — 500 nodes

### 4.1 Географическое распределение

| Регион | Country | Nodes | Users |
|--------|---------|-------|-------|
| EU-West | NL/DE/UK | 80 | 4M |
| EU-East | PL/UA/RU | 60 | 3M |
| US-East | NYC/DC | 80 | 4M |
| US-West | LA/SEA | 60 | 3M |
| RU-Central | Moscow | 80 | 4M |
| RU-East | Siberia | 40 | 1M |
| Asia | SG/JP/KR | 60 | 3M |
| **Total** | | **500** | **20M** |

### 4.2 Terraform для VPN nodes

```hcl
# terraform/vpn-nodes.tf
variable "vpn_nodes_per_region" {
  default = 80
}

resource "digitalocean_droplet" "vpn_node" {
  count = var.vpn_nodes_per_region * 7  # 7 regions
  name  = "vpn-${split("-", module.regions[count.index % 7]])[0]}-${count.index}"
  image = "ubuntu-22-04-x64"
  size  = "s-4vcpu-8gb"  # $48/month
  tags  = ["vpn-node", module.regions[count.index % 7]]
  
  user_data = templatefile("${path.module}/user_data.tpl", {
    NODE_NUMBER = count.index
    WG_PORT = 51820 + (count.index % 10)
  })
}

# Auto-scaling based on load average
resource "digitalocean_monitoring_alert" "vpn_high_load" {
  count = var.vpn_nodes_per_region * 7
  compare = "greater_than"
  value = 70
  
  entities = [digitalocean_droplet.vpn_node[count.id]]
  
  alert_policy {
    period = "5m"
  }
}
```

### 4.3 VPN Node Controller

```python
# app/services/vpn_controller.py
class VPNController:
    def __init__(self):
        self.nodes = {}
        self.load_threshold = 70
        self.max_users_per_node = 10000
        
    async def select_node(self, user: User) -> VPNNode:
        """Выбор оптимальной ноды"""
        # 1. Географически ближайшая
        user_region = self._get_user_region(user)
        
        # 2. Наименьшая нагрузка
        available = [n for n in self.nodes.values() 
                   if n.region == user_region and n.load < self.load_threshold]
        
        if not available:
            # Fallback: любой регион
            available = [n for n in self.nodes.values() 
                       if n.load < self.load_threshold]
        
        # Выбрать с наименьшей нагрузкой
        return min(available, key=lambda n: n.load)
    
    async def auto_scale(self):
        """Auto-scaling нод"""
        for region, nodes in self.nodes_by_region.items():
            avg_load = sum(n.load for n in nodes) / len(nodes)
            
            if avg_load > 70 and len(nodes) < 100:
                await self._scale_up(region)
            elif avg_load < 30 and len(nodes) > 10:
                await self._scale_down(region)
```

**Стоимость (500 nodes × $48/мес):**
- ~$24,000/месяц

---

## 5. CDN — CloudFlare Enterprise

### 5.1 Конфигурация

```yaml
# cloudflare/config.yaml
zones:
- name: lapka.ru
  plan: enterprise
  
  settings:
    security_level: high
    always_online: true
    minify:
      html: true
      css: true
      js: true
    
  page_rules:
  - url: "*.lapka.ru/assets/*"
    cache_level: cache_everything
    edge_cache_ttl: 31536000
    
  - url: "*.lapka.ru/api/*"
    cache_level: bypass
    
  - url: "*.lapka.ru/vpn/*"
    cache_level: bypass

  workers:
  - name: vpn-auth
    script: workers/auth.js
  - name: vpn-stats
    script: workers/stats.js
```

**Стоимость:**
- ~$5,000/месяц (Enterprise)

---

## 6. Мониторинг — Prometheus + Grafana + Datadog

### 6.1 Metrics

```yaml
# Prometheus metrics
api_metrics:
  - api_requests_total
  - api_request_duration_seconds
  - api_errors_total
  
vpn_metrics:
  - vpn_connections_active
  - vpn_bandwidth_bytes_per_second
  - vpn_node_load
  - vpn_latency_ms
  
infrastructure:
  - postgres_connections
  - postgres_queries_per_second
  - redis_memory_used
  - kubernetes_pod_status
```

### 6.2 Dashboards Grafana

```json
// dashboard.json
{
  "panels": [
    {"title": "API RPS", "type": "graph", "targets": [{"expr": "rate(api_requests_total[5m])"}]},
    {"title": "VPN Users", "type": "graph", "targets": [{"expr": "vpn_connections_active"}]},
    {"title": "DB Connections", "type": "graph", "targets": [{"expr": "pg_stat_database_conns"}]},
    {"title": "Cost", "type": "singlestat", "targets": [{"expr": "sum(vpn_cost)"}]}
  ]
}
```

### 6.3 Alert Rules

```yaml
alerts:
- name: HighErrorRate
  expr: rate(api_errors_total[5m]) > 0.01
  severity: critical
  action: slack+#alerts
  
- name: DatabaseDown
  expr: up{job="postgres"} == 0
  severity: critical
  action: pagerduty
  
- name: HighLatency
  expr: histogram_quantile(0.95, api_request_duration_seconds) > 2
  severity: warning
  
- name: VPNNodeDown
  expr: vpn_node_status == 0
  severity: warning
```

---

## 7. DDoS Protection

### CloudFlare Enterprise + AWS Shield

```
Layer 7 DDoS:
├─ Bot detection
├─ JavaScript challenge
├─ Rate limiting (100 req/s per IP)
└─ Custom rules

Layer 3/4 DDoS:
├─ AWS Shield Advanced
├─ Traffic scrubbing (Tbps)
└─ Always-on protection
```

---

## 8. Backup & Disaster Recovery

### 8.1 Backup Strategy

| Type | Frequency | Retention | Location |
|------|-----------|----------|----------|
| PostgreSQL full | Daily | 30 days | AWS S3 |
| Redis RDB | Hourly | 24 hours | AWS S3 |
| WAL archive | Continuous | 7 days | AWS S3 |
| Config | On change | 90 days | GitOps |

### 8.2 RTO/RPO

- **RTO** (Recovery Time Objective): 15 minutes
- **RPO** (Recovery Point Objective): 1 hour

---

## 9. Стоимость для 20M

### Infrastructure Monthly Cost

| Component | Monthly Cost |
|-----------|--------------|
| PostgreSQL Sharding (4 shards) | $12,000 |
| Redis Cluster (6 nodes) | $1,800 |
| Kubernetes API (50-200 pods) | $30,000 |
| VPN Nodes (500) | $24,000 |
| CDN (CloudFlare Enterprise) | $5,000 |
| Monitoring (Datadog) | $3,000 |
| DNS + Route53 | $500 |
| Backup S3 | $1,000 |
| **Total** | **$77,300/month** |

### Cost per User

```
$77,300 / 20,000,000 = $0.003865/user/month
= 0.35 RUB/user/month
```

---

## 10. План развертывания

### Phase 1: Foundation (Month 1-2)
- [ ] PostgreSQL Patroni Cluster (3 zones)
- [ ] Redis Cluster (6 nodes)
- [ ] Kubernetes setup
- [ ] Basic monitoring

### Phase 2: API Scale (Month 2-3)
- [ ] Kubernetes deployment
- [ ] Auto-scaling config
- [ ] CDN setup

### Phase 3: VPN Nodes (Month 3-4)
- [ ] 100 VPN nodes globally
- [ ] Terraform automation
- [ ] Auto-scaling rules

### Phase 4: Polish (Month 4-5)
- [ ] Load testing (simulate 5M)
- [ ] Security audit
- [ ] Performance tuning

### Phase 5: Launch (Month 5-6)
- [ ] Gradual rollout
- [ ] Monitoring
- [ ] Support team

---

## 11. Team для 20M

| Role | Count |
|------|-------|
| SRE / DevOps | 3 |
| Backend Engineer | 2 |
| Frontend Engineer | 1 |
| Security Engineer | 1 |
| Support | 3 |
| Product Manager | 1 |
| **Total** | **11** |

---

## Резюме

**Готовы к 20M? ❌ Нет**

**Что нужно:**

1. ✅ PostgreSQL sharding — нужно внедрить
2. ✅ Redis cluster — нужно внедрить
3. ✅ Kubernetes — нужно настроить
4. ✅ VPN 500 nodes — нужно закупить
5. ✅ CDN Enterprise — нужно подключить
6. ✅ Monitoring — нужно развернуть
7. ✅ DDoS protection — нужно настроить

**Investment:**
- Setup: ~$500,000 (one-time)
- Monthly: ~$77,000
- Team: 11 people

**Timeline:** 6 months to launch