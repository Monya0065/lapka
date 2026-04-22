-- Initial database setup for Lapka
-- Run on fresh database creation
-- Note: Application tables are created by Alembic migrations, not here.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

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
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lapka_analytics;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO lapka_analytics;

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