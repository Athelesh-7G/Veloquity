# =============================================================
# api/db.py
# PostgreSQL connection pool — all DB access goes through here.
# =============================================================

import os
import json
import boto3
import psycopg2
from psycopg2 import pool

_pool = None

def _get_credentials() -> dict:
    """Fetch DB credentials from Secrets Manager."""
    client = boto3.client("secretsmanager", region_name=os.environ["AWS_REGION_NAME"])
    secret = client.get_secret_value(SecretId=os.environ["DB_SECRET_ARN"])
    return json.loads(secret["SecretString"])

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
        )
    return _pool

def get_conn():
    """Get a connection from the pool. Use as context manager."""
    return get_pool().getconn()

def release_conn(conn):
    """Return connection to pool."""
    get_pool().putconn(conn)
