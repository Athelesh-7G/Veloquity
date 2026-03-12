-- =============================================================
-- 003_create_dedup.sql
-- Content fingerprint store. Prevents duplicate ingestion
-- across sources and across runs.
-- =============================================================

CREATE TABLE dedup_index (
    hash        TEXT        PRIMARY KEY,    -- SHA-256 of normalized text
    source      TEXT        NOT NULL,       -- originating source type
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frequency   INTEGER     NOT NULL DEFAULT 1
    -- incremented each time a duplicate is detected
);

-- Index for fast hash lookup on every ingestion item
CREATE INDEX idx_dedup_source ON dedup_index (source);
