-- Migration 008: evidence_item_map
-- Persistent mapping from every evidence cluster to every raw feedback item
-- that contributed to it. Written once at cluster-creation time; never updated.

CREATE TABLE IF NOT EXISTS evidence_item_map (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id     UUID        NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    dedup_hash      TEXT        NOT NULL,
    s3_key          TEXT        NOT NULL,
    source          TEXT        NOT NULL,
    item_id         TEXT        NOT NULL,
    item_timestamp  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_evidence_item UNIQUE (evidence_id, dedup_hash),
    CONSTRAINT fk_dedup_hash FOREIGN KEY (dedup_hash) REFERENCES dedup_index(hash)
);

CREATE INDEX IF NOT EXISTS idx_eim_evidence_id    ON evidence_item_map(evidence_id);
CREATE INDEX IF NOT EXISTS idx_eim_dedup_hash     ON evidence_item_map(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_eim_source_evidence ON evidence_item_map(source, evidence_id);
CREATE INDEX IF NOT EXISTS idx_eim_item_timestamp  ON evidence_item_map(item_timestamp DESC) WHERE item_timestamp IS NOT NULL;
