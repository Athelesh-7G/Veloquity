# =============================================================
# evidence/confidence.py
# Confidence scoring and classification for evidence clusters.
# Pure Python — no external ML libraries.
# =============================================================

import logging
import os

from evidence.clustering import cosine_similarity

logger = logging.getLogger(__name__)


def compute_confidence(cluster: dict) -> float:
    """Compute a confidence score for a cluster based on centroid variance.

    The score reflects how tightly packed the cluster members are around
    their centroid. Tighter clusters (lower variance) earn higher scores.

    Formula:
        For each member vector v:
            distance = 1 - cosine_similarity(v, centroid)
        variance  = mean(distances)
        confidence = clamp(1.0 - variance * 2, 0.0, 1.0)

    Rationale:
        cosine_distance in [0, 2]. Tight clusters sit near 0, so multiplying
        by 2 before subtracting from 1.0 maps the useful range [0, 0.5]
        onto a full [0, 1] confidence scale. The clamp ensures the output
        never leaves [0.0, 1.0] regardless of degenerate inputs.

    Args:
        cluster: Cluster dict with keys:
                   centroid_vector (list[float]),
                   items (list[dict] where each item has a 'vector' key).

    Returns:
        Float in [0.0, 1.0]. Higher is more confident.
    """
    centroid = cluster.get("centroid_vector", [])
    items = cluster.get("items", [])

    if not centroid or not items:
        logger.warning(
            "compute_confidence called with empty cluster centroid or items; "
            "returning 0.0."
        )
        return 0.0

    distances: list[float] = []
    for item in items:
        vec = item.get("vector")
        if vec is None:
            logger.debug("Skipping item with null vector in confidence computation.")
            continue
        sim = cosine_similarity(vec, centroid)
        distances.append(1.0 - sim)

    if not distances:
        logger.warning("No valid member vectors found; returning 0.0.")
        return 0.0

    variance = sum(distances) / len(distances)
    raw = 1.0 - (variance * 2.0)

    # Clamp to [0.0, 1.0].
    score = max(0.0, min(1.0, raw))

    logger.debug(
        "Confidence: cluster_id=%s variance=%.4f raw=%.4f score=%.4f",
        cluster.get("cluster_id", "?"), variance, raw, score,
    )
    return score


def classify_confidence(score: float) -> str:
    """Classify a confidence score into one of three routing categories.

    Thresholds are read from environment variables so they can be tuned
    without code changes. CLAUDE.md defaults:
        CONFIDENCE_AUTO_REJECT  = 0.4
        CONFIDENCE_AUTO_ACCEPT  = 0.6

    Routing:
        score <  CONFIDENCE_AUTO_REJECT  -> "reject"   (staging table)
        score <  CONFIDENCE_AUTO_ACCEPT  -> "ambiguous" (LLM validation)
        score >= CONFIDENCE_AUTO_ACCEPT  -> "accept"   (evidence table)

    Args:
        score: Float in [0.0, 1.0] from compute_confidence().

    Returns:
        One of: "reject", "ambiguous", "accept".
    """
    reject_threshold = float(os.environ.get("CONFIDENCE_AUTO_REJECT", "0.4"))
    accept_threshold = float(os.environ.get("CONFIDENCE_AUTO_ACCEPT", "0.6"))

    if score < reject_threshold:
        label = "reject"
    elif score < accept_threshold:
        label = "ambiguous"
    else:
        label = "accept"

    logger.debug(
        "classify_confidence: score=%.4f reject_thresh=%.2f accept_thresh=%.2f -> %s",
        score, reject_threshold, accept_threshold, label,
    )
    return label
