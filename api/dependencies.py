# =============================================================
# api/dependencies.py
# FastAPI dependency injection — DB connections, AWS clients.
# =============================================================

import json
import logging
import os
from contextlib import contextmanager
from typing import Generator

import boto3
import psycopg2

logger = logging.getLogger(__name__)

_pool = None


def _get_credentials() -> dict:
    """Fetch DB credentials — Secrets Manager first, direct env vars as fallback."""
    secret_arn = os.environ.get("DB_SECRET_ARN", "")

    # If explicit direct-connect env vars are set, use them directly
    if os.environ.get("DB_HOST"):
        return {
            "host": os.environ["DB_HOST"],
            "port": int(os.environ.get("DB_PORT", 5432)),
            "dbname": os.environ.get("DB_NAME", "veloquity"),
            "username": os.environ.get("DB_USER", "veloquity_user"),
            "password": os.environ.get("DB_PASSWORD", ""),
        }

    # Fall back to Secrets Manager
    client = boto3.client(
        "secretsmanager",
        region_name=os.environ.get("AWS_REGION_NAME", "us-east-1"),
    )
    secret = client.get_secret_value(SecretId=secret_arn)
    return json.loads(secret["SecretString"])


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
    """FastAPI dependency: yields a psycopg2 connection, closes on teardown.

    Falls back to a mock connection when the database is unreachable so that
    the API starts and returns empty / default responses rather than 500 errors.
    """
    try:
        creds = _get_credentials()
        conn = psycopg2.connect(
            host=creds["host"],
            port=int(creds["port"]),
            dbname=creds["dbname"],
            user=creds["username"],
            password=creds["password"],
        )
        try:
            yield conn
        finally:
            conn.close()
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
