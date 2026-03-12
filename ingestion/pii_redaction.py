# =============================================================
# ingestion/pii_redaction.py
# Local regex-based PII redaction. Zero external API calls.
# =============================================================

import logging
import re

logger = logging.getLogger(__name__)

# Ordered list of (name, compiled_pattern) tuples.
# Patterns are applied in sequence; each match in the text is replaced
# with [REDACTED]. Order matters when patterns could overlap — more
# specific patterns (SSN, credit card) are listed before broader ones.
_PII_PATTERNS: list[tuple[str, re.Pattern]] = [
    # Social Security Number: 123-45-6789 or 123 45 6789
    ("SSN", re.compile(r"\b\d{3}[- ]\d{2}[- ]\d{4}\b")),

    # Credit card: 16-digit groups separated by spaces or dashes
    ("CREDIT_CARD", re.compile(
        r"\b(?:\d{4}[- ]){3}\d{4}\b"
    )),

    # Email addresses
    ("EMAIL", re.compile(
        r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
    )),

    # US phone numbers: various formats
    #   (555) 123-4567 | 555-123-4567 | 555.123.4567 | +1 555 123 4567
    ("PHONE_US", re.compile(
        r"(?:\+?1[\s\-.]?)?"           # optional country code
        r"(?:\(\d{3}\)|\d{3})"         # area code with or without parens
        r"[\s\-.]"                     # separator
        r"\d{3}"                       # exchange
        r"[\s\-.]"                     # separator
        r"\d{4}"                       # subscriber
        r"\b"
    )),

    # International phone: +XX or +XXX followed by 6-12 digits
    ("PHONE_INTL", re.compile(
        r"\+\d{1,3}[\s\-.]?\d{6,12}\b"
    )),

    # IPv4 addresses
    ("IP_ADDRESS", re.compile(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b"
    )),
]


def redact(text: str) -> str:
    """Replace PII patterns in text with [REDACTED].

    Applies a fixed set of regex patterns covering emails, US and
    international phone numbers, credit card numbers, SSNs, and IPv4
    addresses. Fully local — no network calls, no external dependencies.

    Each matched span is replaced with the literal string '[REDACTED]'.
    Patterns are applied left-to-right in the order defined in
    _PII_PATTERNS; earlier matches in the text are replaced first within
    each pattern pass.

    Args:
        text: Raw input text that may contain PII.

    Returns:
        Text with all matched PII patterns replaced by '[REDACTED]'.
    """
    if not text or not text.strip():
        return text

    result = text
    for name, pattern in _PII_PATTERNS:
        before = result
        result = pattern.sub("[REDACTED]", result)
        if result != before:
            logger.debug("Redacted %s match(es) for pattern %s", result.count("[REDACTED]"), name)

    return result
