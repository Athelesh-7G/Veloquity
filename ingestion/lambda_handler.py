# =============================================================
# ingestion/lambda_handler.py
# Lambda entry point for the Veloquity Ingestion Agent.
#
# Expected event payload:
#   {
#     "source_type": "app_store" | "zendesk",
#     "items": [ <raw source item dicts> ]
#   }
#
# Returns:
#   {
#     "total":      int,
#     "written":    int,
#     "duplicates": int,
#     "errors":     int
#   }
# =============================================================

import logging
import os
from typing import Any

from ingestion import deduplication, normalization, s3_writer

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_REQUIRED_ENV = [
    "AWS_REGION_NAME",
    "S3_RAW_BUCKET",
    "DB_SECRET_ARN",
]


def _validate_env() -> None:
    """Raise EnvironmentError at cold-start if any required env var is absent."""
    missing = [k for k in _REQUIRED_ENV if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f"Missing required environment variables: {missing}")


_validate_env()


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    """Process a batch of raw feedback items through the ingestion pipeline.

    Pipeline per item:
        1. Normalize raw item to common schema (includes PII redaction).
        2. Deduplication check against dedup_index table.
        3. If new: write normalized JSON to S3 raw landing zone.
        4. If duplicate: skip S3 write, log and count.

    Individual item errors are caught and counted so one bad record does
    not abort the entire batch. The final counts are always returned.

    Args:
        event:   Lambda event dict. Must contain 'source_type' (str) and
                 'items' (list of raw source item dicts).
        context: Lambda context object (unused).

    Returns:
        Dict with keys: total, written, duplicates, errors.
    """
    source_type = event.get("source_type", "").strip()
    items = event.get("items", [])

    if not source_type:
        logger.error("Missing 'source_type' in event payload")
        return {
            "total": 0, "written": 0, "duplicates": 0, "errors": 0,
            "message": "source_type is required",
        }

    if not isinstance(items, list):
        logger.error("'items' must be a list, got %s", type(items).__name__)
        return {
            "total": 0, "written": 0, "duplicates": 0, "errors": 0,
            "message": "'items' must be a list",
        }

    total = len(items)
    written = 0
    duplicates = 0
    errors = 0

    logger.info("Ingestion start: source=%s total=%d", source_type, total)

    for index, raw_item in enumerate(items):
        try:
            # Step 1: Normalize (includes PII redaction internally).
            normalized = normalization.normalize(raw_item, source_type)

            # Step 2: Deduplication.
            dedup_result = deduplication.check_and_record(normalized)

            if dedup_result["is_duplicate"]:
                duplicates += 1
                logger.info(
                    "DUPLICATE [%d/%d] source=%s hash=%s",
                    index + 1, total, source_type, normalized["hash"],
                )
                continue

            # Step 3: Write to S3.
            s3_key = s3_writer.write(normalized)
            written += 1
            logger.info(
                "WRITTEN [%d/%d] source=%s id=%s s3_key=%s",
                index + 1, total, source_type, normalized["id"], s3_key,
            )

        except Exception as exc:
            errors += 1
            logger.error(
                "ERROR [%d/%d] source=%s: %s",
                index + 1, total, source_type, exc,
                exc_info=True,
            )

    logger.info(
        "Ingestion complete: source=%s total=%d written=%d duplicates=%d errors=%d",
        source_type, total, written, duplicates, errors,
    )

    return {
        "total":      total,
        "written":    written,
        "duplicates": duplicates,
        "errors":     errors,
    }
