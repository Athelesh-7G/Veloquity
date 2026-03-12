# =============================================================
# governance/cost_monitor.py
# Monitors embedding cache hit rate as a proxy for Bedrock cost.
# Triggers an alert if cache_count < 40% of evidence_count.
# =============================================================

import logging

from governance.audit_log import write_audit_entry

logger = logging.getLogger(__name__)

_CACHE_HIT_RATE_THRESHOLD = 0.40


def check_cost_signals(conn) -> dict:
    """Compare embedding_cache size to evidence count.

    If the cache has fewer than 40% as many rows as there is evidence,
    write a cost_alert governance_log entry.

    Args:
        conn: Live psycopg2 connection.

    Returns:
        Dict with keys: cache_count (int), evidence_count (int), alert_triggered (bool).
    """
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM embedding_cache")
        cache_count = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM evidence")
        evidence_count = cur.fetchone()[0]

    alert_triggered = evidence_count > 0 and cache_count < evidence_count * _CACHE_HIT_RATE_THRESHOLD

    if alert_triggered:
        write_audit_entry(
            conn,
            event_type="cost_alert",
            target_id=None,
            details={
                "cache_count": cache_count,
                "evidence_count": evidence_count,
                "alert": "cache_hit_rate_low",
            },
        )
        conn.commit()
        logger.warning(
            "Cost alert: cache_count=%d evidence_count=%d (below %.0f%% threshold)",
            cache_count, evidence_count, _CACHE_HIT_RATE_THRESHOLD * 100,
        )
    else:
        logger.info(
            "Cost monitor OK: cache_count=%d evidence_count=%d",
            cache_count, evidence_count,
        )

    return {
        "cache_count": cache_count,
        "evidence_count": evidence_count,
        "alert_triggered": alert_triggered,
    }
