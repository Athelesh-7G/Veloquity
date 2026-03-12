-- =============================================================
-- 001_create_extensions.sql
-- Must run first. Enables pgvector and uuid generation.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
