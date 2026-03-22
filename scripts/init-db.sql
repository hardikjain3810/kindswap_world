-- Initialize local development databases
-- Mirrors the logical database structure of kindswap-nonprod RDS

-- Create kindswap_staging database (for staging tests locally)
CREATE DATABASE kindswap_staging;

-- Create a staging user with limited privileges
-- NOTE: Password should be set via environment variable or Secrets Manager in production
CREATE ROLE kindswap_staging_user WITH LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
GRANT ALL PRIVILEGES ON DATABASE kindswap_staging TO kindswap_staging_user;
GRANT ALL PRIVILEGES ON DATABASE kindswap_dev TO kindswap_admin;

-- Connect to kindswap_dev and create initial schema
\c kindswap_dev;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
