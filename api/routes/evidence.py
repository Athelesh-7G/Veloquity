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


@router.post("/ingest")
async def ingest_source(request: Request, conn=Depends(get_db_connection)):
    """Real CSV ingestion for V1: push uploaded rows through the Ingestion
    Lambda (normalize + PII redact + dedup -> S3), wipe the dataset's stale
    evidence, then trigger a fresh clustering run so V1 reflects exactly the
    file the user imported.

    Body:
        source_type     : pipeline source key (app_store|zendesk|patient_portal|hospital_survey)
        rows            : list of raw CSV row dicts (original column names preserved)
        active_sources  : sources currently connected for this dataset
        min_cluster_size: optional override (default 8)
    """
    import boto3 as _b
    import json as _j

    body = await request.json()
    source_type = (body.get("source_type") or "").strip()
    rows = body.get("rows") or []
    active_sources = body.get("active_sources") or ([source_type] if source_type else [])
    if not source_type or not isinstance(rows, list) or not rows:
        raise HTTPException(status_code=400, detail="source_type and non-empty rows[] are required")

    region       = os.environ.get("AWS_REGION_NAME", "us-east-1")
    raw_bucket   = os.environ.get("S3_RAW_BUCKET", "veloquity-raw-dev-082228066878")
    ingestion_fn = os.environ.get("INGESTION_LAMBDA_NAME", "veloquity-ingestion-dev")
    evidence_fn  = os.environ.get("EVIDENCE_LAMBDA_NAME", "veloquity-evidence-dev")
    s3 = _b.client("s3", region_name=region)
    lc = _b.client("lambda", region_name=region)
    paginator = s3.get_paginator("list_objects_v2")

    try:
        # 1. Replace this source's S3 objects + dedup so the upload fully supersedes prior data.
        to_del = []
        for page in paginator.paginate(Bucket=raw_bucket, Prefix=f"{source_type}/"):
            for o in page.get("Contents", []):
                to_del.append({"Key": o["Key"]})
        for i in range(0, len(to_del), 1000):
            chunk = to_del[i:i + 1000]
            if chunk:
                s3.delete_objects(Bucket=raw_bucket, Delete={"Objects": chunk})
        with conn.cursor() as cur:
            cur.execute("DELETE FROM dedup_index WHERE source = %s", (source_type,))
        conn.commit()

        # 2. Ingest the uploaded rows synchronously (fast: regex PII, indexed dedup, S3 puts).
        resp = lc.invoke(
            FunctionName=ingestion_fn,
            InvocationType="RequestResponse",
            Payload=_j.dumps({"source_type": source_type, "items": rows}).encode(),
        )
        ing = _j.loads(resp["Payload"].read())

        # 3. Wipe the dataset's stale evidence so clusters rebuild clean (no accumulation).
        with conn.cursor() as cur:
            cur.execute(
                """DELETE FROM evidence_item_map WHERE evidence_id IN (
                     SELECT id FROM evidence WHERE EXISTS (
                       SELECT 1 FROM jsonb_object_keys(source_lineage) k WHERE k = ANY(%s)))""",
                (active_sources,),
            )
            cur.execute(
                """DELETE FROM evidence WHERE EXISTS (
                     SELECT 1 FROM jsonb_object_keys(source_lineage) k WHERE k = ANY(%s))""",
                (active_sources,),
            )
        conn.commit()

        # 4. Trigger a fresh clustering run (async) over the active sources' fresh corpus.
        all_keys = []
        for src in active_sources:
            for page in paginator.paginate(Bucket=raw_bucket, Prefix=f"{src}/"):
                for o in page.get("Contents", []):
                    all_keys.append(o["Key"])
        mcs = int(body.get("min_cluster_size") or 8)
        lc.invoke(
            FunctionName=evidence_fn,
            InvocationType="Event",
            Payload=_j.dumps({
                "batch": all_keys,
                "active_sources": active_sources,
                "min_cluster_size": mcs,
                "min_samples": 1,
                "cluster_selection_epsilon": 0.0,
            }).encode(),
        )

        return {
            "status":      "ingested_and_clustering",
            "source_type": source_type,
            "written":     ing.get("written"),
            "duplicates":  ing.get("duplicates"),
            "corpus_size": len(all_keys),
            "min_cluster_size": mcs,
        }
    except HTTPException:
        raise
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
        # NOTE: evidence has no `source` column — derive the dominant source from
        # source_lineage (selecting `source` here was a 500 that made every
        # drill-down silently fall back to representative_quotes).
        cur.execute(
            "SELECT representative_quotes, source_lineage FROM evidence WHERE id = %s::uuid",
            (evidence_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"Evidence {evidence_id} not found")
        representative_quotes_raw, lineage_raw = row[0], row[1]
        lineage = lineage_raw
        if isinstance(lineage, str):
            try:
                lineage = json.loads(lineage)
            except Exception:
                lineage = {}
        cluster_source = max(lineage, key=lineage.get) if isinstance(lineage, dict) and lineage else None

        cur.execute(
            """
            SELECT s3_key, source, item_id, item_timestamp, text, rating, title
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
    # Only spin up an S3 client if at least one row is missing inline text
    # (legacy rows written before text was stored in the DB).
    needs_s3 = any(not (r.get("text") or "").strip() for r in map_rows)
    s3 = boto3.client("s3", region_name=os.environ.get("AWS_REGION_NAME", "us-east-1")) if needs_s3 else None

    items = []
    for r in map_rows:
        # Primary path: text stored inline in evidence_item_map (S3-independent).
        text = (r.get("text") or "").strip() or None
        rating = r.get("rating")
        title = r.get("title")
        # Legacy fallback: fetch from S3 only when inline text is absent.
        if not text and s3 is not None and r.get("s3_key"):
            try:
                obj = s3.get_object(Bucket=raw_bucket, Key=r["s3_key"])
                payload = json.loads(obj["Body"].read())
                text = (
                    payload.get("text")
                    or payload.get("body")
                    or payload.get("review")
                    or payload.get("description")
                    or ""
                ) or None
                if rating is None:
                    rv = payload.get("rating")
                    try:
                        rating = int(rv) if rv is not None else None
                    except (ValueError, TypeError):
                        rating = None
                title = title or payload.get("title")
            except Exception:
                text = None
        if text:
            items.append(
                {
                    "text": text,
                    "source": r.get("source") or cluster_source or "unknown",
                    "timestamp": str(r["item_timestamp"]) if r.get("item_timestamp") else None,
                    "item_id": r.get("item_id"),
                    "rating": rating,
                    "title": title,
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
