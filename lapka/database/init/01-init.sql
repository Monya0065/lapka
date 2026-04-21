-- Initial database setup for Lapka
-- Run on fresh database creation

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Configure pg_cron
SELECT cron.schedule(
    'vacuum-analyze',
    '0 2 * * *',
    'VACUUM ANALYZE'
);

-- Create read-only role for analytics
DO $$
BEGIN
    CREATE ROLE lapka_analytics WITH LOGIN PASSWORD 'analytics_secret';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

GRANT CONNECT ON DATABASE lapka TO lapka_analytics;
GRANT USAGE ON SCHEMA public TO lapka_analytics;

-- Grant analytics read-only permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lapka_analytics;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO lapka_analytics;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lapka_analytics;

-- Create application user
DO $$
BEGIN
    CREATE ROLE lapka WITH LOGIN PASSWORD 'lapka';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

GRANT CONNECT ON DATABASE lapka TO lapka;
GRANT USAGE ON SCHEMA public TO lapka;
GRANT ALL PRIVILEGES ON DATABASE lapka TO lapka;

-- Create indexes for common queries (if not exist)
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_phone_format ON users (phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pets_owner_id_active ON master_pets (owner_user_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_visits_recent ON visits (created_at DESC) WHERE created_at > NOW() - INTERVAL '90 days';
CREATE INDEX IF NOT EXISTS idx_appointments_upcoming ON appointments (start_at) WHERE status IN ('scheduled', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, is_read, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_audit_recent ON audit_events (created_at DESC) WHERE created_at > NOW() - INTERVAL '30 days';

-- Function to vacuum/analyze tables daily
CREATE OR REPLACE FUNCTION daily_maintenance()
RETURNS VOID AS $$
BEGIN
    ANALYZE users;
    ANALYZE master_pets;
    ANALYZE visits;
    ANALYZE appointments;
    ANALYZE notifications;
    ANALYZE consent_scope;
    ANALYZE consent_requests;
    ANALYZE documents;
    ANALYZE inpatient_stays;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily maintenance
SELECT cron.schedule(
    'daily-maintenance',
    '0 3 * * *',
    'SELECT daily_maintenance()'
);

-- Create function to force plan invalidation (for deployments)
CREATE OR REPLACE FUNCTION force_replan()
RETURNS VOID AS $$
BEGIN
    DISCARD ALL;
END
$$ LANGUAGE plpgsql;

-- Grant execute to app user
GRANT EXECUTE ON FUNCTION daily_maintenance() TO lapka;
GRANT EXECUTE ON FUNCTION force_replan() TO lapka;
GRANT EXECUTE ON FUNCTION create_audit_partition() TO lapka;