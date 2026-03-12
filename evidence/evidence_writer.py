# =============================================================
# evidence/evidence_writer.py
# Persist accepted clusters to the evidence table and rejected
# clusters to low_confidence_staging.
# All DB access via api/db.py connection pool.
# =============================================================

import json
import logging
import math
import os
from collections import Counter
from datetime import datetime, timezone
from typing import Any

from api.db import get_conn, release_conn

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_source_lineage(items: list[dict[str, Any]]) -> dict[str, float]:
    """Compute the percentage breakdown of cluster items by source.

    Args:
        items: List of cluster item dicts, each expected to have a 'source' key.

    Returns:
        Dict mapping source name to its share of the total as a float
        rounded to 4 decimal places. Percentages sum to 1.0.
        Returns {} if items is empty.
    """
    if not items:
        return {}

    counts = Counter(item.get("source", "unknown") for item in items)
    total = len(items)
    lineage = {
        source: round(count / total, 4)
        for source, count in counts.items()
    }

    # Correct floating-point rounding drift so values always sum to exactly 1.0.
    # Adjust the largest bucket by the accumulated error.
    current_sum = sum(lineage.values())
    if current_sum != 1.0:
        largest = max(lineage, key=lineage.__getitem__)
        lineage[largest] = round(lineage[largest] + (1.0 - current_sum), 4)

    return lineage


def _most_common_source(items: list[dict[str, Any]]) -> str:
    """Return the source that appears most frequently among items.

    Args:
        items: Cluster item dicts with a 'source' key.

    Returns:
        Source string, or 'unknown' if items is empty.
    """
    if not items:
        return "unknown"
    counts = Counter(item.get("source", "unknown") for item in items)
    return counts.most_common(1)[0][0]


def _parse_timestamp(raw) -> datetime | None:
    """Parse a raw timestamp value into a timezone-aware datetime.

    Handles datetime objects, Unix float/int timestamps, and ISO 8601 strings.
    Always returns a timezone-aware datetime or None. Never raises.

    Args:
        raw: A datetime, numeric Unix timestamp, ISO 8601 string, or None.

    Returns:
        Timezone-aware datetime, or None if the value is absent or unparseable.
    """
    if raw is None:
        return None

    try:
        if isinstance(raw, datetime):
            return raw if raw.tzinfo else raw.replace(tzinfo=timezone.utc)

        if isinstance(raw, (int, float)):
            return datetime.fromtimestamp(float(raw), tz=timezone.utc)

        if isinstance(raw, str):
            s = raw.strip()
            if not s:
                return None
            # Try common ISO 8601 variants.
            for fmt in (
                "%Y-%m-%dT%H:%M:%S.%fZ",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d",
            ):
                try:
                    dt = datetime.strptime(s, fmt)
                    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue
            # fromisoformat handles many edge cases including "+00:00" offsets.
            try:
                dt = datetime.fromisoformat(s)
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except ValueError:
                pass

    except Exception:
        pass

    return None


def _derive_s3_key(item: dict) -> str:
    """Derive the S3 object key for a feedback item.

    If the item already carries an explicit 's3_key' field, that value is
    returned verbatim. Otherwise the key is built from source, timestamp,
    and item id using the standard pipeline pattern:
        {source}/{year}/{month:02d}/{day:02d}/{item_id}.json
    Malformed or missing timestamps fall back to:
        {source}/unknown/{item_id}.json

    Args:
        item: Cluster item dict. Expected keys: s3_key (optional), source,
              timestamp (optional), id.

    Returns:
        S3 key string.
    """
    if item.get("s3_key"):
        return item["s3_key"]

    source = item.get("source", "unknown")
    item_id = item.get("id", "unknown")

    dt = _parse_timestamp(item.get("timestamp"))
    if dt is not None:
        return f"{source}/{dt.year}/{dt.month:02d}/{dt.day:02d}/{item_id}.json"

    return f"{source}/unknown/{item_id}.json"


def _extract_quotes(items: list[dict[str, Any]], max_quotes: int = 5) -> list[dict]:
    """Extract representative quotes from cluster items with proportional source sampling.

    Allocates quote slots proportionally to source size (minimum 1 per source)
    so that no single source dominates the representative sample. Text is
    truncated to 300 characters.

    Args:
        items:      Cluster item dicts with 'text' and 'source' keys.
        max_quotes: Maximum total quotes to return.

    Returns:
        List of dicts like {"text": "...", "source": "app_store"}, up to
        max_quotes entries.
    """
    if not items or max_quotes <= 0:
        return []

    # Group valid (non-empty text) items by source.
    by_source: dict[str, list[dict]] = {}
    for item in items:
        text = (item.get("text") or "").strip()
        if not text:
            continue
        src = item.get("source", "unknown")
        entry = {"text": text[:300], "source": src}
        by_source.setdefault(src, []).append(entry)

    if not by_source:
        return []

    total_valid = sum(len(v) for v in by_source.values())
    sources = list(by_source.keys())

    # Proportional allocation: each source gets at least 1 slot.
    slots: dict[str, int] = {
        src: max(1, round(len(by_source[src]) / total_valid * max_quotes))
        for src in sources
    }

    # Trim down to budget by repeatedly reducing the largest over-allocated source.
    while sum(slots.values()) > max_quotes:
        trimmable = [s for s in slots if slots[s] > 1]
        if not trimmable:
            break
        slots[max(trimmable, key=lambda s: slots[s])] -= 1

    # Collect quotes in source order.
    result: list[dict] = []
    for src in sources:
        result.extend(by_source[src][: slots[src]])

    return result[:max_quotes]


def _build_theme(quotes: list[dict], max_len: int = 500) -> str:
    """Build a theme string from the first 3 representative quote dicts.

    Joins quote texts with ' | ' and truncates to max_len characters.

    Args:
        quotes:  List of {"text": str, "source": str} dicts.
        max_len: Maximum character length of the returned theme string.

    Returns:
        Theme string, possibly truncated with a trailing '…'.
    """
    joined = " | ".join(q["text"] for q in quotes[:3])
    if len(joined) <= max_len:
        return joined
    return joined[: max_len - 1] + "\u2026"


def _vector_to_pg(vector: list[float]) -> str:
    """Format a list of floats as a pgvector literal string.

    Args:
        vector: Embedding vector.

    Returns:
        String like '[0.1,0.2,...]' suitable for %s::vector cast.
    """
    return "[" + ",".join(str(v) for v in vector) + "]"


# ---------------------------------------------------------------------------
# Public writers
# ---------------------------------------------------------------------------

def write_item_map(conn, evidence_id: str, cluster_items: list[dict]) -> int:
    """Bulk-insert item-to-evidence mappings into evidence_item_map.

    Each cluster item that contributed to an accepted evidence row is
    recorded here for full lineage traceability. Skips items that are
    missing a hash or id (logs a warning; does not raise).

    Uses ON CONFLICT DO NOTHING so the call is safe to retry without
    creating duplicate rows.

    Does NOT commit — the caller owns the transaction so that the evidence
    INSERT and item map writes share the same atomic commit.

    Args:
        conn:          Live psycopg2 connection.
        evidence_id:   UUID string of the parent evidence row.
        cluster_items: List of item dicts from the cluster (each has at
                       minimum 'hash', 'id', 'source', optional 'timestamp',
                       optional 's3_key').

    Returns:
        Number of rows successfully inserted (conflicts not counted).
    """
    rows = []
    for item in cluster_items:
        item_hash = item.get("hash")
        item_id = item.get("id")
        if not item_hash or not item_id:
            logger.warning(
                "write_item_map: skipping item missing hash or id — item=%s",
                {k: item.get(k) for k in ("id", "hash", "source")},
            )
            continue
        rows.append((
            evidence_id,
            item_hash,
            _derive_s3_key(item),
            item.get("source", "unknown"),
            item_id,
            _parse_timestamp(item.get("timestamp")),
        ))

    if not rows:
        return 0

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO evidence_item_map
                (evidence_id, dedup_hash, s3_key, source, item_id, item_timestamp)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (evidence_id, dedup_hash) DO NOTHING
            """,
            rows,
        )
        inserted = cur.rowcount if cur.rowcount != -1 else len(rows)

    logger.info(
        "write_item_map: evidence_id=%s items=%d inserted=%d",
        evidence_id, len(rows), inserted,
    )
    return inserted


def write_evidence(cluster: dict[str, Any], confidence_score: float) -> str:
    """Insert an accepted cluster into the evidence table.

    Computes source lineage, extracts representative quotes (JSONB),
    derives a theme, inserts the evidence row, and bulk-inserts the
    item-to-evidence map — all within a single atomic transaction.

    Args:
        cluster:          Cluster dict with 'items' and 'centroid_vector' keys.
        confidence_score: Float in [0.0, 1.0] from compute_confidence().

    Returns:
        String UUID of the newly inserted evidence row.

    Raises:
        Exception: Re-raises any DB exception after rollback so the caller
                   can count and log the error.
    """
    items = cluster.get("items", [])
    centroid = cluster.get("centroid_vector", [])
    model_version = os.environ["BEDROCK_EMBED_MODEL"]

    source_lineage = compute_source_lineage(items)
    quotes = _extract_quotes(items, max_quotes=5)
    theme = _build_theme(quotes)
    unique_user_count = len(items)
    vector_str = _vector_to_pg(centroid)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evidence (
                    theme,
                    representative_quotes,
                    unique_user_count,
                    confidence_score,
                    source_lineage,
                    embedding_vector,
                    embedding_model_version,
                    status,
                    created_at,
                    last_validated_at
                ) VALUES (
                    %s,
                    %s::jsonb,
                    %s,
                    %s,
                    %s::jsonb,
                    %s::vector,
                    %s,
                    'active',
                    NOW(),
                    NOW()
                )
                RETURNING id
                """,
                (
                    theme,
                    json.dumps(quotes),
                    unique_user_count,
                    confidence_score,
                    json.dumps(source_lineage),
                    vector_str,
                    model_version,
                ),
            )
            evidence_id = str(cur.fetchone()[0])

        write_item_map(conn, evidence_id, items)

        conn.commit()

        logger.info(
            "write_evidence: id=%s cluster=%s score=%.4f size=%d sources=%s",
            evidence_id, cluster.get("cluster_id"), confidence_score,
            unique_user_count, list(source_lineage.keys()),
        )
        return evidence_id

    except Exception as exc:
        conn.rollback()
        logger.error(
            "write_evidence failed: cluster=%s error=%s",
            cluster.get("cluster_id"), exc,
        )
        raise
    finally:
        release_conn(conn)


def write_staging(cluster: dict[str, Any], confidence_score: float) -> str:
    """Insert or update a rejected cluster in low_confidence_staging.

    Uses ON CONFLICT on content_hash to increment the frequency counter
    when the same low-confidence content recurs across ingestion runs.
    The Governance Agent monitors frequency to detect emerging patterns.

    No item map entries are written for staging rows.

    Args:
        cluster:          Cluster dict with 'items' key.
        confidence_score: Float in [0.0, 1.0].

    Returns:
        String UUID of the inserted or updated staging row.

    Raises:
        Exception: Re-raises any DB exception after rollback.
    """
    items = cluster.get("items", [])

    # content_hash from the first item (the cluster seed).
    first_item = items[0] if items else {}
    content_hash = first_item.get("hash", cluster.get("cluster_id", ""))
    source = _most_common_source(items)

    raw_text = (first_item.get("text") or "").strip()
    if len(raw_text) > 500:
        raw_text = raw_text[:499] + "\u2026"

    cluster_size = len(items)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO low_confidence_staging (
                    content_hash,
                    source,
                    raw_text_sample,
                    confidence_score,
                    cluster_size,
                    frequency,
                    first_seen,
                    last_seen,
                    promoted
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    1,
                    NOW(), NOW(),
                    FALSE
                )
                ON CONFLICT (content_hash) DO UPDATE
                    SET frequency    = low_confidence_staging.frequency + 1,
                        last_seen    = NOW(),
                        cluster_size = EXCLUDED.cluster_size
                RETURNING id
                """,
                (
                    content_hash,
                    source,
                    raw_text or None,
                    confidence_score,
                    cluster_size,
                ),
            )
            staging_id = str(cur.fetchone()[0])
        conn.commit()

        logger.info(
            "write_staging: id=%s cluster=%s hash=%s score=%.4f size=%d",
            staging_id, cluster.get("cluster_id"), content_hash,
            confidence_score, cluster_size,
        )
        return staging_id

    except Exception as exc:
        conn.rollback()
        logger.error(
            "write_staging failed: cluster=%s error=%s",
            cluster.get("cluster_id"), exc,
        )
        raise
    finally:
        release_conn(conn)
