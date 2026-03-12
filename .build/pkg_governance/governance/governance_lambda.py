# =============================================================
# governance/governance_lambda.py
# Lambda entry point for the daily Governance Agent.
# Triggered by EventBridge cron. Decision-tree logic only —
# no LLM calls. Writes back to evidence store and governance_log.
# =============================================================

import json
import logging
import os

import boto3

from api.db import get_conn, release_conn
from governance import stale_detection, signal_promotion, cost_monitor
from output import html_report

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

REPORTS_BUCKET = os.environ.get("REPORTS_BUCKET", "veloquity-reports-dev-082228066878")


def handler(event: dict, context) -> dict:
    """Lambda entry point for the Governance Agent.

    Runs the full governance cycle:
      1. Detect and flag stale evidence (>30 days).
      2. Promote staging signals with frequency >= 10.
      3. Check cost signals (cache hit rate).
      4. Generate and upload HTML intelligence report.

    Args:
        event:   EventBridge event dict (unused).
        context: Lambda context object (unused).

    Returns:
        {statusCode: 200, body: JSON results} on success.
        {statusCode: 500, body: JSON error + traceback} on failure.
    """
    conn = None
    try:
        conn = get_conn()
        s3 = boto3.client("s3", region_name="us-east-1")

        stale = stale_detection.detect_and_flag_stale(conn)
        promoted = signal_promotion.promote_staging_signals(conn)
        cost = cost_monitor.check_cost_signals(conn)
        report_url = html_report.generate_and_upload(conn, s3, REPORTS_BUCKET)

        results = {
            "stale_flagged": stale,
            "signals_promoted": promoted,
            "cost_signals": cost,
            "report_url": report_url,
        }

        logger.info(
            "Governance complete: stale=%d promoted=%d cost_alert=%s report=%s",
            len(stale), len(promoted), cost.get("alert_triggered"), report_url,
        )
        return {"statusCode": 200, "body": json.dumps(results)}

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        logger.error("Governance Agent failed: %s\n%s", exc, tb)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(exc) or repr(exc), "traceback": tb}),
        }

    finally:
        if conn is not None:
            release_conn(conn)
