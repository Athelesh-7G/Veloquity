"""
evidence/clustering.py
Two-stage clustering: PCA dimensionality reduction + HDBSCAN density clustering.
Replaces greedy cosine similarity. HDBSCAN naturally handles variable cluster
sizes, noise rejection, and semantic grouping without a fixed threshold.
"""
import logging
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import normalize
import hdbscan as hdbscan_lib

logger = logging.getLogger(__name__)

PCA_COMPONENTS = 50
MIN_CLUSTER_SIZE = 20
MIN_SAMPLES = 3
CLUSTER_SELECTION_EPSILON = 0.5


# ---------------------------------------------------------------------------
# Backward-compatibility shim used by evidence/confidence.py
# ---------------------------------------------------------------------------

def cosine_similarity(a, b) -> float:
    """Cosine similarity between two vectors (list or ndarray).

    Kept for backward compatibility with evidence/confidence.py which imports
    this function to compute per-item distances inside compute_confidence().
    """
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    na = np.linalg.norm(a)
    nb = np.linalg.norm(b)
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


# ---------------------------------------------------------------------------
# Main clustering function
# ---------------------------------------------------------------------------

def cluster_embeddings(
    embeddings: list,
    items: list,
    min_cluster_size: int = MIN_CLUSTER_SIZE,   # 20 (was 15)
    min_samples: int = MIN_SAMPLES,              # 3
    epsilon: float = CLUSTER_SELECTION_EPSILON,  # 0.5
) -> list:
    """Group items into semantic clusters via PCA + HDBSCAN.

    Args:
        embeddings:        List of raw embedding vectors (list[float] or ndarray).
        items:             List of item dicts parallel to embeddings. Each dict
                           must contain at minimum 'source', 'text', 'id', 'hash'.
                           The 'vector' key is preserved so downstream
                           evidence/confidence.py can compare item vectors
                           against the cluster centroid.
        min_cluster_size:  HDBSCAN minimum points to form a cluster.
        min_samples:       HDBSCAN minimum samples for core-point classification.
        epsilon:           HDBSCAN cluster selection epsilon (merge threshold).

    Returns:
        List of cluster dicts ordered by descending cluster size. Each dict has:
            label                  — HDBSCAN integer label
            cluster_id             — string alias for logging (backward compat)
            items                  — list of original item dicts (with 'vector')
            centroid               — mean embedding in L2-normalised 1024-D space
            centroid_vector        — alias for centroid (backward compat with
                                     evidence/confidence.py and evidence_writer.py)
            variance               — mean squared Euclidean distance from centroid
            avg_intra_similarity   — mean pairwise cosine similarity within cluster
            source_counts          — {source: count} breakdown
            representative_quotes  — up to 5 closest-to-centroid quote dicts
            unique_user_count      — count of distinct user/item ids
    """
    if not embeddings or len(embeddings) < min_cluster_size:
        logger.warning("Too few embeddings: %d", len(embeddings))
        return []

    logger.info("Clustering %d items with PCA+HDBSCAN", len(embeddings))

    # L2-normalise so cosine distances become Euclidean distances on the sphere.
    X = np.array(embeddings, dtype=np.float32)
    X = normalize(X, norm="l2")

    # PCA: reduce from 1024-D Titan Embed V2 space to at most PCA_COMPONENTS dims.
    n_components = min(PCA_COMPONENTS, X.shape[0] - 1, X.shape[1])
    logger.info("PCA: %d-D -> %d-D", X.shape[1], n_components)
    pca = PCA(n_components=n_components, random_state=42)
    X_reduced = pca.fit_transform(X)
    explained = pca.explained_variance_ratio_.sum()
    logger.info("PCA explained variance: %.2f%%", explained * 100)

    # HDBSCAN clustering in PCA-reduced space.
    clusterer = hdbscan_lib.HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        cluster_selection_epsilon=epsilon,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True,
    )
    labels = clusterer.fit_predict(X_reduced)

    unique_labels = set(labels)
    unique_labels.discard(-1)   # -1 = noise / unassigned
    n_noise = int((labels == -1).sum())
    logger.info(
        "HDBSCAN: %d clusters, %d noise points (%.1f%% rejected)",
        len(unique_labels), n_noise, n_noise / len(labels) * 100,
    )

    clusters = []
    for label in sorted(unique_labels):
        mask = labels == label
        cluster_indices = np.where(mask)[0]
        cluster_items = [items[i] for i in cluster_indices]

        # Centroid in the original L2-normalised 1024-D space (not PCA-reduced).
        # confidence.py will compute cosine similarities against this centroid
        # using item["vector"] (raw Bedrock vectors), which is correct because
        # cosine_similarity handles normalisation internally.
        cluster_embeddings_raw = X[mask]  # shape (n, 1024), L2-normalised
        centroid = cluster_embeddings_raw.mean(axis=0)

        # Euclidean variance in L2-normalised space (related to cosine variance
        # since ||u-v||^2 = 2 - 2*cos(u,v) for unit vectors).
        diffs = cluster_embeddings_raw - centroid
        variance = float(np.mean(np.sum(diffs ** 2, axis=1)))

        # Quality filter: skip trivially small clusters.
        unique_users = len(set(
            item.get("user_id", item.get("id", f"u{i}"))
            for i, item in enumerate(cluster_items)
        ))
        if unique_users < 2 and len(cluster_items) < 3:
            logger.debug(
                "Skipping low-quality cluster %d: %d unique users", label, unique_users
            )
            continue

        # Average pairwise intra-cluster cosine similarity.
        norms = np.linalg.norm(cluster_embeddings_raw, axis=1, keepdims=True)
        normed = cluster_embeddings_raw / (norms + 1e-9)
        sim_matrix = normed @ normed.T
        n = len(sim_matrix)
        avg_sim = 0.0
        if n > 1:
            upper = sim_matrix[np.triu_indices(n, k=1)]
            avg_sim = float(np.mean(upper))

        # Source breakdown.
        source_counts: dict = {}
        for item in cluster_items:
            src = item.get("source", "unknown")
            source_counts[src] = source_counts.get(src, 0) + 1

        # Representative quotes: items closest to the centroid.
        distances_to_centroid = np.linalg.norm(cluster_embeddings_raw - centroid, axis=1)
        rep_indices = np.argsort(distances_to_centroid)[:5]
        representative_quotes = [
            {
                "text":      cluster_items[i].get("text", ""),
                "source":    cluster_items[i].get("source", "unknown"),
                "timestamp": cluster_items[i].get("timestamp", ""),
            }
            for i in rep_indices
            if cluster_items[i].get("text")
        ]

        centroid_list = centroid.tolist()

        clusters.append({
            "label":                int(label),
            "cluster_id":           f"hdbscan_{label}",   # backward compat
            "items":                cluster_items,          # retain 'vector' key
            "centroid":             centroid_list,
            "centroid_vector":      centroid_list,          # backward compat
            "variance":             variance,
            "avg_intra_similarity": avg_sim,
            "source_counts":        source_counts,
            "representative_quotes": representative_quotes,
            "unique_user_count":    unique_users,
        })

    clusters.sort(key=lambda c: len(c["items"]), reverse=True)
    logger.info("Final clusters after quality filter: %d", len(clusters))
    return clusters
