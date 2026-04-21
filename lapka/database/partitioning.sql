-- Database partitioning setup for 20M+ users scale
-- Run: psql -U lapka -d lapka -f database/partitioning.sql

-- Partition audit_events by month (last 2 years)
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID NOT NULL,
    actor_user_id UUID,
    clinic_id UUID,
    action VARCHAR(128) NOT NULL,
    target_type VARCHAR(64),
    target_id UUID,
    metadata JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create partitions for audit_events (next 24 months)
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE);
    month_count INTEGER;
    partition_name TEXT;
    from_date TEXT;
    to_date TEXT;
BEGIN
    FOR month_count IN 0..23 LOOP
        from_date := TO_CHAR(start_date + (month_count || ' months')::INTERVAL, 'YYYY-MM-01');
        to_date := TO_CHAR(start_date + ((month_count + 1) || ' months')::INTERVAL, 'YYYY-MM-01');
        partition_name := 'audit_events_' || TO_CHAR(start_date + (month_count || ' months')::INTERVAL, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
            partition_name, from_date, to_date
        );
    END LOOP;
END $$;

-- Partition notifications by user_id for faster lookups
CREATE TABLE IF NOT EXISTS notifications_partitioned (
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    notification_type VARCHAR(64),
    title VARCHAR(255),
    body TEXT,
    link_url VARCHAR(512),
    metadata_json JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    PRIMARY KEY (id, user_id)
) PARTITION BY HASH (user_id);

-- Create 16 partitions for notifications
DO $$
DECLARE
    i INTEGER;
    partition_name TEXT;
BEGIN
    FOR i IN 0..15 LOOP
        partition_name := 'notifications_p' || i;
        EXECUTE FORMAT('CREATE TABLE IF NOT EXISTS %I PARTITION OF notifications_partitioned FOR VALUES WITH (REPLICAS)') ;
    END LOOP;
END $$;

-- Index for faster date range queries
CREATE INDEX IF NOT EXISTS idx_audit_events_created_at 
ON audit_events (created_at DESC);

-- Index for clinic-specific queries
CREATE INDEX IF NOT EXISTS idx_audit_events_clinic 
ON audit_events (clinic_id, created_at DESC);

-- Index for user-specific audit queries  
CREATE INDEX IF NOT EXISTS idx_audit_events_user 
ON audit_events (actor_user_id, created_at DESC);

-- Function to auto-create partitions monthly
CREATE OR REPLACE FUNCTION create_audit_partition()
RETURNS VOID AS $$
DECLARE
    start_date DATE := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    partition_name TEXT;
    from_date TEXT;
    to_date TEXT;
BEGIN
    from_date := TO_CHAR(start_date, 'YYYY-MM-01');
    to_date := TO_CHAR(start_date + INTERVAL '1 month', 'YYYY-MM-01');
    partition_name := 'audit_events_' || TO_CHAR(start_date, 'YYYY_MM');

    EXECUTE FORMAT(
        'CREATE TABLE IF NOT EXISTS %I PARTITION OF audit_events FOR VALUES FROM (%L) TO (%L)',
        partition_name, from_date, to_date
    );
END;
$$ LANGUAGE plpgsql;

-- Cron job to create next month partition
-- Add to pg_cron: SELECT cron.schedule('create-audit-partition', '0 0 1 * *', 'SELECT create_audit_partition()');

-- Partition for login sessions (high write volume)
CREATE TABLE IF NOT EXISTS user_sessions_partitioned (
    session_id UUID NOT NULL,
    user_id UUID NOT NULL,
    refresh_token UUID,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    PRIMARY KEY (session_id, user_id)
) PARTITION BY HASH (user_id);

-- Partition for access logs (analytics + security)
CREATE TABLE IF NOT EXISTS access_logs (
    id BIGSERIAL NOT NULL,
    user_id UUID,
    endpoint VARCHAR(255),
    method VARCHAR(8),
    status_code INTEGER,
    latency_ms INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create quarterly partitions for access_logs
DO $$
DECLARE
    start_date DATE := DATE_TRUNC('quarter', CURRENT_DATE);
    i INTEGER;
    partition_name TEXT;
    from_date TEXT;
    to_date TEXT;
BEGIN
    FOR i IN 0..7 LOOP
        start_date := DATE_TRUNC('quarter', CURRENT_DATE) + (i || ' quarters')::INTERVAL;
        from_date := TO_CHAR(start_date, 'YYYY-MM-01');
        to_date := TO_CHAR(start_date + '3 months'::INTERVAL, 'YYYY-MM-01');
        partition_name := 'access_logs_' || TO_CHAR(start_date, 'YYYY_Q') || EXTRACT(QUARTER FROM start_date)::TEXT;

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF access_logs FOR VALUES FROM (%L) TO (%L)',
            partition_name, from_date, to_date
        );
    END LOOP;
END $$;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO lapka;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO lapka;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO lapka;

-- Analyze tables after partitioning
ANALYZE audit_events;
ANALYZE notifications_partitioned;
ANALYZE user_sessions_partitioned;
ANALYZE access_logs;