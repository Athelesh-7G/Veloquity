# =============================================================
# governance/stale_detection.py
# Detects active evidence clusters that haven't been validated
# in > 30 days and marks them 'stale'.
# =============================================================

import logging
from datetime import datetime, timezone

from governance.audit_log import write_audit_entry

logger = logging.getLogger(__name__)

_STALE_DAYS = 30


def detect_and_flag_stale(conn) -> list[dict]:
    """Query active evidence older than 30 days and mark each as 'stale'.

    For every stale cluster:
      - UPDATE evidence SET status = 'stale'
      - Write a governance_log entry (event_type='stale_flagged')

    Args:
        conn: Live psycopg2 connection.

    Returns:
        List of dicts with keys: id, theme, days_stale.
    """
    flagged = []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, theme, last_validated_at
            FROM   evidence
            WHERE  status = 'active'
              AND  last_validated_at < NOW() - INTERVAL '30 days'
            """,
        )
        rows = cur.fetchall()

    now = datetime.now(tz=timezone.utc)
    for row_id, theme, last_validated_at in rows:
        days_stale = (now - last_validated_at).days

        with conn.cursor() as cur:
            cur.execute(
                "UPDATE evidence SET status = 'stale' WHERE id = %s",
                (str(row_id),),
            )

        write_audit_entry(
            conn,
            event_type="stale_flagged",
            target_id=str(row_id),
            details={"theme": theme, "days_stale": days_stale},
        )
        conn.commit()

        flagged.append({"id": str(row_id), "theme": theme, "days_stale": days_stale})
        logger.info("Flagged stale evidence: id=%s days_stale=%d", row_id, days_stale)

    logger.info("stale_detection complete: flagged=%d", len(flagged))
    return flagged
