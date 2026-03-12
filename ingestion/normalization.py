# =============================================================
# ingestion/normalization.py
# Flatten any source-specific raw dict into the common schema.
# Common schema: { id, source, text, timestamp, hash }
# =============================================================

import hashlib
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from ingestion.pii_redaction import redact

logger = logging.getLogger(__name__)

# Keys tried in order when extracting body text per source.
_TEXT_KEYS = {
    "app_store": ["body", "review", "text", "content", "description"],
    "zendesk":   ["description", "body", "comment", "text", "content"],
}
_TEXT_KEYS_FALLBACK = ["body", "text", "description", "review", "content", "comment"]

# Keys tried in order when extracting timestamp per source.
_TS_KEYS = {
    "app_store": ["date", "updated", "created_at", "timestamp"],
    "zendesk":   ["created_at", "updated_at", "date", "timestamp"],
}
_TS_KEYS_FALLBACK = ["created_at", "updated_at", "date", "timestamp"]

_TS_FORMATS = (
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d",
)


def _extract_text(raw: dict, source: str) -> str:
    """Pull the best available text field from a raw item dict.

    Args:
        raw:    Source-specific raw item dict.
        source: Source type string, e.g. 'app_store' or 'zendesk'.

    Returns:
        Extracted text string, or empty string if no field matched.
    """
    keys = _TEXT_KEYS.get(source, []) + _TEXT_KEYS_FALLBACK
    seen = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        value = raw.get(key)
        if value and isinstance(value, str) and value.strip():
            return value.strip()
    logger.warning("No text field found for source=%s", source)
    return ""


def _extract_timestamp(raw: dict, source: str) -> str:
    """Parse the best available timestamp field to ISO 8601.

    Falls back to UTC NOW() if the field is missing or unparseable.

    Args:
        raw:    Source-specific raw item dict.
        source: Source type string.

    Returns:
        ISO 8601 timestamp string with UTC timezone.
    """
    keys = _TS_KEYS.get(source, []) + _TS_KEYS_FALLBACK
    seen = set()
    for key in keys:
        if key in seen:
            continue
        seen.add(key)
        value = raw.get(key)
        if not value:
            continue

        if isinstance(value, datetime):
            dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
            return dt.isoformat()

        if isinstance(value, (int, float)):
            try:
                return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
            except (OSError, ValueError, OverflowError):
                continue

        if isinstance(value, str) and value.strip():
            for fmt in _TS_FORMATS:
                try:
                    dt = datetime.strptime(value.strip(), fmt)
                    if dt.tzinfo is None:
                        dt = dt.replace(tzinfo=timezone.utc)
                    return dt.isoformat()
                except ValueError:
                    continue

    logger.debug("Timestamp parse failed for source=%s; defaulting to NOW()", source)
    return datetime.now(tz=timezone.utc).isoformat()


def _sha256(text: str) -> str:
    """Return SHA-256 hex digest of UTF-8 encoded text.

    Hash is computed on text only — metadata is excluded so the same
    user feedback ingested from different sources or at different times
    still deduplicates correctly.

    Args:
        text: Normalised, PII-redacted text string.

    Returns:
        64-character lowercase hex string.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize(raw: dict[str, Any], source: str) -> dict[str, Any]:
    """Normalize a raw source item into the common Veloquity schema.

    Pipeline:
        1. Extract text from source-specific field.
        2. Redact PII via Comprehend.
        3. Compute SHA-256 hash of redacted text.
        4. Parse timestamp to ISO 8601.
        5. Assign a new UUID v4.

    Args:
        raw:    Raw item dict from the originating source.
        source: Source type string ('app_store' | 'zendesk').

    Returns:
        Normalized dict with keys: id, source, text, timestamp, hash.
    """
    raw_text = _extract_text(raw, source)
    clean_text = redact(raw_text)
    content_hash = _sha256(clean_text)
    timestamp = _extract_timestamp(raw, source)

    return {
        "id":        str(uuid.uuid4()),
        "source":    source,
        "text":      clean_text,
        "timestamp": timestamp,
        "hash":      content_hash,
    }
