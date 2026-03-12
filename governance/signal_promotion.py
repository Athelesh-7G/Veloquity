# =============================================================
# governance/signal_promotion.py
# Promotes low-confidence staging clusters whose frequency has
# grown past the threshold (>= 10) into the active evidence table.
# =============================================================

import json
import logging

import psycopg2

from governance.audit_log import write_audit_entry

logger = logging.getLogger(__name__)

_PROMOTION_THRESHOLD = 10


def _recover_item_map(conn, evidence_id: str, source: str, frequency: int) -> int:
    """Best-effort recovery of item map entries for a promoted staging cluster.

    Queries dedup_index for frequently-seen items from the same source and
    bulk-inserts them into evidence_item_map so the promoted evidence row
    has at least partial provenance.

    This function is non-fatal — any failure is logged as a warning and 0 is
    returned so the caller's promotion is never blocked.

    Args:
        conn:        Live psycopg2 connection.
        evidence_id: UUID string of the newly inserted evidence row.
        source:      Source name used to filter dedup_index rows.
        frequency:   Staging row frequency; used to size the LIMIT.

    Returns:
        Number of rows inserted (0 on any failure or if nothing to insert).
    """
    limit = max(1, frequency * 2)
    try:
        with conn.cursor() as cur:
            try:
                cur.execute(
                    """
                    SELECT hash, s3_key, item_id, item_timestamp
                    FROM   dedup_index
                    WHERE  source = %s
                      AND  frequency > 1
                    ORDER  BY frequency DESC
                    LIMIT  %s
                    """,
                    (source, limit),
                )
            except psycopg2.errors.UndefinedColumn:
                logger.warning(
                    "_recover_item_map: dedup_index missing expected columns "
                    "(s3_key/item_id); skipping item map recovery for evidence_id=%s",
                    evidence_id,
                )
                return 0

            dedup_rows = cur.fetchall()

        rows = []
        for hash_, s3_key, item_id, item_timestamp in dedup_rows:
            if not hash_ or not item_id:
                continue
            resolved_key = s3_key or f"{source}/unknown/{item_id}.json"
            rows.append((evidence_id, hash_, resolved_key, source, item_id, item_timestamp))

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
            "_recover_item_map: evidence_id=%s source=%s candidates=%d inserted=%d",
            evidence_id, source, len(rows), inserted,
        )
        return inserted

    except Exception as exc:
        logger.warning(
            "_recover_item_map failed (non-fatal): evidence_id=%s error=%s",
            evidence_id, exc,
        )
        return 0


def promote_staging_signals(conn) -> list[dict]:
    """Promote staging clusters with frequency >= 10 into evidence.

    For each promotable row:
      - INSERT into evidence (theme=raw_text_sample, confidence from staging)
      - UPDATE low_confidence_staging SET promoted = TRUE
      - Write governance_log entry (event_type='signal_promoted')

    Args:
        conn: Live psycopg2 connection.

    Returns:
        List of dicts with keys: staging_id, cluster_size, frequency, confidence_score.
    """
    promoted = []

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, raw_text_sample, cluster_size, confidence_score, frequency, source
            FROM   low_confidence_staging
            WHERE  frequency >= %s
              AND  promoted = FALSE
            """,
            (_PROMOTION_THRESHOLD,),
        )
        rows = cur.fetchall()

    for staging_id, raw_text_sample, cluster_size, confidence_score, frequency, source in rows:
        try:
            source_lineage = json.dumps([source] if source else [])

            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO evidence
                        (theme, unique_user_count, confidence_score, source_lineage,
                         embedding_model_version, status)
                    VALUES (%s, %s, %s, %s::jsonb, %s, 'active')
                    RETURNING id
                    """,
                    (
                        raw_text_sample,
                        cluster_size or 0,
                        confidence_score,
                        source_lineage,
                        "promoted_from_staging",
                    ),
                )
                evidence_id = str(cur.fetchone()[0])
                cur.execute(
                    "UPDATE low_confidence_staging SET promoted = TRUE, promoted_at = NOW() WHERE id = %s",
                    (str(staging_id),),
                )

            map_rows_recovered = _recover_item_map(conn, evidence_id, source or "", frequency or 0)

            write_audit_entry(
                conn,
                event_type="signal_promoted",
                target_id=str(staging_id),
                details={
                    "cluster_size": cluster_size,
                    "frequency": frequency,
                    "confidence_score": float(confidence_score),
                    "map_rows_recovered": map_rows_recovered,
                },
            )
            conn.commit()

            promoted.append({
                "staging_id": str(staging_id),
                "cluster_size": cluster_size,
                "frequency": frequency,
                "confidence_score": float(confidence_score),
            })
            logger.info(
                "Promoted staging signal: id=%s frequency=%d confidence=%.3f",
                staging_id, frequency, confidence_score,
            )

        except Exception as exc:
            conn.rollback()
            logger.error(
                "promote_staging_signals: failed for staging_id=%s: %s",
                staging_id, exc,
            )

    logger.info("signal_promotion complete: promoted=%d", len(promoted))
    return promoted
