# =============================================================
# api/routes/evidence.py
# GET /api/v1/evidence                  — list active evidence
# GET /api/v1/evidence/{id}/items       — item-level provenance
# =============================================================

import json
import os
from typing import Optional

import boto3

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
    sources: Optional[str] = Query(None, description="Comma-separated source keys to include"),
    sort_by: str = Query("confidence_score", pattern="^(confidence_score|unique_user_count|last_validated_at)$"),
    conn=Depends(get_db_connection),
):
    """Return all active evidence clusters ordered by the requested field."""
    order = f"{sort_by} DESC"
    source_list = [s.strip() for s in sources.split(",") if s.strip()] if sources else []
    if source and source not in source_list:
        source_list.append(source)

    if source_list:
        conditions = " OR ".join(["source_lineage ? %s"] * len(source_list))
        where_clause = f"status = 'active' AND ({conditions})"
        params = tuple(source_list)
    else:
        where_clause = "status = 'active'"
        params = ()

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT id, theme, confidence_score, unique_user_count,
                   source_lineage, representative_quotes, status, last_validated_at,
                   (SELECT COUNT(*) FROM evidence_item_map
                    WHERE evidence_item_map.evidence_id = evidence.id) AS item_count
            FROM evidence
            WHERE {where_clause}
            ORDER BY {order}
            """,
            params,
        )
        cols = [d[0] for d in cur.description]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]

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


@router.get("/{evidence_id}/items")
async def get_cluster_items(
    evidence_id: str,
    limit: int = Query(50, ge=1, le=200),
    conn=Depends(get_db_connection),
):
    """Return raw feedback items for a cluster, fetching full text from S3."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT representative_quotes, source FROM evidence WHERE id = %s::uuid",
            (evidence_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Evidence {evidence_id} not found")
        representative_quotes_raw, cluster_source = row[0], row[1]

        cur.execute(
            """
            SELECT s3_key, source, item_id, item_timestamp
            FROM evidence_item_map
            WHERE evidence_id = %s::uuid
            ORDER BY item_timestamp DESC NULLS LAST
            LIMIT %s
            """,
            (evidence_id, limit),
        )
        cols = [d[0] for d in cur.description]
        map_rows = [dict(zip(cols, r)) for r in cur.fetchall()]

    raw_bucket = os.environ.get("S3_RAW_BUCKET", "veloquity-raw-dev-082228066878")
    s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION_NAME", "us-east-1"))

    items = []
    for r in map_rows:
        text = None
        if r.get("s3_key"):
            try:
                obj = s3.get_object(Bucket=raw_bucket, Key=r["s3_key"])
                payload = json.loads(obj["Body"].read())
                text = (
                    payload.get("text")
                    or payload.get("body")
                    or payload.get("review")
                    or payload.get("description")
                    or ""
                )
            except Exception:
                text = None
        if text:
            items.append(
                {
                    "text": text,
                    "source": r.get("source") or cluster_source or "unknown",
                    "timestamp": str(r["item_timestamp"]) if r.get("item_timestamp") else None,
                    "item_id": r.get("item_id"),
                    "rating": None,
                    "title": None,
                }
            )

    # Fall back to representative_quotes if S3 fetch yielded nothing
    if not items:
        quotes = _normalize_quotes(representative_quotes_raw)
        items = [
            {
                "text": q.get("text", ""),
                "source": q.get("source") or cluster_source or "unknown",
                "timestamp": None,
                "item_id": None,
                "rating": None,
                "title": None,
            }
            for q in quotes
            if q.get("text")
        ]

    return {
        "evidence_id": evidence_id,
        "items": items,
        "total": len(items),
        "source": cluster_source or "unknown",
    }
