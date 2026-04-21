-- Lapka VPN — Optimized indexes for 1M+ users
-- Run this on PostgreSQL for production performance

-- ============================================================================
-- USERS TABLE INDEXES
-- ============================================================================

-- Primary key (already exists)
-- CREATE UNIQUE INDEX pk_users ON users(id);

-- Email lookup (most common query)
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Role-based queries for admin
CREATE INDEX idx_users_role ON users(role) WHERE role = 'admin';

-- Recent registrations
CREATE INDEX idx_users_created_at ON users(created_at DESC);

-- Combined: email + verified status
CREATE INDEX idx_users_email_verified ON users(email, email_verified);


-- ============================================================================
-- SESSIONS TABLE INDEXES
-- ============================================================================

-- User sessions lookup (most common)
CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Token lookup for logout
CREATE INDEX idx_sessions_token_hash ON sessions(token_hash);

-- Expired sessions cleanup
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at) 
WHERE expires_at < NOW();

-- User recent login check
CREATE INDEX idx_sessions_user_created ON sessions(user_id, created_at DESC);


-- ============================================================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================================================

-- User subscription lookup (most common)
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Status filter (active/trial/etc)
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- User + status combined
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

-- Renewal date queries (for auto-renewal)
CREATE INDEX idx_subscriptions_renew_at ON subscriptions(renew_at);

-- User subscription with plan
CREATE INDEX idx_subscriptions_user_plan ON subscriptions(user_id, plan_id);


-- ============================================================================
-- DEVICES TABLE INDEXES
-- ============================================================================

-- User devices lookup
CREATE INDEX idx_devices_user_id ON devices(user_id);

-- Device status (online/offline)
CREATE INDEX idx_devices_status ON devices(status);

-- User + device name (for deduplication)
CREATE INDEX idx_devices_user_name ON devices(user_id, name);

-- Platform statistics
CREATE INDEX idx_devices_platform ON devices(platform);


-- ============================================================================
-- PAYMENTS TABLE INDEXES
-- ============================================================================

-- User payments
CREATE INDEX idx_payments_user_id ON payments(user_id);

-- Payment status (for webhook processing)
CREATE INDEX idx_payments_status ON payments(status);

-- Created date for reporting
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- Provider + status for webhooks
CREATE INDEX idx_payments_provider_status ON payments(provider, status);

-- User + status for subscription update
CREATE INDEX idx_payments_user_status ON payments(user_id, status);


-- ============================================================================
-- VPN PROFILES TABLE INDEXES
-- ============================================================================

-- User profiles
CREATE INDEX idx_vpn_profiles_user_id ON vpn_profiles(user_id);

-- Device profiles
CREATE INDEX idx_vpn_profiles_device_id ON vpn_profiles(device_id);

-- Active profiles
CREATE INDEX idx_vpn_profiles_status ON vpn_profiles(status)
WHERE status = 'active';

-- Expiration for cleanup job
CREATE INDEX idx_vpn_profiles_expires_at ON vpn_profiles(expires_at)
WHERE expires_at < NOW() AND status = 'active';

-- Node assignment
CREATE INDEX idx_vpn_profiles_node_id ON vpn_profiles(node_id);


-- ============================================================================
-- VPN NODES TABLE INDEXES
-- ============================================================================

-- Active nodes by region
CREATE INDEX idx_vpn_nodes_region_status ON vpn_nodes(region, status)
WHERE status = 'active';

-- Health score sorting
CREATE INDEX idx_vpn_nodes_health_score ON vpn_nodes(health_score DESC);

-- Capacity for auto-scaling
CREATE INDEX idx_vpn_nodes_capacity ON vpn_nodes(capacity);

-- Region + health (for node selection)
CREATE INDEX idx_vpn_nodes_region_health ON vpn_nodes(region, health_score DESC)
WHERE status = 'active';


-- ============================================================================
-- AUDIT EVENTS TABLE INDEXES
-- ============================================================================

-- Actor actions
CREATE INDEX idx_audit_events_actor_id ON audit_events(actor_id);

-- Entity filtering
CREATE INDEX idx_audit_events_entity ON audit_events(entity, entity_id);

-- Time-based queries (for reporting)
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);

-- Action type + time
CREATE INDEX idx_audit_events_action_time ON audit_events(action, created_at DESC);


-- ============================================================================
-- TELEGRAM LINKS TABLE INDEXES
-- ============================================================================

-- Telegram user to user mapping
CREATE INDEX idx_telegram_links_telegram_user_id ON telegram_links(telegram_user_id);

-- User to Telegram mapping
CREATE INDEX idx_telegram_links_user_id ON telegram_links(user_id);


-- ============================================================================
-- DEVICE CLAIM TOKENS
-- ============================================================================

-- Token lookup
CREATE INDEX idx_device_claim_tokens_token ON device_claim_tokens(token);

-- User + used status
CREATE INDEX idx_device_claim_tokens_user_used ON device_claim_tokens(user_id, used_at);


-- ============================================================================
-- VERIFICATION TOKENS
-- ============================================================================

-- Token lookup
CREATE INDEX idx_verification_tokens_token_hash ON verification_tokens(token_hash);

-- Email verification
CREATE INDEX idx_verification_tokens_email ON verification_tokens(email);

-- Unused tokens cleanup
CREATE INDEX idx_verification_tokens_created_at ON verification_tokens(created_at)
WHERE used_at IS NULL;


-- ============================================================================
-- ANALYTICS QUERIES OPTIMIZATION
-- ============================================================================

-- Monthly active users
CREATE INDEX idx_audit_events_monthly ON audit_events(
    entity_id, 
    date_trunc('month', created_at)
) WHERE entity = 'user';


-- ============================================================================
-- PARTITIONING (for tables > 10M rows)
-- ============================================================================

-- Example: Partition audit_events by month
-- CREATE TABLE audit_events (
--     id UUID NOT NULL,
--     action VARCHAR(50),
--     entity VARCHAR(50),
--     entity_id UUID,
--     actor_id UUID,
--     created_at TIMESTAMP NOT NULL DEFAULT NOW()
-- ) PARTITION BY RANGE (created_at);

-- CREATE TABLE audit_events_2025_01 PARTITION OF audit_events
--     FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');


-- ============================================================================
-- MATERIALIZED VIEWS (for reports)
-- ============================================================================

-- Daily stats summary
CREATE MATERIALIZED VIEW daily_stats AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_users,
    COUNT(DISTINCT user_id) as active_users,
    SUM(amount) as revenue
FROM payments
WHERE status = 'succeeded'
GROUP BY DATE(created_at);

-- Refresh weekly
-- REFRESH MATERIALIZED VIEW CONCURRENTLY daily_stats;


-- ============================================================================
-- ANALYZE TABLES (update statistics)
-- ============================================================================

ANALYZE users;
ANALYZE sessions;
ANALYZE subscriptions;
ANALYZE devices;
ANALYZE payments;
ANALYZE vpn_profiles;
ANALYZE vpn_nodes;
ANALYZE audit_events;


-- ============================================================================
-- MONITORING QUERIES (for Grafana)
-- ============================================================================

-- Slow queries
SELECT 
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Table sizes
SELECT 
    schemaname,
    relname,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Index usage
SELECT 
    schemaname,
    relname,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan > 0
ORDER BY idx_scan DESC;


-- ============================================================================
-- PERFORMANCE TUNING
-- ============================================================================

-- PostgreSQL conf for high load (postgresql.conf)
-- shared_buffers = 8GB                    (25% RAM)
-- work_mem = 256MB                        (per query)
-- maintenance_work_mem = 2GB              (maintenance)
-- effective_cache_size = 24GB             (75% RAM)
-- checkpoint_completion_target = 0.9        (reduce wal writes)
-- random_page_cost = 1.1                  (SSD)
-- effective_io_concurrency = 200          (parallel I/O)
-- max_connections = 500                    (connection pool)
-- max_worker_processes = 16               (parallel queries)