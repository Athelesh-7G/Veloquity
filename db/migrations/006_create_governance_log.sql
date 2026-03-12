-- =============================================================
-- 006_create_governance_log.sql
-- Append-only audit log. Every action Governance Agent takes
-- is recorded here. Never update or delete rows from this table.
-- =============================================================

CREATE TABLE governance_log (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type  TEXT        NOT NULL
                CHECK (event_type IN (
                    'stale_detected',
                    'signal_promoted',
                    'reprocess_triggered',
                    'cost_alert',
                    'threshold_alert',
                    'cache_purge',
                    'duplicate_pattern_flagged'
                )),
    target_id   UUID,       -- evidence.id or staging.id (nullable for cost/threshold events)
    details     JSONB       NOT NULL DEFAULT '{}',
    actioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying recent governance activity
CREATE INDEX idx_governance_log_event_type
    ON governance_log (event_type, actioned_at DESC);
