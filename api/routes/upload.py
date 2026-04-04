# =============================================================
# api/routes/upload.py
# POST /api/v1/upload/feedback
# Accepts a CSV file + source type, normalises rows, deduplicates
# within the payload (SHA-256), batches into groups of 50, invokes
# the ingestion Lambda per batch, returns submission summary with
# cost estimate.
# =============================================================

import csv
import hashlib
import io
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from dependencies import get_lambda_client

logger = logging.getLogger(__name__)
router = APIRouter()

_INGESTION_LAMBDA  = "veloquity-ingestion-dev"
_BATCH_SIZE        = 50
_LAMBDA_TIMEOUT_MS = 120_000  # passed to Lambda; actual HTTP timeout set in get_lambda_client

_APPSTORE_REQUIRED = {"review_id", "rating", "title", "review", "date", "version", "author"}
_ZENDESK_REQUIRED  = {"ticket_id", "subject", "description", "status", "priority", "created_at", "requester"}

# Titan Embed V2 cost estimate: avg 150 tokens/item, $0.0002 per 1 000 tokens
_COST_PER_ITEM_USD = 150 * 0.0002 / 1_000  # = 0.00000003 per item… spec says N*150*0.0000002
# Use spec formula exactly: estimated_cost = N * 150 * 0.0000002
_TITAN_RATE = 0.0000002  # per token


def _normalize_appstore(row: dict) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "source": "appstore",
        "text": row.get("review", "").strip(),
        "timestamp": row.get("date") or datetime.now(tz=timezone.utc).isoformat(),
        "metadata": {
            "review_id": row.get("review_id"),
            "rating":    row.get("rating"),
            "title":     row.get("title"),
            "version":   row.get("version"),
            "author":    row.get("author"),
        },
    }


def _normalize_zendesk(row: dict) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "source": "zendesk",
        "text": row.get("description", "").strip(),
        "timestamp": row.get("created_at") or datetime.now(tz=timezone.utc).isoformat(),
        "metadata": {
            "ticket_id": row.get("ticket_id"),
            "subject":   row.get("subject"),
            "status":    row.get("status"),
            "priority":  row.get("priority"),
            "requester": row.get("requester"),
        },
    }


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _deduplicate(items: list[dict]) -> tuple[list[dict], int]:
    """Remove duplicate items within the payload by SHA-256 of their text.
    Returns (deduplicated_items, duplicates_removed_count).
    """
    seen: set[str] = set()
    unique: list[dict] = []
    for item in items:
        h = _sha256(item["text"])
        if h not in seen:
            seen.add(h)
            item["dedup_hash"] = h
            unique.append(item)
    return unique, len(items) - len(unique)


def _batches(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


@router.post("/feedback")
def upload_feedback(
    file: UploadFile = File(...),
    source: str = Form(...),
    lambda_client=Depends(get_lambda_client),
):
    """
    Accept a CSV file and source label, normalise rows, deduplicate
    within the payload, then invoke the ingestion Lambda in batches of
    50 items.  Returns a submission summary including an estimated
    embedding cost.
    """
    # Validate source
    if source not in ("appstore", "zendesk"):
        raise HTTPException(
            status_code=400,
            detail="source must be 'appstore' or 'zendesk'",
        )

    # Validate file extension
    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are accepted (.csv extension required)",
        )

    # Read raw bytes
    content = file.file.read()
    if not content.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    # Parse CSV (handle UTF-8 BOM from Excel exports)
    try:
        text = content.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {exc}")

    if not rows:
        raise HTTPException(status_code=400, detail="CSV contains no data rows")

    # Validate required columns
    actual_cols = set(rows[0].keys())
    if source == "appstore":
        missing = _APPSTORE_REQUIRED - actual_cols
    else:
        missing = _ZENDESK_REQUIRED - actual_cols

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Missing required columns for {source}: {sorted(missing)}",
        )

    # Normalise rows
    normalise = _normalize_appstore if source == "appstore" else _normalize_zendesk
    items = [normalise(r) for r in rows]

    # Drop rows with no text
    items = [i for i in items if i["text"]]
    if not items:
        raise HTTPException(
            status_code=400,
            detail="No non-empty feedback rows found in file",
        )

    # Within-payload SHA-256 deduplication
    items, duplicates_removed = _deduplicate(items)

    # Invoke ingestion Lambda in batches of 50
    batch_results: list[dict] = []
    failed_batches = 0

    for batch_num, batch in enumerate(_batches(items, _BATCH_SIZE), start=1):
        try:
            payload = json.dumps({
                "trigger":    "upload",
                "source":     source,
                "items":      batch,
                "timeout_ms": _LAMBDA_TIMEOUT_MS,
            })
            response = lambda_client.invoke(
                FunctionName=_INGESTION_LAMBDA,
                InvocationType="RequestResponse",
                Payload=payload,
            )
            if response.get("FunctionError"):
                error_body = json.loads(response["Payload"].read())
                logger.error(
                    "Batch %d Lambda error (source=%s): %s", batch_num, source, error_body
                )
                failed_batches += 1
                batch_results.append({
                    "batch": batch_num,
                    "items": len(batch),
                    "status": "error",
                    "detail": str(error_body),
                })
            else:
                batch_results.append({
                    "batch": batch_num,
                    "items": len(batch),
                    "status": "submitted",
                })
        except Exception as exc:
            logger.error(
                "Lambda invoke failed for batch %d (source=%s): %s", batch_num, source, exc
            )
            failed_batches += 1
            batch_results.append({
                "batch": batch_num,
                "items": len(batch),
                "status": "error",
                "detail": str(exc),
            })

    submitted = sum(b["items"] for b in batch_results if b["status"] == "submitted")
    overall_status = "success" if failed_batches == 0 else "partial" if submitted > 0 else "error"

    # Cost estimate: N * 150 avg tokens * $0.0000002 per token
    estimated_cost = len(items) * 150 * _TITAN_RATE

    return {
        "status": overall_status,
        "items_submitted": submitted,
        "items_deduplicated": duplicates_removed,
        "total_unique_items": len(items),
        "batches_total": len(batch_results),
        "batches_failed": failed_batches,
        "source": source,
        "estimated_embedding_cost_usd": round(estimated_cost, 8),
        "batch_results": batch_results,
        "message": (
            f"{submitted} feedback items submitted across {len(batch_results)} batch(es). "
            f"{duplicates_removed} duplicate(s) removed. "
            f"Estimated embedding cost: ${estimated_cost:.6f}"
        ),
    }
