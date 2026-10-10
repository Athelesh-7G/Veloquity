"""
db/seed/seed_config.py
Shared config helpers for the seed / local-runner scripts.

Everything environment-specific comes from environment variables; DB
credentials come from AWS Secrets Manager via DB_SECRET_ARN (same source as
api/db.py). Secret values are never printed or logged.
"""

import json
import os
import sys

import boto3

DEFAULT_REGION = "us-east-1"


def require_env(*names: str) -> dict:
    """Return {name: value} for each name, or exit with one clear error listing every missing one."""
    missing = [n for n in names if not os.environ.get(n)]
    if missing:
        print(
            "ERROR: required environment variable(s) not set: " + ", ".join(missing),
            file=sys.stderr,
        )
        sys.exit(1)
    return {n: os.environ[n] for n in names}


def get_region() -> str:
    return os.environ.get("AWS_REGION_NAME") or DEFAULT_REGION


def get_db_credentials() -> dict:
    """Fetch DB credentials (host, port, dbname, username, password) from Secrets Manager."""
    secret_arn = require_env("DB_SECRET_ARN")["DB_SECRET_ARN"]
    try:
        client = boto3.client("secretsmanager", region_name=get_region())
        secret = client.get_secret_value(SecretId=secret_arn)
        return json.loads(secret["SecretString"])
    except Exception as exc:
        # Type only: the message could echo request details we don't want in logs.
        print(
            f"ERROR: could not fetch DB credentials from Secrets Manager ({type(exc).__name__}).",
            file=sys.stderr,
        )
        sys.exit(1)


def get_direct_conn(creds: dict = None):
    """Open a direct psycopg2 connection to RDS using Secrets Manager credentials."""
    import psycopg2

    creds = creds or get_db_credentials()
    return psycopg2.connect(
        host=creds["host"],
        port=int(creds["port"]),
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"],
        connect_timeout=15,
    )
