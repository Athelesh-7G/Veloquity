# =============================================================
# ingestion/deduplication.py
# SHA-256 content fingerprint check against the dedup_index table.
# All DB access via api/db.py connection pool.
# =============================================================

import logging
from typing import Any

from api.db import get_conn, release_conn

logger = logging.getLogger(__name__)


def check_and_record(normalized: dict[str, Any]) -> dict[str, Any]:
    """Check dedup_index for the item's hash; record or increment accordingly.

    If the hash already exists in dedup_index the frequency counter is
    incremented and is_duplicate=True is returned so the caller can skip
    the S3 write.

    If the hash is new, a row is inserted into dedup_index and
    is_duplicate=False is returned so the caller proceeds to S3.

    Args:
        normalized: Normalized item dict containing at minimum 'hash' and 'source'.

    Returns:
        Dict with keys:
            is_duplicate (bool): True if this content hash was seen before.
            hash (str):          The content hash that was checked.

    Raises:
        Exception: Re-raises any DB exception after rolling back.
    """
    content_hash = normalized["hash"]
    source = normalized["source"]

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT hash FROM dedup_index WHERE hash = %s",
                (content_hash,),
            )
            row = cur.fetchone()

            if row:
                cur.execute(
                    "UPDATE dedup_index SET frequency = frequency + 1 WHERE hash = %s",
                    (content_hash,),
                )
                conn.commit()
                logger.debug("Duplicate detected: hash=%s source=%s", content_hash, source)
                return {"is_duplicate": True, "hash": content_hash}

            cur.execute(
                "INSERT INTO dedup_index (hash, source, frequency) VALUES (%s, %s, 1)",
                (content_hash, source),
            )
            conn.commit()
            logger.debug("New item recorded: hash=%s source=%s", content_hash, source)
            return {"is_duplicate": False, "hash": content_hash}

    except Exception as exc:
        conn.rollback()
        logger.error(
            "dedup_index DB error: hash=%s source=%s error=%s",
            content_hash, source, exc,
        )
        raise
    finally:
        release_conn(conn)
