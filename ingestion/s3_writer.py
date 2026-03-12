# =============================================================
# ingestion/s3_writer.py
# Write a normalized item as JSON to the raw S3 landing zone.
# Key pattern: {source}/{year}/{month}/{day}/{id}.json
# =============================================================

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import boto3
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger(__name__)

_s3 = None


def _get_client():
    """Return a cached S3 client."""
    global _s3
    if _s3 is None:
        _s3 = boto3.client("s3", region_name=os.environ["AWS_REGION_NAME"])
    return _s3


def write(normalized: dict[str, Any]) -> str:
    """Serialize a normalized item to JSON and upload it to the raw S3 bucket.

    The S3 key is partitioned by source and UTC date so objects are easy
    to enumerate or lifecycle-manage by day.

    Key format: {source}/{year}/{month:02d}/{day:02d}/{id}.json

    Args:
        normalized: Normalized item dict with keys id, source, timestamp, text, hash.

    Returns:
        The S3 key string of the written object.

    Raises:
        ClientError: On S3 upload failure.
    """
    bucket = os.environ["S3_RAW_BUCKET"]
    item_id = normalized["id"]
    source = normalized["source"]

    try:
        ts = datetime.fromisoformat(normalized["timestamp"])
    except (KeyError, ValueError):
        logger.warning("Could not parse timestamp for id=%s; using UTC now for S3 path", item_id)
        ts = datetime.now(tz=timezone.utc)

    s3_key = f"{source}/{ts.year}/{ts.month:02d}/{ts.day:02d}/{item_id}.json"

    body = json.dumps(normalized, ensure_ascii=False)

    try:
        _get_client().put_object(
            Bucket=bucket,
            Key=s3_key,
            Body=body.encode("utf-8"),
            ContentType="application/json",
        )
    except (BotoCoreError, ClientError) as exc:
        logger.error("S3 write failed: key=%s error=%s", s3_key, exc)
        raise

    logger.debug("Wrote s3://%s/%s", bucket, s3_key)
    return s3_key
