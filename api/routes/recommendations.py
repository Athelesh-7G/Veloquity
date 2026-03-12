# =============================================================
# api/routes/recommendations.py
# GET /api/v1/recommendations  — latest reasoning run output
# =============================================================

import json

from fastapi import APIRouter, Depends, HTTPException

from dependencies import get_db_connection
from schemas import Recommendation, ReasoningRun

router = APIRouter()


@router.get("/", response_model=ReasoningRun)
def get_recommendations(conn=Depends(get_db_connection)):
    """Return the most recent reasoning run with parsed recommendations."""
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, run_at, model_id, token_usage, llm_response
            FROM reasoning_runs
            ORDER BY run_at DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=404, detail="No reasoning runs found")

    run_id, run_at, model_id, token_usage, llm_response = row

    if isinstance(llm_response, str):
        llm_response = json.loads(llm_response)
    if isinstance(token_usage, str):
        token_usage = json.loads(token_usage)

    recommendations_raw = llm_response.get("recommendations", [])
    meta = llm_response.get("meta", {})

    recommendations = [
        Recommendation(
            rank=r.get("rank", i + 1),
            theme=r.get("theme", ""),
            recommended_action=r.get("recommended_action", ""),
            effort_estimate=r.get("effort_estimate", "medium"),
            user_impact=r.get("user_impact", "medium"),
            tradeoff_explanation=r.get("tradeoff_explanation", ""),
            risk_flags=r.get("risk_flags", []),
            related_clusters=r.get("related_clusters", []),
        )
        for i, r in enumerate(recommendations_raw)
    ]

    return ReasoningRun(
        id=str(run_id),
        run_at=run_at,
        model_id=model_id or "",
        token_usage=token_usage or {},
        recommendations=recommendations,
        reasoning_summary=meta.get("reasoning_summary", ""),
        highest_priority_theme=meta.get("highest_priority_theme", ""),
        cross_cluster_insight=meta.get("cross_cluster_insight", ""),
    )
