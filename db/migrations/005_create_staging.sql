-- =============================================================
-- 005_create_staging.sql
-- Low-confidence clusters that were rejected but not discarded.
-- Governance Agent monitors this table for emerging patterns.
-- If frequency > 10 in 7 days → promote to pending_reprocess.
-- =============================================================

CREATE TABLE low_confidence_staging (
    id                      UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash            TEXT        NOT NULL,   -- links back to dedup_index
    source                  TEXT        NOT NULL,
    raw_text_sample         TEXT,                   -- representative text from cluster
    confidence_score        FLOAT       NOT NULL,
    cluster_size            INTEGER     NOT NULL DEFAULT 1,
    frequency               INTEGER     NOT NULL DEFAULT 1,
    -- incremented when same cluster pattern recurs
    first_seen              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted                BOOLEAN     NOT NULL DEFAULT FALSE,
    promoted_at             TIMESTAMPTZ
);

-- Index for Governance Agent promotion query
CREATE INDEX idx_staging_frequency
    ON low_confidence_staging (frequency, last_seen);

CREATE INDEX idx_staging_promoted
    ON low_confidence_staging (promoted);
