# =============================================================
# api/routes/metrics.py
# GET /api/v1/metrics
# Returns pipeline health, model performance, agent activity,
# and cost estimate statistics queried from RDS.
# =============================================================

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends

from dependencies import get_db_connection

logger = logging.getLogger(__name__)
router = APIRouter()

# Cost constants (same as upload.py)
_TITAN_RATE_PER_TOKEN = 0.0000002   # Titan Embed V2, per token
_NOVA_RATE_PER_TOKEN  = 0.0000008   # Nova Pro, per token
_AVG_EMBED_TOKENS     = 150
_AVG_REASONING_TOKENS = 2_000


def _safe_query(cur, sql: str, params=None) -> list[dict]:
    """Execute a query and return rows as dicts, returning [] on error."""
    try:
        if params:
            cur.execute(sql, params)
        else:
            cur.execute(sql)
        cols = [d[0] for d in cur.description]
        return [dict(zip(cols, r)) for r in cur.fetchall()]
    except Exception as exc:
        logger.warning("metrics query failed: %s — %s", sql[:80], exc)
        return []


def _safe_scalar(cur, sql: str, params=None, default=0):
    """Execute a scalar query and return the first column of the first row."""
    rows = _safe_query(cur, sql, params)
    if rows:
        return list(rows[0].values())[0] or default
    return default


@router.get("/", response_model=dict[str, Any])
def get_metrics(conn=Depends(get_db_connection)):
    """
    Return platform-wide metrics across four categories:
    - data_pipeline: evidence clusters, dedup, embedding cache
    - model_performance: confidence scores, cluster sizes
    - agent_activity: reasoning runs, governance runs, agent statuses
    - cost_estimates: calculated from run counts and token estimates
    """
    with conn.cursor() as cur:
        # ── Data Pipeline ────────────────────────────────────────────
        total_evidence      = _safe_scalar(cur, "SELECT COUNT(*) FROM evidence")
        active_evidence     = _safe_scalar(cur, "SELECT COUNT(*) FROM evidence WHERE status = 'active'")
        stale_evidence      = _safe_scalar(cur, "SELECT COUNT(*) FROM evidence WHERE status = 'stale'")
        rejected_evidence   = _safe_scalar(cur, "SELECT COUNT(*) FROM evidence WHERE status = 'rejected'")

        total_items         = _safe_scalar(cur, "SELECT COUNT(*) FROM evidence_item_map")
        unique_sources_rows = _safe_query(cur, "SELECT DISTINCT source FROM evidence_item_map")
        unique_sources      = [r["source"] for r in unique_sources_rows]

        cache_total         = _safe_scalar(cur, "SELECT COUNT(*) FROM embedding_cache")
        cache_hits_rows     = _safe_query(cur, """
            SELECT SUM(hit_count) AS hits FROM embedding_cache
        """)
        cache_hits          = int(cache_hits_rows[0].get("hits") or 0) if cache_hits_rows else 0

        dedup_rows          = _safe_query(cur, "SELECT COUNT(DISTINCT dedup_hash) AS unique_hashes FROM evidence_item_map")
        unique_hashes       = int(dedup_rows[0].get("unique_hashes") or 0) if dedup_rows else 0

        staging_total       = _safe_scalar(cur, "SELECT COUNT(*) FROM staging_feedback")
        staging_pending     = _safe_scalar(cur, "SELECT COUNT(*) FROM staging_feedback WHERE status = 'pending'")

        # ── Model Performance ────────────────────────────────────────
        conf_rows = _safe_query(cur, """
            SELECT
                AVG(confidence_score)::float   AS avg_confidence,
                MAX(confidence_score)::float   AS max_confidence,
                MIN(confidence_score)::float   AS min_confidence,
                AVG(unique_user_count)::float  AS avg_cluster_size,
                MAX(unique_user_count)          AS max_cluster_size
            FROM evidence
            WHERE status = 'active'
        """)
        conf = conf_rows[0] if conf_rows else {}

        threshold_rows = _safe_query(cur, """
            SELECT
                SUM(CASE WHEN confidence_score >= 0.6  THEN 1 ELSE 0 END) AS auto_accepted,
                SUM(CASE WHEN confidence_score >= 0.4
                         AND confidence_score < 0.6    THEN 1 ELSE 0 END) AS llm_validated,
                SUM(CASE WHEN confidence_score < 0.4   THEN 1 ELSE 0 END) AS auto_rejected
            FROM evidence
        """)
        thresh = threshold_rows[0] if threshold_rows else {}

        # ── Agent Activity ───────────────────────────────────────────
        reasoning_runs   = _safe_scalar(cur, "SELECT COUNT(*) FROM reasoning_runs")
        latest_run_rows  = _safe_query(cur, """
            SELECT run_at, highest_priority_theme
            FROM reasoning_runs
            ORDER BY run_at DESC
            LIMIT 1
        """)
        latest_run = latest_run_rows[0] if latest_run_rows else {}

        total_tokens_rows = _safe_query(cur, """
            SELECT SUM((token_usage->>'total_tokens')::int) AS total_tokens
            FROM reasoning_runs
            WHERE token_usage IS NOT NULL
        """)
        total_reasoning_tokens = int(total_tokens_rows[0].get("total_tokens") or 0) if total_tokens_rows else 0

        governance_rows  = _safe_query(cur, """
            SELECT event_type, COUNT(*) AS cnt
            FROM governance_log
            GROUP BY event_type
            ORDER BY cnt DESC
        """)
        governance_by_type = {r["event_type"]: int(r["cnt"]) for r in governance_rows}
        total_governance = sum(governance_by_type.values())

        agent_rows = _safe_query(cur, """
            SELECT name, display_name, last_run_at, last_run_status, total_runs
            FROM agent_status
            ORDER BY last_run_at DESC NULLS LAST
        """)

        # ── Cost Estimates ───────────────────────────────────────────
        embedding_cost = unique_hashes * _AVG_EMBED_TOKENS * _TITAN_RATE_PER_TOKEN
        reasoning_cost = (
            total_reasoning_tokens * _NOVA_RATE_PER_TOKEN
            if total_reasoning_tokens > 0
            else reasoning_runs * _AVG_REASONING_TOKENS * _NOVA_RATE_PER_TOKEN
        )
        total_cost = embedding_cost + reasoning_cost

    now = datetime.now(tz=timezone.utc).isoformat()

    return {
        "generated_at": now,
        "data_pipeline": {
            "evidence_clusters": {
                "total":    int(total_evidence),
                "active":   int(active_evidence),
                "stale":    int(stale_evidence),
                "rejected": int(rejected_evidence),
            },
            "feedback_items": {
                "total_mapped":   int(total_items),
                "unique_hashes":  int(unique_hashes),
                "sources":        unique_sources,
            },
            "embedding_cache": {
                "total_entries": int(cache_total),
                "total_hits":    cache_hits,
            },
            "staging": {
                "total":   int(staging_total),
                "pending": int(staging_pending),
            },
        },
        "model_performance": {
            "confidence": {
                "avg": round(float(conf.get("avg_confidence") or 0), 4),
                "max": round(float(conf.get("max_confidence") or 0), 4),
                "min": round(float(conf.get("min_confidence") or 0), 4),
            },
            "cluster_size": {
                "avg": round(float(conf.get("avg_cluster_size") or 0), 1),
                "max": int(conf.get("max_cluster_size") or 0),
            },
            "thresholds": {
                "auto_accepted":  int(thresh.get("auto_accepted") or 0),
                "llm_validated":  int(thresh.get("llm_validated") or 0),
                "auto_rejected":  int(thresh.get("auto_rejected") or 0),
            },
        },
        "agent_activity": {
            "reasoning_runs": {
                "total":                int(reasoning_runs),
                "total_tokens_used":    total_reasoning_tokens,
                "latest_run_at":        latest_run.get("run_at"),
                "latest_priority_theme": latest_run.get("highest_priority_theme"),
            },
            "governance": {
                "total_events":  total_governance,
                "by_type":       governance_by_type,
            },
            "agents": [
                {
                    "name":            r.get("name"),
                    "display_name":    r.get("display_name"),
                    "last_run_at":     r.get("last_run_at"),
                    "last_run_status": r.get("last_run_status"),
                    "total_runs":      r.get("total_runs"),
                }
                for r in agent_rows
            ],
        },
        "cost_estimates": {
            "embedding_cost_usd":  round(embedding_cost, 6),
            "reasoning_cost_usd":  round(reasoning_cost, 6),
            "total_cost_usd":      round(total_cost, 6),
            "basis": {
                "unique_items_embedded":    int(unique_hashes),
                "avg_tokens_per_embedding": _AVG_EMBED_TOKENS,
                "titan_rate_per_token":     _TITAN_RATE_PER_TOKEN,
                "reasoning_runs":           int(reasoning_runs),
                "avg_tokens_per_run":       _AVG_REASONING_TOKENS,
                "nova_rate_per_token":      _NOVA_RATE_PER_TOKEN,
            },
        },
    }
