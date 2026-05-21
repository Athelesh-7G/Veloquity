# =============================================================
# api/routes/evidence.py
# GET /api/v1/evidence                  — list active evidence
# GET /api/v1/evidence/{id}/items       — item-level provenance
# =============================================================

import json
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from dependencies import get_db_connection
from schemas import EvidenceItem, EvidenceMapItem

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
        item_count=int(row.get("item_count") or 0),
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
                   source_lineage, representative_quotes, status, last_validated_at,
                   (SELECT COUNT(*) FROM evidence_item_map
                    WHERE evidence_item_map.evidence_id = evidence.id) AS item_count
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


@router.get("/stats")
def get_evidence_stats(conn=Depends(get_db_connection)):
    """Return aggregate evidence pipeline statistics."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    (SELECT COUNT(*) FROM embedding_cache) AS total_embedded,
                    (SELECT COUNT(*) FROM evidence WHERE status = 'active') AS active_clusters,
                    (SELECT COALESCE(SUM(cnt), 0) FROM (
                        SELECT COUNT(*) AS cnt FROM evidence_item_map
                        GROUP BY evidence_id
                    ) t) AS mapped_items,
                    (SELECT ROUND(AVG(confidence_score)::numeric * 100, 1)
                     FROM evidence WHERE status = 'active') AS avg_confidence
                """
            )
            row = cur.fetchone()
        return {
            "total_embedded":  int(row[0] or 0),
            "active_clusters": int(row[1] or 0),
            "mapped_items":    int(row[2] or 0),
            "avg_confidence":  float(row[3] or 0),
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/recluster")
async def trigger_recluster(request: Request):
    """Trigger Evidence Lambda with custom HDBSCAN clustering parameters.

    Async fire-and-forget — returns immediately while Lambda runs in background.
    Used by the Evidence Grid Re-cluster button in the frontend.
    """
    try:
        import boto3 as boto3_local
        import json as json_local

        body = await request.json()
        min_cluster_size = int(body.get("min_cluster_size", 30))
        epsilon          = float(body.get("cluster_selection_epsilon", 0.5))
        active_sources   = body.get("active_sources", [])

        region     = os.environ.get("AWS_REGION_NAME", "us-east-1")
        raw_bucket = os.environ.get("S3_RAW_BUCKET", "veloquity-raw-dev-082228066878")
        evidence_fn = os.environ.get("EVIDENCE_LAMBDA_NAME", "veloquity-evidence-dev")

        s3 = boto3_local.client("s3", region_name=region)
        paginator = s3.get_paginator("list_objects_v2")
        all_keys: list[str] = []
        for page in paginator.paginate(Bucket=raw_bucket):
            for obj in page.get("Contents", []):
                key: str = obj["Key"]
                source_prefix = key.split("/")[0] if "/" in key else ""
                if not active_sources or source_prefix in active_sources:
                    all_keys.append(key)

        lc = boto3_local.client("lambda", region_name=region)
        lc.invoke(
            FunctionName=evidence_fn,
            InvocationType="Event",
            Payload=json_local.dumps({
                "batch":                    all_keys,
                "active_sources":           active_sources,
                "min_cluster_size":         min_cluster_size,
                "cluster_selection_epsilon": epsilon,
                "recluster_mode":           True,
            }).encode(),
        )

        return {
            "status":                    "recluster_triggered",
            "min_cluster_size":          min_cluster_size,
            "cluster_selection_epsilon": epsilon,
            "keys_queued":               len(all_keys),
            "active_sources":            active_sources,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


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
