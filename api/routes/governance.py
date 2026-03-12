# =============================================================
# api/routes/governance.py
# GET /api/v1/governance/log    — governance event log
# GET /api/v1/governance/stats  — aggregate governance stats
# =============================================================

import json

from fastapi import APIRouter, Depends, Query

from dependencies import get_db_connection
from schemas import GovernanceEvent

router = APIRouter()


@router.get("/log", response_model=list[GovernanceEvent])
def get_governance_log(
    limit: int = Query(50, ge=1, le=200),
    conn=Depends(get_db_connection),
):
    """Return recent governance events ordered newest first."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, event_type, target_id, details, actioned_at
            FROM governance_log
            ORDER BY actioned_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    events = []
    for r in rows:
        details = r.get("details") or {}
        if isinstance(details, str):
            try:
                details = json.loads(details)
            except Exception:
                details = {}
        events.append(
            GovernanceEvent(
                id=str(r["id"]),
                event_type=r["event_type"],
                target_id=str(r["target_id"]) if r.get("target_id") else None,
                details=details,
                actioned_at=r["actioned_at"],
            )
        )
    return events


@router.get("/stats")
def get_governance_stats(conn=Depends(get_db_connection)):
    """Return aggregate statistics for the governance dashboard."""
    def _count(cur, sql, params=()):
        """Execute a COUNT query and return 0 if no row."""
        cur.execute(sql, params)
        row = cur.fetchone()
        return int(row[0]) if row is not None else 0

    with conn.cursor() as cur:
        total_events = _count(cur, "SELECT COUNT(*) FROM governance_log")
        stale_flagged = _count(cur, "SELECT COUNT(*) FROM governance_log WHERE event_type = 'stale_detected'")
        stale_flagged += _count(cur, "SELECT COUNT(*) FROM governance_log WHERE event_type = 'stale_flagged'")
        signals_promoted = _count(cur, "SELECT COUNT(*) FROM governance_log WHERE event_type = 'signal_promoted'")
        cost_alerts = _count(cur, "SELECT COUNT(*) FROM governance_log WHERE event_type = 'cost_alert'")
        active_evidence = _count(cur, "SELECT COUNT(*) FROM evidence WHERE status = 'active'")
        staging_count = _count(cur, "SELECT COUNT(*) FROM low_confidence_staging WHERE promoted = FALSE")
        last_24h = _count(
            cur,
            "SELECT COUNT(*) FROM governance_log WHERE actioned_at > NOW() - INTERVAL '24 hours'",
        )
        last_7d = _count(
            cur,
            "SELECT COUNT(*) FROM governance_log WHERE actioned_at > NOW() - INTERVAL '7 days'",
        )

        # Build events_by_type breakdown
        cur.execute("SELECT event_type, COUNT(*) FROM governance_log GROUP BY event_type")
        rows = cur.fetchall()
        events_by_type = {r[0]: int(r[1]) for r in rows} if rows else {}

    return {
        "total_events": int(total_events),
        "stale_flagged": int(stale_flagged),
        "signals_promoted": int(signals_promoted),
        "cost_alerts": int(cost_alerts),
        "active_evidence": int(active_evidence),
        "staging_count": int(staging_count),
        "last_24h": int(last_24h),
        "last_7d": int(last_7d),
        "events_by_type": events_by_type,
    }
