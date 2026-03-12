# =============================================================
# lambda_reasoning/handler.py
# Lambda entry point for the Reasoning Agent.
# Acquires a DB connection from the pool, runs the agent,
# releases the connection, and returns the structured result.
# =============================================================

import json
import logging
import os
from typing import Any

import boto3

from api.db import get_conn, release_conn
from reasoning.agent import run_reasoning_agent

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

BUCKET = "veloquity-reports-dev-082228066878"
REGION = os.environ.get("AWS_REGION_NAME", "us-east-1")


def handler(event: dict, context: Any) -> dict:
    """Lambda entry point for the Reasoning Agent.

    Accepts any event (payload is ignored — the agent reads from DB).
    Runs the full reasoning pipeline and returns the structured output.

    Args:
        event:   Lambda event dict (unused).
        context: Lambda context object (unused).

    Returns:
        {"statusCode": 200, "body": <JSON string of result>} on success.
        {"statusCode": 500, "body": <error message string>} on failure.
    """
    conn = None
    try:
        conn = get_conn()
        bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")
        s3 = boto3.client("s3", region_name=REGION)

        result = run_reasoning_agent(conn, bedrock, s3, BUCKET)
        logger.info(
            "Reasoning Agent complete: run_id=%s recommendations=%d",
            result.get("run_id"), len(result.get("recommendations", [])),
        )
        return {"statusCode": 200, "body": json.dumps(result)}

    except Exception as exc:
        import traceback
        tb = traceback.format_exc()
        logger.error("Reasoning Agent failed: %s\n%s", exc, tb)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(exc) or repr(exc), "traceback": tb}),
        }

    finally:
        if conn is not None:
            release_conn(conn)
