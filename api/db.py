# =============================================================
# api/db.py
# PostgreSQL connection pool — all DB access goes through here.
# =============================================================

import os
import json
import boto3
import psycopg2
from psycopg2 import pool

# Module-level so a warm Lambda container (and the long-lived Render API process)
# reuses established connections instead of paying the TCP + TLS + auth handshake
# on every invocation. Both are lazily initialized on first use.
_pool = None
_secrets_client = None
_credentials = None

def _get_secrets_client():
    """Cached Secrets Manager client — client construction has real latency."""
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client(
            "secretsmanager", region_name=os.environ["AWS_REGION_NAME"]
        )
    return _secrets_client

def _get_credentials() -> dict:
    """Fetch DB credentials from Secrets Manager, cached for the container's life."""
    global _credentials
    if _credentials is None:
        secret = _get_secrets_client().get_secret_value(
            SecretId=os.environ["DB_SECRET_ARN"]
        )
        _credentials = json.loads(secret["SecretString"])
    return _credentials

def get_pool() -> pool.SimpleConnectionPool:
    """Return (or initialize) the global connection pool."""
    global _pool
    if _pool is None:
        creds = _get_credentials()
        _pool = pool.SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            host=creds["host"],
            port=int(creds["port"]),
            dbname=creds["dbname"],
            user=creds["username"],
            password=creds["password"],
            # Fail fast instead of hanging a Lambda for its full timeout.
            connect_timeout=5,
            # A pooled connection can sit idle between invocations (keep-warm pings
            # every 5 min). Without keepalives, RDS/NAT silently drops it and the
            # next borrower fails mid-query. These probe the socket and keep it alive.
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=5,
        )
    return _pool

def get_conn():
    """
    Borrow a connection from the pool.

    Discards connections known to be closed (e.g. dropped while the container was
    idle) and replaces them, so callers never receive a dead handle.
    """
    p = get_pool()
    conn = p.getconn()
    if conn.closed:
        p.putconn(conn, close=True)
        conn = p.getconn()
    return conn

def release_conn(conn):
    """
    Return a connection to the pool.

    Rolls back first: a caller that raised mid-transaction would otherwise leave
    an aborted transaction on the connection, and the next borrower of that same
    pooled connection would fail with InFailedSqlTransaction.
    """
    if conn is None:
        return
    if conn.closed:
        get_pool().putconn(conn, close=True)
        return
    try:
        conn.rollback()
    except psycopg2.Error:
        get_pool().putconn(conn, close=True)
        return
    get_pool().putconn(conn)
