# =============================================================
# api/dependencies.py
# FastAPI dependency injection — DB connections, AWS clients.
# =============================================================

import logging
import os
from contextlib import contextmanager
from typing import Generator

import boto3

from db import get_conn, release_conn

logger = logging.getLogger(__name__)


class _MockCursor:
    """No-op cursor returned when no DB connection is available."""

    def __init__(self):
        self.description = []

    def execute(self, *args, **kwargs):
        """Accept any SQL but do nothing."""
        pass

    def fetchone(self):
        """Return None to indicate no rows."""
        return None

    def fetchall(self):
        """Return empty result set."""
        return []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


class _MockConnection:
    """Stub DB connection used when no real PostgreSQL is reachable."""

    def cursor(self):
        """Return a no-op cursor."""
        return _MockCursor()

    def commit(self):
        """No-op commit."""
        pass

    def close(self):
        """No-op close."""
        pass


def get_db_connection() -> Generator:
    """FastAPI dependency: yields a pooled psycopg2 connection, releases on teardown.

    Borrows from the same module-level pool as the Lambda handlers (api/db.py),
    so the long-lived Render process reuses established connections across
    requests instead of paying a TCP + TLS + auth handshake on every one.

    Falls back to a mock connection when the database is unreachable so that
    the API starts and returns empty / default responses rather than 500 errors.
    """
    try:
        conn = get_conn()
        try:
            yield conn
        finally:
            release_conn(conn)
    except Exception as exc:
        logger.warning("DB unavailable, using mock connection: %s", exc)
        yield _MockConnection()


def get_bedrock_client():
    """Return a Bedrock runtime client for us-east-1."""
    return boto3.client(
        "bedrock-runtime",
        region_name=os.environ.get("AWS_REGION_NAME", "us-east-1"),
    )


def get_lambda_client():
    """Return a Lambda client."""
    return boto3.client(
        "lambda",
        region_name=os.environ.get("AWS_REGION_NAME", "us-east-1"),
    )
