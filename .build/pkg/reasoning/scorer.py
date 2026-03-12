# =============================================================
# reasoning/scorer.py
# Compute priority scores for evidence clusters.
# Combines confidence, user count, source diversity, and recency.
# =============================================================

import logging

logger = logging.getLogger(__name__)

# Weights must sum to 1.0.
_W_CONFIDENCE   = 0.35
_W_USER_COUNT   = 0.25
_W_SOURCE_CORR  = 0.20
_W_RECENCY      = 0.20

_SOURCE_CORR_BONUS = 0.1   # added when more than one source is present
_USER_COUNT_NORM   = 50.0  # user count is divided by this before clamping to [0,1]


def compute_priority_scores(evidence_list: list[dict]) -> list[dict]:
    """Score and rank evidence clusters by product-planning priority.

    For each cluster:
        source_corroboration  = 0.1 if len(source_lineage) > 1 else 0.0
        normalized_user_count = min(unique_user_count / 50.0, 1.0)
        priority_score = (
            confidence_score      * 0.35
            + normalized_user_count * 0.25
            + source_corroboration  * 0.20
            + recency_score         * 0.20
        )

    Args:
        evidence_list: List of evidence dicts from fetch_active_evidence().
                       Each must have: confidence_score, unique_user_count,
                       source_lineage (dict), recency_score.

    Returns:
        Same list with priority_score (float, 4 dp) added to each dict,
        sorted descending by priority_score.
    """
    scored = []
    for ev in evidence_list:
        conf_score  = float(ev.get("confidence_score", 0.0))
        user_count  = int(ev.get("unique_user_count", 0))
        lineage     = ev.get("source_lineage") or {}
        recency     = float(ev.get("recency_score", 0.0))

        source_corroboration  = _SOURCE_CORR_BONUS if len(lineage) > 1 else 0.0
        normalized_user_count = min(user_count / _USER_COUNT_NORM, 1.0)

        priority = (
            conf_score            * _W_CONFIDENCE
            + normalized_user_count * _W_USER_COUNT
            + source_corroboration  * _W_SOURCE_CORR
            + recency               * _W_RECENCY
        )

        scored.append({
            **ev,
            "source_corroboration":  round(source_corroboration, 4),
            "normalized_user_count": round(normalized_user_count, 4),
            "priority_score":        round(priority, 4),
        })

    scored.sort(key=lambda x: x["priority_score"], reverse=True)
    logger.info(
        "compute_priority_scores: scored %d clusters; top score=%.4f",
        len(scored), scored[0]["priority_score"] if scored else 0.0,
    )
    return scored
