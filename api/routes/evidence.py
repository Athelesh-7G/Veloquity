# =============================================================
# api/routes/evidence.py
# GET /api/v1/evidence                  — list active evidence
# GET /api/v1/evidence/{id}/items       — item-level provenance
# =============================================================

import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.dependencies import get_db_connection
from api.schemas import EvidenceItem, EvidenceMapItem

router = APIRouter()


def _normalize_quotes(raw) -> list[dict]:
    """Normalise representative_quotes to a list of {text, source} dicts."""
    if not raw:
        return []
    result = []
    for q in raw:
        if isinstance(q, dict):
            result.append(q)
        elif isinstance(q, str):
            result.append({"text": q, "source": "unknown"})
    return result


def _row_to_evidence(row: dict) -> EvidenceItem:
    """Convert a raw DB row dict to an EvidenceItem."""
    quotes = row.get("representative_quotes") or []
    if isinstance(quotes, str):
        try:
            quotes = json.loads(quotes)
        except Exception:
            quotes = []
    quotes = _normalize_quotes(quotes)

    lineage = row.get("source_lineage") or {}
    if isinstance(lineage, str):
        try:
            lineage = json.loads(lineage)
        except Exception:
            lineage = {}

    return EvidenceItem(
        id=str(row["id"]),
        theme=row["theme"] or "",
        confidence_score=float(row["confidence_score"] or 0),
        unique_user_count=int(row["unique_user_count"] or 0),
        source_lineage=lineage,
        representative_quotes=quotes,
        status=row["status"] or "active",
        last_validated_at=row.get("last_validated_at"),
    )


@router.get("/", response_model=list[EvidenceItem])
def list_evidence(
    source: Optional[str] = Query(None, description="Filter by source key in source_lineage"),
    sort_by: str = Query("confidence_score", pattern="^(confidence_score|unique_user_count|last_validated_at)$"),
    conn=Depends(get_db_connection),
):
    """Return all active evidence clusters ordered by the requested field."""
    order = f"{sort_by} DESC"
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, theme, confidence_score, unique_user_count,
                   source_lineage, representative_quotes, status, last_validated_at
            FROM evidence
            WHERE status = 'active'
            ORDER BY {order}
            """,
        )
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    if source:
        rows = [r for r in rows if source in (r.get("source_lineage") or {})]

    return [_row_to_evidence(r) for r in rows]


@router.get("/{evidence_id}/items", response_model=list[EvidenceMapItem])
def get_evidence_items(evidence_id: str, conn=Depends(get_db_connection)):
    """Return all raw feedback items that contributed to an evidence cluster."""
    with conn.cursor() as cur:
        # Confirm evidence exists
        cur.execute("SELECT id FROM evidence WHERE id = %s::uuid", (evidence_id,))
        if cur.fetchone() is None:
            raise HTTPException(status_code=404, detail=f"Evidence {evidence_id} not found")

        cur.execute(
            """
            SELECT id, dedup_hash, s3_key, source, item_id, item_timestamp
            FROM evidence_item_map
            WHERE evidence_id = %s::uuid
            ORDER BY item_timestamp DESC NULLS LAST
            """,
            (evidence_id,),
        )
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    return [
        EvidenceMapItem(
            id=str(r["id"]),
            dedup_hash=r["dedup_hash"],
            s3_key=r["s3_key"],
            source=r["source"],
            item_id=r["item_id"],
            item_timestamp=r.get("item_timestamp"),
        )
        for r in rows
    ]
