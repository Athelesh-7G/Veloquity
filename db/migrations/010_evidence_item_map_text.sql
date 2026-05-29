-- =============================================================
-- 010_evidence_item_map_text.sql
-- Store original feedback text (+ rating, title) inline on the
-- provenance rows so the evidence drill-down (/api/v1/evidence/{id}/items)
-- reads it straight from the DB and never depends on the raw S3 objects
-- still existing. Raw S3 can be deleted by re-imports / lifecycle / wipes;
-- the chain of custody must survive that.
-- =============================================================

ALTER TABLE evidence_item_map ADD COLUMN IF NOT EXISTS text   TEXT;
ALTER TABLE evidence_item_map ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE evidence_item_map ADD COLUMN IF NOT EXISTS title  TEXT;
