-- =============================================================
-- 007_create_reasoning_runs.sql
-- Audit log for every Reasoning Agent execution.
-- One row per run: inputs (evidence IDs, priority scores),
-- LLM output, token usage, and the S3 report key.
-- =============================================================

CREATE TABLE IF NOT EXISTS reasoning_runs (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evidence_ids     UUID[]      NOT NULL,
    priority_scores  JSONB       NOT NULL,
    llm_response     JSONB       NOT NULL,
    model_id         TEXT        NOT NULL,
    token_usage      JSONB       NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'completed',
    s3_report_key    TEXT
);

CREATE INDEX idx_reasoning_runs_run_at ON reasoning_runs(run_at DESC);
