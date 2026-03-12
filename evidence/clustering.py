# =============================================================
# evidence/clustering.py
# Greedy cosine-similarity clustering of embedding vectors.
# Pure Python — no external ML libraries.
# =============================================================

import logging
import math
import os
import uuid
from typing import Any

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Vector math — pure Python, no numpy
# ---------------------------------------------------------------------------

def _dot(a: list[float], b: list[float]) -> float:
    """Return the dot product of two equal-length vectors.

    Args:
        a: First vector.
        b: Second vector.

    Returns:
        Scalar dot product.
    """
    return sum(x * y for x, y in zip(a, b))


def _norm(v: list[float]) -> float:
    """Return the L2 norm (Euclidean magnitude) of a vector.

    Args:
        v: Input vector.

    Returns:
        Non-negative float. Returns 0.0 for zero vectors.
    """
    return math.sqrt(_dot(v, v))


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors.

    Cosine similarity = dot(a, b) / (|a| * |b|).
    Returns 0.0 when either vector is the zero vector to avoid
    division by zero.

    Args:
        a: First embedding vector.
        b: Second embedding vector.

    Returns:
        Float in [-1.0, 1.0]. 1.0 means identical direction.
    """
    norm_a = _norm(a)
    norm_b = _norm(b)
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return _dot(a, b) / (norm_a * norm_b)


def _running_mean(
    current_centroid: list[float],
    current_size: int,
    new_vector: list[float],
) -> list[float]:
    """Update a running mean centroid by incorporating one new vector.

    Avoids storing all member vectors in memory during cluster construction.
    Formula: new_mean = (old_mean * n + new_vector) / (n + 1)

    Args:
        current_centroid: Current mean vector of the cluster.
        current_size:     Number of members already in the cluster.
        new_vector:       New member vector to incorporate.

    Returns:
        Updated centroid as a new list of floats.
    """
    n = current_size
    return [
        (current_centroid[i] * n + new_vector[i]) / (n + 1)
        for i in range(len(current_centroid))
    ]


# ---------------------------------------------------------------------------
# Clustering
# ---------------------------------------------------------------------------

def cluster_embeddings(vectors: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group items into clusters by greedy cosine-similarity matching.

    Algorithm:
        For each item (in order):
          1. Skip items with None vector.
          2. Compare cosine similarity against every current cluster centroid.
          3. Assign to the highest-similarity cluster if that similarity
             meets or exceeds MIN_COSINE_SIMILARITY.
          4. Otherwise start a new cluster seeded with this item.
          5. Recompute the centroid as a running mean after each assignment.
        After all items are assigned, discard clusters smaller than
        MIN_CLUSTER_SIZE.

    The greedy single-pass approach is O(N * C) where C is the number of
    clusters. It is fast, deterministic, and requires no external libraries.
    Cluster quality depends on input ordering; for MVP scale (hundreds of
    items) this is acceptable.

    Args:
        vectors: List of dicts, each with keys:
                   s3_key (str), text (str), vector (list[float] | None),
                   source (str).
                 Items where vector is None are silently skipped.

    Returns:
        List of cluster dicts:
          { cluster_id: str (uuid4),
            items: list[dict],        # member item dicts
            centroid_vector: list[float],
            size: int }
        Only clusters with size >= MIN_CLUSTER_SIZE are returned.
    """
    min_similarity = float(os.environ.get("MIN_COSINE_SIMILARITY", "0.75"))
    min_cluster_size = int(os.environ.get("MIN_CLUSTER_SIZE", "5"))

    # Each entry: { cluster_id, items, centroid_vector, size }
    clusters: list[dict[str, Any]] = []

    valid_items = [item for item in vectors if item.get("vector") is not None]
    skipped = len(vectors) - len(valid_items)
    if skipped:
        logger.info("Skipped %d items with null vectors.", skipped)

    logger.info(
        "Clustering %d items: min_similarity=%.2f min_cluster_size=%d",
        len(valid_items), min_similarity, min_cluster_size,
    )

    for item in valid_items:
        vec = item["vector"]

        # Find the best-matching existing cluster.
        best_sim = -1.0
        best_idx = -1
        for idx, cluster in enumerate(clusters):
            sim = cosine_similarity(vec, cluster["centroid_vector"])
            if sim > best_sim:
                best_sim = sim
                best_idx = idx

        if best_sim >= min_similarity and best_idx >= 0:
            # Assign to existing cluster and update centroid.
            cluster = clusters[best_idx]
            cluster["centroid_vector"] = _running_mean(
                cluster["centroid_vector"], cluster["size"], vec
            )
            cluster["items"].append(item)
            cluster["size"] += 1
            logger.debug(
                "Assigned item s3_key=%s to cluster %s (sim=%.4f size=%d)",
                item.get("s3_key"), cluster["cluster_id"], best_sim, cluster["size"],
            )
        else:
            # Seed a new cluster.
            new_cluster: dict[str, Any] = {
                "cluster_id":      str(uuid.uuid4()),
                "items":           [item],
                "centroid_vector": list(vec),   # copy to avoid mutation
                "size":            1,
            }
            clusters.append(new_cluster)
            logger.debug(
                "New cluster %s seeded with s3_key=%s",
                new_cluster["cluster_id"], item.get("s3_key"),
            )

    # Discard undersized clusters.
    qualified = [c for c in clusters if c["size"] >= min_cluster_size]
    dropped = len(clusters) - len(qualified)

    logger.info(
        "Clustering complete: total_clusters=%d qualified=%d dropped_undersized=%d",
        len(clusters), len(qualified), dropped,
    )

    return qualified
