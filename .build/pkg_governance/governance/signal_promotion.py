# =============================================================
# governance/signal_promotion.py
# Promotes low-confidence staging clusters whose frequency has
# grown past the threshold (>= 10) into the active evidence table.
# =============================================================

import json
import logging

from governance.audit_log import write_audit_entry

logger = logging.getLogger(__name__)

_PROMOTION_THRESHOLD = 10


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
        source_lineage = json.dumps([source] if source else [])

        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO evidence
                    (theme, unique_user_count, confidence_score, source_lineage,
                     embedding_model_version, status)
                VALUES (%s, %s, %s, %s::jsonb, %s, 'active')
                """,
                (
                    raw_text_sample,
                    cluster_size or 0,
                    confidence_score,
                    source_lineage,
                    "promoted_from_staging",
                ),
            )
            cur.execute(
                "UPDATE low_confidence_staging SET promoted = TRUE, promoted_at = NOW() WHERE id = %s",
                (str(staging_id),),
            )

        write_audit_entry(
            conn,
            event_type="signal_promoted",
            target_id=str(staging_id),
            details={
                "cluster_size": cluster_size,
                "frequency": frequency,
                "confidence_score": float(confidence_score),
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

    logger.info("signal_promotion complete: promoted=%d", len(promoted))
    return promoted
