# =============================================================
# api/routes/upload.py
# POST /api/v1/upload/feedback
# Accepts a CSV file + source type, normalises rows, invokes
# the ingestion Lambda, returns submission summary.
# =============================================================

import csv
import io
import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from dependencies import get_lambda_client

logger = logging.getLogger(__name__)
router = APIRouter()

_INGESTION_LAMBDA = "veloquity-ingestion-dev"

_APPSTORE_REQUIRED = {"review_id", "rating", "title", "review", "date", "version", "author"}
_ZENDESK_REQUIRED  = {"ticket_id", "subject", "description", "status", "priority", "created_at", "requester"}


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


@router.post("/feedback")
def upload_feedback(
    file: UploadFile = File(...),
    source: str = Form(...),
    lambda_client=Depends(get_lambda_client),
):
    """
    Accept a CSV file and source label, normalise rows into the
    standard ingestion format, then invoke the ingestion Lambda.
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

    # Invoke ingestion Lambda
    try:
        payload = json.dumps({"trigger": "upload", "source": source, "items": items})
        response = lambda_client.invoke(
            FunctionName=_INGESTION_LAMBDA,
            InvocationType="RequestResponse",
            Payload=payload,
        )
        if response.get("FunctionError"):
            error_body = json.loads(response["Payload"].read())
            raise HTTPException(
                status_code=500,
                detail=f"Ingestion Lambda error: {error_body}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Lambda invoke failed for upload (source=%s): %s", source, exc)
        raise HTTPException(
            status_code=500,
            detail=f"Lambda invocation failed: {exc}",
        )

    return {
        "status": "success",
        "items_submitted": len(items),
        "source": source,
        "message": f"{len(items)} feedback items submitted to ingestion pipeline",
    }
