# PostgreSQL Sharding Configuration for 20M Users
# This file contains SQL commands to set up sharding

-- ============================================================================
-- SHARDING SETUP FOR 20M USERS
-- ============================================================================

-- Create extension for sharding
CREATE EXTENSION IF NOT EXISTS citus;

-- ============================================================================
-- COORDINATOR NODE SETUP
-- ============================================================================

-- Add coordinator node
SELECT citus_set_coordinator_host('postgres-coordinator', 5432);

-- ============================================================================
-- WORKER NODE CONFIGURATION
-- ============================================================================

-- Add worker nodes (shards)
-- In production, these would be separate servers
SELECT citus_add_node('postgres-shard-1', 5432);
SELECT citus_add_node('postgres-shard-2', 5432);
SELECT citus_add_node('postgres-shard-3', 5432);
SELECT citus_add_node('postgres-shard-4', 5432);

-- ============================================================================
-- CREATE SHARDED TABLES
-- ============================================================================

-- Users table - sharded by user_id
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user',
    mfa_enabled BOOLEAN DEFAULT false,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index before sharding
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- Shard the table
SELECT create_distributed_table('users', 'id', shard_count => 4);

-- ============================================================================
-- SUBSCRIPTIONS - sharded by user_id
-- ============================================================================

CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    plan_id VARCHAR(50) NOT NULL,
    provider VARCHAR(20),
    status VARCHAR(20) DEFAULT 'trial',
    renew_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

SELECT create_distributed_table('subscriptions', 'user_id', shard_count => 4);
CREATE INDEX idx_subscriptions_user_status ON subscriptions(user_id, status);

-- ============================================================================
-- DEVICES - sharded by user_id
-- ============================================================================

CREATE TABLE devices (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    platform VARCHAR(50),
    fingerprint VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    last_seen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

SELECT create_distributed_table('devices', 'user_id', shard_count => 4);
CREATE INDEX idx_devices_user_status ON devices(user_id, status);

-- ============================================================================
-- PAYMENTS - sharded by user_id
-- ============================================================================

CREATE TABLE payments (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    provider VARCHAR(20),
    amount DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'RUB',
    status VARCHAR(20) DEFAULT 'pending',
    external_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

SELECT create_distributed_table('payments', 'user_id', shard_count => 4);
CREATE INDEX idx_payments_user_status ON payments(user_id, status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

-- ============================================================================
-- VPN PROFILES - sharded by user_id
-- ============================================================================

CREATE TABLE vpn_profiles (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    device_id UUID,
    node_id UUID,
    public_key VARCHAR(255),
    private_key_encrypted VARCHAR(255),
    config_ref VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

SELECT create_distributed_table('vpn_profiles', 'user_id', shard_count => 4);
CREATE INDEX idx_vpn_profiles_user_status ON vpn_profiles(user_id, status);

-- ============================================================================
-- REFERENCE TABLES (replicated to all nodes)
-- ============================================================================

-- VPN Nodes - replicated table
CREATE TABLE vpn_nodes (
    id UUID PRIMARY KEY,
    region VARCHAR(50) NOT NULL,
    endpoint VARCHAR(255) NOT NULL,
    public_key VARCHAR(255) NOT NULL,
    private_key_encrypted VARCHAR(255),
    status VARCHAR(20) DEFAULT 'inactive',
    capacity INTEGER DEFAULT 100,
    health_score INTEGER DEFAULT 100,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

SELECT create_reference_table('vpn_nodes');
CREATE INDEX idx_vpn_nodes_region_status ON vpn_nodes(region, status);

-- Plans - replicated table
CREATE TABLE plans (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price_monthly INTEGER NOT NULL,
    price_yearly INTEGER,
    max_devices INTEGER DEFAULT 1,
    max_speed_mbps INTEGER,
    features JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

SELECT create_reference_table('plans');

-- Insert default plans
INSERT INTO plans (id, name, price_monthly, price_yearly, max_devices, max_speed_mbps, features) VALUES
('trial', 'Trial', 0, NULL, 1, 100, '{"servers": 3, "support": "telegram"}'::jsonb),
('monthly', 'Pro', 299, NULL, 5, 1000, '{"servers": 50, "support": "priority"}'::jsonb),
('yearly', 'Pro Year', 0, 2490, 10, 1000, '{"servers": 50, "support": "vip"}'::jsonb);

-- ============================================================================
-- BACKUP CONFIGURATION
-- ============================================================================

-- Create backup function
CREATE OR REPLACE FUNCTION backup_tables()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('COPY %I TO ''/backups/%I_%Y%m%d_%H%M%S.csv'' CSV HEADER', table_name, table_name, NOW());
    END LOOP;
END;
$$;

-- ============================================================================
-- MONITORING QUERIES
-- ============================================================================

-- Show shard distribution
SELECT * FROM citus_shards;
SELECT * FROM citus_shard_placements;

-- Show table sizes
SELECT 
    t.table_name,
    pg_size_pretty(pg_total_relation_size(schemas.table_name::regclass)) AS size,
    schemas.shard_count
FROM information_schema.tables t
JOIN (
    SELECT tablename, citus_table_type('public.' || tablename::regclass) AS table_type
    FROM pg_tables WHERE schemaname = 'public'
) types ON t.table_name = types.tablename
JOIN (
    SELECT 
        relname AS table_name,
        count(DISTINCT shardid) AS shard_count
    FROM pg_dist_shard
    GROUP BY relname
) schemas ON t.table_name = schemas.table_name
WHERE t.table_schema = 'public';

-- Check node health
SELECT * FROM citus_get_active_worker_nodes();

-- ============================================================================
-- AUTO-SCALING QUERIES
-- ============================================================================

-- Add new shard
-- SELECT citus_add_node('new-shard-host', 5432);
-- SELECT citus_move_shard_placement('shard_id', 'source_node', 'target_node');

-- Rebalance shards
-- SELECT rebalance_table_shards('users');
