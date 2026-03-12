# =============================================================
# api/routes/evidence.py
# GET /evidence         — list active evidence clusters
# GET /clusters         — list all clusters including staging
# =============================================================

from fastapi import APIRouter, Query
from typing import Optional
import math
from api.db import get_conn, release_conn

router = APIRouter()

@router.get("/")
def list_evidence(
    min_confidence: float = Query(0.6, ge=0.0, le=1.0),
    source: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
):
    """
    Return active evidence clusters filtered by confidence and source.
    Applies temporal decay weighting at query time.
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Temporal decay: computed on read
            # decay_weight = exp(-lambda * days_since_last_validated)
            # Lambda hardcoded to 0.05 for now; per-source tuning is v2
            query = """
                SELECT
                    id,
                    theme,
                    representative_quotes,
                    unique_user_count,
                    confidence_score,
                    source_lineage,
                    ROUND(
                        EXP(-0.05 * EXTRACT(
                            EPOCH FROM (NOW() - last_validated_at)
                        ) / 86400.0)::numeric, 4
                    ) AS decay_weight,
                    created_at,
                    last_validated_at,
                    embedding_model_version,
                    status
                FROM evidence
                WHERE status = 'active'
                  AND confidence_score >= %s
                ORDER BY confidence_score DESC, unique_user_count DESC
                LIMIT %s
            """
            params = [min_confidence, limit]

            if source:
                query = query.replace(
                    "WHERE status = 'active'",
                    "WHERE status = 'active' AND source_lineage ? %s"
                )
                params = [min_confidence, source, limit]

            cur.execute(query, params)
            cols = [d[0] for d in cur.description]
            rows = [dict(zip(cols, row)) for row in cur.fetchall()]

        return {"evidence": rows, "count": len(rows)}
    finally:
        release_conn(conn)


@router.get("/clusters")
def list_clusters(include_staging: bool = Query(False)):
    """
    Return all evidence clusters.
    Optionally include low-confidence staging clusters.
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, theme, confidence_score, status,
                       unique_user_count, source_lineage, created_at
                FROM evidence
                ORDER BY created_at DESC
                LIMIT 100
            """)
            cols = [d[0] for d in cur.description]
            clusters = [dict(zip(cols, row)) for row in cur.fetchall()]

            if include_staging:
                cur.execute("""
                    SELECT id, raw_text_sample, confidence_score,
                           cluster_size, frequency, first_seen, last_seen, promoted
                    FROM low_confidence_staging
                    WHERE promoted = FALSE
                    ORDER BY frequency DESC
                    LIMIT 50
                """)
                cols = [d[0] for d in cur.description]
                staging = [dict(zip(cols, row)) for row in cur.fetchall()]
            else:
                staging = []

        return {"clusters": clusters, "staging": staging}
    finally:
        release_conn(conn)
