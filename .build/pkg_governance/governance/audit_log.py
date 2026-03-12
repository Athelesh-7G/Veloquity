# =============================================================
# governance/audit_log.py
# Central audit log writer — all governance actions go here.
# No module should INSERT directly into governance_log;
# they must call write_audit_entry() instead.
# =============================================================

import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def write_audit_entry(
    conn,
    event_type: str,
    details: Optional[dict] = None,
    target_id: Optional[str] = None,
) -> None:
    """Insert one row into governance_log.

    Args:
        conn:       Live psycopg2 connection.
        event_type: Short label for the action (e.g. 'stale_flagged').
        details:    Arbitrary JSON-serialisable dict with context.
        target_id:  UUID of the affected evidence / staging row (nullable).
    """
    details = details or {}
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO governance_log (event_type, target_id, details)
            VALUES (%s, %s::uuid, %s::jsonb)
            """,
            (event_type, target_id, json.dumps(details)),
        )
    logger.debug("governance_log: event_type=%s target_id=%s", event_type, target_id)
