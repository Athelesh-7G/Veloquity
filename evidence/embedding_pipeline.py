# =============================================================
# evidence/embedding_pipeline.py
# Phase 2 entry point: read normalized items from S3, embed via
# Bedrock (with PostgreSQL cache), cluster, score confidence,
# threshold-route, and write to evidence or staging tables.
#
# Lambda event shapes accepted:
#   Single item : { "s3_key": "app_store/2024/06/15/uuid.json" }
#   Batch       : { "batch": ["app_store/...", "zendesk/..."] }
#
# Returns:
#   { "processed": int, "cache_hits": int, "bedrock_calls": int,
#     "accepted": int, "rejected": int, "errors": int }
# =============================================================

import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from api.db import get_conn, release_conn
from evidence.clustering import cluster_embeddings
from evidence.confidence import compute_confidence
from evidence.threshold import evaluate_cluster
from evidence.evidence_writer import write_evidence, write_staging

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _derive_s3_key(item: dict) -> str:
    """Derive the S3 object key for a feedback item.

    If the item already carries an explicit 's3_key' field, that value is
    returned verbatim. Otherwise the key is built from source, timestamp,
    and item id. Malformed or missing timestamps fall back to
    {source}/unknown/{item_id}.json.

    Args:
        item: Item dict. Expected keys: s3_key (optional), source,
              timestamp (optional), id.

    Returns:
        S3 key string.
    """
    if item.get("s3_key"):
        return item["s3_key"]
    source = item.get("source", "unknown")
    item_id = item.get("id", "unknown")
    raw_ts = item.get("timestamp")
    if raw_ts:
        try:
            if isinstance(raw_ts, (int, float)):
                dt = datetime.fromtimestamp(float(raw_ts), tz=timezone.utc)
            else:
                dt = datetime.fromisoformat(str(raw_ts).strip())
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
            return f"{source}/{dt.year}/{dt.month:02d}/{dt.day:02d}/{item_id}.json"
        except Exception:
            pass
    return f"{source}/unknown/{item_id}.json"


_REQUIRED_ENV = [
    "AWS_REGION_NAME",
    "S3_RAW_BUCKET",
    "DB_SECRET_ARN",
    "BEDROCK_EMBED_MODEL",
]


def _validate_env() -> None:
    """Raise EnvironmentError at cold-start if any required env var is absent."""
    missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {missing}")


_validate_env()

# ---------------------------------------------------------------------------
# Cached boto3 clients (one per Lambda container lifetime)
# ---------------------------------------------------------------------------
_s3 = None
_bedrock = None


def _get_s3():
    """Return a cached S3 client."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=os.environ["AWS_REGION_NAME"])
    return _s3


def _get_bedrock():
    """Return a cached Bedrock Runtime client."""
    global _bedrock
    if _bedrock is None:
        _bedrock = boto3.client(
            "bedrock-runtime", region_name=os.environ["AWS_REGION_NAME"]
        )
    return _bedrock


# ---------------------------------------------------------------------------
# S3 item reader
# ---------------------------------------------------------------------------

def _read_s3_item(s3_client, bucket: str, key: str) -> dict | None:
    """Read and parse a single normalized JSON item from S3.

    Ensures the returned dict always contains an 's3_key' field so
    downstream writers can record the provenance of each item without
    re-deriving it.

    Args:
        s3_client: Boto3 S3 client.
        bucket:    S3 bucket name.
        key:       S3 object key.

    Returns:
        Parsed item dict (with 's3_key' guaranteed), or None on any error.
    """
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        item = json.loads(obj["Body"].read())
        if "s3_key" not in item:
            item["s3_key"] = key
        return item
    except Exception as exc:
        logger.error("S3 read failed for key=%s: %s", key, exc)
        return None


# ---------------------------------------------------------------------------
# Embedding cache helpers
# ---------------------------------------------------------------------------

def _sha256(text: str) -> str:
    """Return the SHA-256 hex digest of UTF-8 encoded text.

    The same fingerprint used by the ingestion dedup layer, ensuring the
    cache key is consistent with the content identity across the pipeline.

    Args:
        text: Input string to hash.

    Returns:
        64-character lowercase hex string.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _cache_lookup(content_hash: str, model_version: str) -> list[float] | None:
    """Query embedding_cache for a pre-computed vector.

    Args:
        content_hash:  SHA-256 hex digest of the text.
        model_version: Embedding model identifier (cache key component).

    Returns:
        List of floats if found, None if the cache does not have an entry.

    Raises:
        Exception: Re-raises any DB exception after releasing the connection.
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT embedding_vector FROM embedding_cache "
                "WHERE content_hash = %s AND model_version = %s",
                (content_hash, model_version),
            )
            row = cur.fetchone()
        if row is None:
            return None
        # pgvector returns the vector as a Python list when using psycopg2
        # with the pgvector adapter, or as a string like "[0.1,0.2,...]".
        raw = row[0]
        if isinstance(raw, list):
            return [float(v) for v in raw]
        # String representation from pgvector without adapter registered.
        return [float(v) for v in str(raw).strip("[]").split(",")]
    except Exception as exc:
        logger.error("embedding_cache lookup failed: %s", exc)
        raise
    finally:
        release_conn(conn)


def _cache_write(
    content_hash: str, model_version: str, vector: list[float]
) -> None:
    """Insert a new embedding into embedding_cache.

    Uses INSERT … ON CONFLICT DO NOTHING so concurrent Lambda invocations
    computing the same embedding don't fail on the unique primary key.

    Args:
        content_hash:  SHA-256 hex digest of the text.
        model_version: Embedding model identifier.
        vector:        List of floats returned by Bedrock.
    """
    # pgvector expects the vector as a string literal: '[0.1,0.2,...]'
    vector_str = "[" + ",".join(str(v) for v in vector) + "]"
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO embedding_cache "
                "  (content_hash, model_version, embedding_vector) "
                "VALUES (%s, %s, %s::vector) "
                "ON CONFLICT (content_hash, model_version) DO NOTHING",
                (content_hash, model_version, vector_str),
            )
        conn.commit()
        logger.debug("Cached embedding: hash=%s model=%s", content_hash, model_version)
    except Exception as exc:
        conn.rollback()
        logger.error(
            "embedding_cache write failed: hash=%s model=%s error=%s",
            content_hash, model_version, exc,
        )
        raise
    finally:
        release_conn(conn)


# ---------------------------------------------------------------------------
# Bedrock embedding call
# ---------------------------------------------------------------------------

def _call_bedrock(text: str, model_id: str) -> list[float] | None:
    """Invoke Bedrock to compute an embedding vector for the given text.

    Sends the text to the Titan Embed V2 model endpoint. Parses the JSON
    response body and extracts the 'embedding' field (list of 1536 floats).

    Args:
        text:     The text to embed.
        model_id: Bedrock model ID, e.g. 'amazon.titan-embed-text-v2:0'.

    Returns:
        List of 1536 floats on success, or None on any Bedrock error.
    """
    payload = json.dumps({"inputText": text})
    try:
        response = _get_bedrock().invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=payload,
        )
        body = json.loads(response["body"].read())
        vector = body.get("embedding")
        if not vector or not isinstance(vector, list):
            logger.error(
                "Bedrock response missing 'embedding' field: model=%s body_keys=%s",
                model_id, list(body.keys()),
            )
            return None
        return [float(v) for v in vector]
    except (BotoCoreError, ClientError) as exc:
        logger.error("Bedrock InvokeModel failed: model=%s error=%s", model_id, exc)
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

# Module-level counters so get_or_create_embedding() can signal hits/misses
# back to the handler without threading state.
_stats: dict[str, int] = {"cache_hits": 0, "bedrock_calls": 0}


def get_or_create_embedding(text: str, model_version: str) -> list[float] | None:
    """Return an embedding vector for text, using the cache when available.

    Pipeline:
        1. SHA-256 fingerprint of text.
        2. Query embedding_cache. Cache hit → return immediately.
        3. Cache miss → call Bedrock, write result to cache, return vector.
        4. On any error → log and return None so the caller can skip/count.

    Side effects:
        Increments _stats["cache_hits"] or _stats["bedrock_calls"] for the
        current invocation. The handler reads these after the batch loop.

    Args:
        text:          Input text to embed.
        model_version: Bedrock model ID used as part of the cache key.

    Returns:
        List of floats (embedding vector), or None if embedding failed.
    """
    if not text or not text.strip():
        logger.warning("get_or_create_embedding called with empty text; skipping.")
        return None

    content_hash = _sha256(text)

    # --- cache lookup ---
    try:
        cached = _cache_lookup(content_hash, model_version)
    except Exception:
        # DB error already logged inside _cache_lookup; treat as miss.
        cached = None

    if cached is not None:
        _stats["cache_hits"] += 1
        logger.debug("Cache HIT: hash=%s model=%s", content_hash, model_version)
        return cached

    # --- cache miss: call Bedrock ---
    vector = _call_bedrock(text, model_version)
    if vector is None:
        return None

    _stats["bedrock_calls"] += 1
    logger.info(
        "Bedrock embedding computed: hash=%s model=%s dims=%d",
        content_hash, model_version, len(vector),
    )

    # Write to cache (non-fatal if it fails).
    try:
        _cache_write(content_hash, model_version, vector)
    except Exception:
        # Error already logged inside _cache_write; continue without cache.
        pass

    return vector


# ---------------------------------------------------------------------------
# Lambda entry point
# ---------------------------------------------------------------------------

def _read_and_embed_batch(s3_keys: list[str], bucket: str, model_version: str) -> dict:
    """Read S3 items and embed them. Returns embeddings list + stats.

    Args:
        s3_keys:       List of S3 object keys to read and embed.
        bucket:        S3 bucket name.
        model_version: Bedrock embed model ID.

    Returns:
        Dict with keys: embeddings (list of dicts), cache_hits, bedrock_calls, errors.
    """
    _stats["cache_hits"] = 0
    _stats["bedrock_calls"] = 0
    embed_errors = 0
    vector_items: list[dict] = []

    for s3_key in s3_keys:
        try:
            item = _read_s3_item(_get_s3(), bucket, s3_key)
            if item is None:
                embed_errors += 1
                continue

            text = item.get("text", "")
            if not text:
                logger.warning("Empty text in s3_key=%s; skipping.", s3_key)
                embed_errors += 1
                continue

            vector = get_or_create_embedding(text, model_version)
            if vector is None:
                embed_errors += 1
                logger.error(
                    "Embedding failed for s3_key=%s item_id=%s",
                    s3_key, item.get("id", s3_key),
                )
                continue

            item["vector"] = vector
            vector_items.append(item)

        except Exception as exc:
            embed_errors += 1
            logger.error("Unexpected error for key=%s: %s", s3_key, exc, exc_info=True)

    return {
        "embeddings":    vector_items,
        "cache_hits":    _stats["cache_hits"],
        "bedrock_calls": _stats["bedrock_calls"],
        "errors":        embed_errors,
    }


def _cluster_and_write_embeddings(vector_items: list[dict]) -> dict:
    """Cluster a full corpus of pre-computed embeddings and write results to DB.

    Args:
        vector_items: List of dicts each containing at minimum
                      {s3_key, item_id, text, source, hash, vector}.

    Returns:
        Dict with keys: clusters_found, accepted, rejected, errors.
    """
    clusters = cluster_embeddings(vector_items)
    logger.info("Clustering complete: clusters=%d", len(clusters))

    accepted = 0
    rejected = 0
    write_errors = 0

    for cluster in clusters:
        try:
            score = compute_confidence(cluster)
            result = evaluate_cluster(cluster, score)

            if result["decision"] == "accept":
                write_evidence(cluster, score)
                accepted += 1
            else:
                write_staging(cluster, score)
                rejected += 1

        except Exception as exc:
            write_errors += 1
            logger.error(
                "Write failed for cluster=%s: %s",
                cluster.get("cluster_id"), exc,
            )

    return {
        "clusters_found": len(clusters),
        "accepted":       accepted,
        "rejected":       rejected,
        "errors":         write_errors,
    }


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Lambda entry point — routes by event['action'].

    Action shapes:
        embed_only        : { "action": "embed_only", "batch": [...s3_keys] }
        cluster_and_write : { "action": "cluster_and_write", "embeddings": [...] }
        full_pipeline     : { "s3_key": "..." } or { "batch": [...] }  (default)

    Returns for embed_only:
        { "action": "embed_only", "embeddings": [...], "cache_hits": int,
          "bedrock_calls": int, "errors": int }

    Returns for cluster_and_write:
        { "action": "cluster_and_write", "clusters_found": int,
          "accepted": int, "rejected": int, "errors": int }

    Returns for full_pipeline:
        { "processed": int, "cache_hits": int, "bedrock_calls": int,
          "accepted": int, "rejected": int, "errors": int }

    Args:
        event:   Lambda event dict.
        context: Lambda context object (unused).
    """
    bucket = os.environ["S3_RAW_BUCKET"]
    model_version = os.environ["BEDROCK_EMBED_MODEL"]
    action = event.get("action", "full_pipeline")

    # ------------------------------------------------------------------ #
    # action = "embed_only"                                               #
    # Read S3 items, embed them, return vectors. No clustering/writing.   #
    # ------------------------------------------------------------------ #
    if action == "embed_only":
        s3_keys = event.get("batch", [])
        if not s3_keys:
            return {"action": "embed_only", "embeddings": [], "cache_hits": 0,
                    "bedrock_calls": 0, "errors": 0,
                    "message": "event must contain 'batch' for embed_only"}
        logger.info("embed_only: keys=%d model=%s", len(s3_keys), model_version)
        result = _read_and_embed_batch(s3_keys, bucket, model_version)
        return {
            "action":        "embed_only",
            "embeddings":    result["embeddings"],
            "cache_hits":    result["cache_hits"],
            "bedrock_calls": result["bedrock_calls"],
            "errors":        result["errors"],
        }

    # ------------------------------------------------------------------ #
    # action = "cluster_and_write"                                        #
    # Receive full corpus embeddings, cluster, write to DB.               #
    # ------------------------------------------------------------------ #
    if action == "cluster_and_write":
        vector_items = event.get("embeddings", [])
        if not vector_items:
            return {"action": "cluster_and_write", "clusters_found": 0,
                    "accepted": 0, "rejected": 0, "errors": 0,
                    "message": "event must contain 'embeddings' for cluster_and_write"}
        logger.info("cluster_and_write: items=%d", len(vector_items))
        result = _cluster_and_write_embeddings(vector_items)
        return {"action": "cluster_and_write", **result}

    # ------------------------------------------------------------------ #
    # Default: full_pipeline (existing behaviour)                         #
    # ------------------------------------------------------------------ #
    if "s3_key" in event:
        s3_keys = [event["s3_key"]]
    elif "batch" in event and isinstance(event["batch"], list):
        s3_keys = event["batch"]
    else:
        logger.error("Event must contain 's3_key' or 'batch' key. Got: %s", list(event.keys()))
        return {
            "processed": 0, "cache_hits": 0, "bedrock_calls": 0,
            "accepted": 0, "rejected": 0, "errors": 0,
            "message": "event must contain 's3_key' or 'batch'",
        }

    total = len(s3_keys)
    logger.info("Phase 2 pipeline start: model=%s keys=%d", model_version, total)

    embed_result = _read_and_embed_batch(s3_keys, bucket, model_version)
    vector_items = embed_result["embeddings"]
    embed_errors = embed_result["errors"]

    logger.info(
        "Embedding complete: embedded=%d embed_errors=%d "
        "cache_hits=%d bedrock_calls=%d",
        len(vector_items), embed_errors,
        embed_result["cache_hits"], embed_result["bedrock_calls"],
    )

    cluster_result = _cluster_and_write_embeddings(vector_items)

    errors = embed_errors + cluster_result["errors"]
    processed = total - embed_errors

    logger.info(
        "Phase 2 pipeline complete: total=%d processed=%d "
        "accepted=%d rejected=%d write_errors=%d errors=%d",
        total, processed, cluster_result["accepted"], cluster_result["rejected"],
        cluster_result["errors"], errors,
    )

    return {
        "processed":     processed,
        "cache_hits":    embed_result["cache_hits"],
        "bedrock_calls": embed_result["bedrock_calls"],
        "accepted":      cluster_result["accepted"],
        "rejected":      cluster_result["rejected"],
        "errors":        errors,
    }
