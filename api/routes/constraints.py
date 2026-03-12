# =============================================================
# api/routes/constraints.py
# GET  /api/v1/constraints   — read constraint config
# POST /api/v1/constraints   — update constraint config
# =============================================================

import json
import logging

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_db_connection

logger = logging.getLogger(__name__)
router = APIRouter()

_DEFAULTS = {
    "max_recommendations": 10,
    "min_confidence_threshold": 0.6,
    "stale_evidence_days": 30,
    "signal_promotion_frequency": 10,
}

_INIT_SQL = """
CREATE TABLE IF NOT EXISTS system_config (
    key        TEXT        PRIMARY KEY,
    value      JSONB       NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO system_config (key, value)
VALUES ('constraints', %s::jsonb)
ON CONFLICT (key) DO NOTHING;
"""


def _ensure_table(conn) -> None:
    """Create system_config table and seed constraints row if absent."""
    with conn.cursor() as cur:
        cur.execute(_INIT_SQL, (json.dumps(_DEFAULTS),))
    conn.commit()


@router.get("/")
def get_constraints(conn=Depends(get_db_connection)):
    """Return the current constraint configuration."""
    _ensure_table(conn)
    with conn.cursor() as cur:
        cur.execute("SELECT value FROM system_config WHERE key = 'constraints'")
        row = cur.fetchone()
    if row is None:
        return _DEFAULTS
    val = row[0]
    if isinstance(val, str):
        val = json.loads(val)
    return val


@router.post("/")
def update_constraints(updates: dict, conn=Depends(get_db_connection)):
    """Merge updates into the current constraint config and return the result."""
    _ensure_table(conn)
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE system_config
            SET value      = value || %s::jsonb,
                updated_at = NOW()
            WHERE key = 'constraints'
            RETURNING value
            """,
            (json.dumps(updates),),
        )
        row = cur.fetchone()
    conn.commit()
    if row is None:
        raise HTTPException(status_code=500, detail="Failed to update constraints")
    val = row[0]
    if isinstance(val, str):
        val = json.loads(val)
    return val
