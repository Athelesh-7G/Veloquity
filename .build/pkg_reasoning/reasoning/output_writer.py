# =============================================================
# reasoning/output_writer.py
# Persist a completed reasoning run to the DB and S3.
# =============================================================

import json
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def write_results(
    conn,
    s3_client,
    bucket_name: str,
    evidence_ids: list[str],
    priority_scores: list[dict],
    llm_response: dict,
    token_usage: dict,
    model_id: str,
) -> str:
    """Persist a reasoning run to reasoning_runs table and write JSON report to S3.

    Steps:
        A) Insert row into reasoning_runs (all fields).
        B) Upload JSON report to S3 at reasoning-runs/{run_id}.json.
        C) Update the s3_report_key column with the final S3 key.

    Args:
        conn:           Live psycopg2 connection (caller owns lifecycle).
        s3_client:      Boto3 S3 client.
        bucket_name:    S3 bucket for reports (veloquity-reports-dev-…).
        evidence_ids:   List of UUID strings fed into this run.
        priority_scores: List of scored evidence dicts from scorer.
        llm_response:   Parsed JSON dict returned by the LLM.
        token_usage:    Dict with at least input_tokens and output_tokens.
        model_id:       Bedrock model ID string.

    Returns:
        run_id (UUID string) of the newly created reasoning_runs row.

    Raises:
        Exception: Re-raises any DB or S3 exception after logging.
    """
    run_id = str(uuid.uuid4())
    run_at = datetime.now(timezone.utc).isoformat()

    # ------------------------------------------------------------------ #
    # A) Write to reasoning_runs                                          #
    # ------------------------------------------------------------------ #
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reasoning_runs (
                    id, run_at, evidence_ids, priority_scores,
                    llm_response, model_id, token_usage, status, s3_report_key
                ) VALUES (
                    %s::uuid, %s, %s::uuid[], %s::jsonb,
                    %s::jsonb, %s, %s::jsonb, 'completed', NULL
                )
                """,
                (
                    run_id,
                    run_at,
                    evidence_ids,
                    json.dumps(priority_scores),
                    json.dumps(llm_response),
                    model_id,
                    json.dumps(token_usage),
                ),
            )
        conn.commit()
        logger.info("write_results: DB row written run_id=%s", run_id)
    except Exception as exc:
        conn.rollback()
        logger.error("write_results DB insert failed: %s", exc)
        raise

    # ------------------------------------------------------------------ #
    # B) Write JSON report to S3                                          #
    # ------------------------------------------------------------------ #
    s3_key = f"reasoning-runs/{run_id}.json"
    report = {
        "run_id":         run_id,
        "run_at":         run_at,
        "priority_scores": priority_scores,
        "llm_response":   llm_response,
        "token_usage":    token_usage,
    }
    try:
        s3_client.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=json.dumps(report, indent=2).encode("utf-8"),
            ContentType="application/json",
        )
        logger.info("write_results: S3 report written s3://%s/%s", bucket_name, s3_key)
    except Exception as exc:
        logger.error("write_results S3 upload failed: %s", exc)
        raise

    # ------------------------------------------------------------------ #
    # C) Back-fill s3_report_key                                          #
    # ------------------------------------------------------------------ #
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE reasoning_runs SET s3_report_key = %s WHERE id = %s::uuid",
                (s3_key, run_id),
            )
        conn.commit()
    except Exception as exc:
        logger.warning("write_results: failed to update s3_report_key: %s", exc)

    return run_id
