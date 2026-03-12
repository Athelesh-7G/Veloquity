# =============================================================
# reasoning/retriever.py
# Fetch active evidence clusters from the DB and compute
# recency scores in Python (linear decay over 90 days).
# =============================================================

import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def fetch_active_evidence(conn) -> list[dict]:
    """Query the evidence table for all active clusters.

    Applies a recency_score to each row in Python:
        days_since = (now - last_validated_at).days
        recency_score = max(0.0, 1.0 - (days_since / 90.0))

    Args:
        conn: A live psycopg2 connection.

    Returns:
        List of dicts, each containing:
            id, theme, unique_user_count, confidence_score,
            source_lineage, created_at, last_validated_at,
            recency_score.
        Empty list if no active evidence exists.

    Raises:
        Exception: Re-raises any DB exception so the caller can handle it.
    """
    now = datetime.now(timezone.utc)

    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id, theme, unique_user_count, confidence_score,
                       source_lineage, created_at, last_validated_at
                FROM evidence
                WHERE status = 'active'
                ORDER BY confidence_score DESC
                """
            )
            rows = cur.fetchall()
    except Exception as exc:
        logger.error("fetch_active_evidence query failed: %s", exc)
        raise

    results = []
    for row in rows:
        ev_id, theme, user_count, conf_score, source_lineage, created_at, last_validated = row

        # Normalise timezone-aware vs naive datetimes.
        if last_validated.tzinfo is None:
            last_validated = last_validated.replace(tzinfo=timezone.utc)

        days_since = (now - last_validated).days
        recency_score = max(0.0, 1.0 - (days_since / 90.0))

        results.append({
            "id":               str(ev_id),
            "theme":            theme,
            "unique_user_count": user_count,
            "confidence_score": conf_score,
            "source_lineage":   source_lineage,
            "created_at":       created_at.isoformat(),
            "last_validated_at": last_validated.isoformat(),
            "recency_score":    round(recency_score, 4),
        })

    logger.info("fetch_active_evidence: returned %d clusters", len(results))
    return results
