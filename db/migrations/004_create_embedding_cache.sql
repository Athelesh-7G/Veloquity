-- =============================================================
-- 004_create_embedding_cache.sql
-- Avoids redundant Bedrock API calls.
-- Key = (content_hash, model_version) so cache auto-invalidates
-- when embedding model changes. No manual purge needed.
-- =============================================================

CREATE TABLE embedding_cache (
    content_hash        TEXT        NOT NULL,
    model_version       TEXT        NOT NULL,
    embedding_vector    vector(1024) NOT NULL,
    cached_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_hash, model_version)
);

-- Index for TTL-based cleanup (Governance Agent purges old entries)
CREATE INDEX idx_embedding_cache_cached_at
    ON embedding_cache (cached_at);
