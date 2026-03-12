-- =============================================================
-- 002_create_evidence.sql
-- Core evidence store. One row = one validated evidence cluster.
-- =============================================================

CREATE TABLE evidence (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme                   TEXT NOT NULL,
    representative_quotes   TEXT[]          NOT NULL DEFAULT '{}',
    unique_user_count       INTEGER         NOT NULL DEFAULT 0,
    confidence_score        FLOAT           NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    source_lineage          JSONB           NOT NULL DEFAULT '{}',
    -- e.g. {"app_store": 0.65, "zendesk": 0.35}
    temporal_decay_weight   FLOAT,          -- computed on read; nullable until first decay pass
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_validated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    embedding_vector        vector(1024),   -- pgvector column for ANN search
    embedding_model_version TEXT            NOT NULL,
    -- e.g. "amazon.titan-embed-text-v2:0"
    status                  TEXT            NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','stale','rejected','pending_reprocess'))
);

-- HNSW index for fast approximate nearest-neighbor search
-- m=16, ef_construction=64 are good defaults for MVP scale
CREATE INDEX idx_evidence_embedding
    ON evidence USING hnsw (embedding_vector vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Index for Governance Agent stale detection query
CREATE INDEX idx_evidence_last_validated
    ON evidence (last_validated_at);

-- Index for status filtering in Reasoning Agent
CREATE INDEX idx_evidence_status
    ON evidence (status);

-- Index for confidence filtering
CREATE INDEX idx_evidence_confidence
    ON evidence (confidence_score);
