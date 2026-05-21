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


def _synthesize_cluster_name(quotes: list[dict], bedrock_client) -> str:
    """Use Nova Pro to synthesize a short formal cluster name from quotes.

    Falls back to truncated first quote if Bedrock call fails or no client.
    Format: 4-8 words, title case, describes the issue not the complaint.

    Args:
        quotes:         List of {"text": str, "source": str} dicts.
        bedrock_client: Boto3 bedrock-runtime client, or None.

    Returns:
        A 4-8 word title-case cluster name, or a truncated first quote on failure.
    """
    if not quotes or not bedrock_client:
        return _build_theme(quotes, max_len=80)

    sample_texts = [q.get("text", "")[:200] for q in quotes[:5] if q]
    sample_texts = [t for t in sample_texts if t]

    if not sample_texts:
        return _build_theme(quotes, max_len=80)

    prompt = (
        "You are analyzing product feedback clusters. "
        "Given these user feedback samples from the same cluster, "
        "generate a concise formal cluster name (4-8 words, title case) "
        "that describes the underlying issue, not the complaint. "
        "Return ONLY the cluster name, nothing else.\n\n"
        "Feedback samples:\n"
        + "\n".join(f"- {t}" for t in sample_texts)
    )

    try:
        response = bedrock_client.invoke_model(
            modelId="us.amazon.nova-pro-v1:0",
            body=json.dumps({
                "messages": [{"role": "user", "content": [{"text": prompt}]}],
                "inferenceConfig": {"maxTokens": 30, "temperature": 0.1},
            }),
            contentType="application/json",
            accept="application/json",
        )
        raw = json.loads(response["body"].read())
        name = raw["output"]["message"]["content"][0]["text"].strip().strip("\"'").strip()
        return name[:80] if name else _build_theme(quotes, max_len=80)
    except Exception as exc:
        logger.warning("_synthesize_cluster_name failed, using fallback: %s", exc)
        return _build_theme(quotes, max_len=80)


def rename_existing_clusters(conn, bedrock_client) -> dict:
    """One-time rename of clusters whose theme is still raw quote text.

    Identifies active clusters with themes longer than 60 chars or
    containing sentence-end punctuation — signatures of raw quote dumps
    produced before _synthesize_cluster_name() was added. Calls Nova Pro
    once per cluster to generate a clean 4-8 word title-case name.

    Args:
        conn:           Live psycopg2 connection (caller owns the lifecycle).
        bedrock_client: Boto3 bedrock-runtime client.

    Returns:
        {"renamed": int, "total_checked": int, "skipped": int}
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, theme, representative_quotes
            FROM evidence
            WHERE status = 'active'
            AND (
                LENGTH(theme) > 50
                OR theme LIKE '%.%'
                OR theme LIKE '%?%'
                OR theme LIKE '%!%'
                OR theme ~* '(^|\s)(the|this|our|my|i|we|you)\s'
            )
            ORDER BY confidence_score DESC
            """,
        )
        rows = cur.fetchall()

    renamed = 0
    skipped = 0

    with conn.cursor() as cur:
        for row in rows:
            evidence_id = row[0]
            old_theme   = row[1]
            quotes_raw  = row[2]

            try:
                # representative_quotes stored as JSONB — psycopg2 returns a list.
                if isinstance(quotes_raw, list):
                    quotes = quotes_raw
                elif isinstance(quotes_raw, str):
                    quotes = json.loads(quotes_raw)
                else:
                    quotes = []

                new_name = _synthesize_cluster_name(quotes, bedrock_client)

                # Accept any synthesized name under 80 chars that differs from the original.
                if new_name and new_name != old_theme and len(new_name) <= 80:
                    cur.execute(
                        "UPDATE evidence SET theme = %s WHERE id = %s",
                        (new_name, evidence_id),
                    )
                    logger.info(
                        "rename_existing_clusters: id=%s '%s' → '%s'",
                        evidence_id, old_theme[:60], new_name,
                    )
                    renamed += 1
                else:
                    skipped += 1

            except Exception as exc:
                logger.warning(
                    "rename_existing_clusters: skipping id=%s error=%s",
                    evidence_id, exc,
                )
                skipped += 1

    conn.commit()
    logger.info(
        "rename_existing_clusters: total=%d renamed=%d skipped=%d",
        len(rows), renamed, skipped,
    )
    return {"renamed": renamed, "total_checked": len(rows), "skipped": skipped}


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


def write_evidence(
    cluster: dict[str, Any],
    confidence_score: float,
    bedrock_client=None,
) -> str:
    """Insert an accepted cluster into the evidence table.

    Computes source lineage, extracts representative quotes (JSONB),
    synthesizes a formal cluster name via Nova Pro (falls back to raw quotes),
    inserts the evidence row, and bulk-inserts the item-to-evidence map —
    all within a single atomic transaction.

    Args:
        cluster:          Cluster dict with 'items' and 'centroid_vector' keys.
        confidence_score: Float in [0.0, 1.0] from compute_confidence().
        bedrock_client:   Optional boto3 bedrock-runtime client for name synthesis.

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
    # Synthesize a formal cluster name; falls back to raw quote concat on error.
    theme = _synthesize_cluster_name(quotes, bedrock_client)
    unique_user_count = len(items)
    vector_str = _vector_to_pg(centroid)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # If a cluster with the same first-3-word prefix already exists,
            # reuse its canonical name so ON CONFLICT (theme) fires correctly
            # even when Nova Pro generates a slightly different phrasing.
            first_words = " ".join(theme.split()[:3]).lower()
            cur.execute(
                "SELECT theme FROM evidence "
                "WHERE LOWER(theme) LIKE %s AND status = 'active' LIMIT 1",
                (first_words + "%",),
            )
            existing = cur.fetchone()
            if existing:
                theme = existing[0]

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
                ON CONFLICT (theme) DO UPDATE SET
                    confidence_score      = EXCLUDED.confidence_score,
                    unique_user_count     = EXCLUDED.unique_user_count,
                    source_lineage        = EXCLUDED.source_lineage,
                    representative_quotes = EXCLUDED.representative_quotes,
                    last_validated_at     = NOW(),
                    status                = 'active'
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
