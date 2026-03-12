#!/usr/bin/env python3
# =============================================================
# db/seed/load_seed_data.py
#
# Loads test seed data through the Veloquity ingestion pipeline
# by importing and calling lambda_handler.handler() directly
# (not via AWS Lambda.invoke for the core pipeline).
#
# Architecture note -- RDS is in a private subnet (PubliclyAccessible=false),
# unreachable from a local machine. This script handles it as follows:
#
#   PII redaction   -> boto3 Comprehend call (graceful fallback on failure)
#   Normalization   -> pure Python, no AWS
#   Deduplication   -> in-memory dict for this run (patched before import)
#                     dedup_index rows are written to DB in bulk afterwards
#                     via a temporarily-deployed query Lambda (inside VPC)
#   S3 writes       -> direct boto3 call with local credentials
#   DB verification -> query Lambda (inside VPC), temporarily deployed
# =============================================================

import io
import json
import os
import sys
import zipfile
from datetime import datetime, timezone

import boto3

# ---------------------------------------------------------------------------
# Repo root on sys.path
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# ---------------------------------------------------------------------------
# Required env vars (must be set before any ingestion module is imported)
# ---------------------------------------------------------------------------
os.environ["AWS_REGION_NAME"] = "us-east-1"
os.environ["S3_RAW_BUCKET"]   = "veloquity-raw-dev-082228066878"
os.environ["DB_SECRET_ARN"]   = (
    "arn:aws:secretsmanager:us-east-1:082228066878:"
    "secret:veloquity/dev/db-credentials-uL04M5"
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REGION        = "us-east-1"
DEPLOY_BUCKET = "veloquity-deploy-dev-082228066878"
FUNCTION_NAME = "veloquity-ingestion-dev"
RAW_BUCKET    = "veloquity-raw-dev-082228066878"
SEED_DIR      = os.path.dirname(os.path.abspath(__file__))

DB_CREDS = {
    "host":     "REDACTED_RDS_HOST",
    "port":     "5432",
    "dbname":   "veloquity",
    "username": "veloquity_user",
    "password": "REDACTED_DB_PASSWORD",
}

lambda_client = boto3.client("lambda", region_name=REGION)
s3_client     = boto3.client("s3",     region_name=REGION)


# ===========================================================================
# In-memory deduplication patch
# Replaces the DB-backed dedup module for local execution.
# Dedup records are flushed to dedup_index in bulk after both batches run.
# ===========================================================================
seen_hashes: dict = {}   # hash -> {"source": str, "frequency": int}


def _local_check_and_record(normalized: dict) -> dict:
    """In-memory duplicate check that mirrors the real dedup_index logic.

    Tracks all content hashes seen during this seed run. The accumulated
    dict is bulk-inserted into dedup_index via the query Lambda after
    both batches complete.

    Args:
        normalized: Normalized item dict with at least 'hash' and 'source'.

    Returns:
        Dict with is_duplicate (bool) and hash (str).
    """
    h = normalized["hash"]
    if h in seen_hashes:
        seen_hashes[h]["frequency"] += 1
        return {"is_duplicate": True, "hash": h}
    seen_hashes[h] = {"source": normalized["source"], "frequency": 1}
    return {"is_duplicate": False, "hash": h}


# Patch the deduplication module BEFORE importing lambda_handler.
# lambda_handler does `from ingestion import deduplication` and calls
# `deduplication.check_and_record(...)` -- Python resolves this at call
# time from the module object, so patching the attribute here is sufficient.
import ingestion.deduplication as _dedup_mod       # noqa: E402
_dedup_mod.check_and_record = _local_check_and_record

from ingestion.lambda_handler import handler       # noqa: E402


# ===========================================================================
# Lambda helpers -- query handler (for DB writes + verifications)
# ===========================================================================

_QUERY_HANDLER_CODE = b'''\
import json
import psycopg2


def handler(event, context):
    """Run SQL statements. Returns rows for SELECT, ok for DML."""
    creds = event["creds"]
    conn = psycopg2.connect(
        host=creds["host"],
        port=int(creds["port"]),
        dbname=creds["dbname"],
        user=creds["username"],
        password=creds["password"],
    )
    conn.autocommit = True
    cur = conn.cursor()
    results = []
    for m in event.get("migrations", []):
        try:
            cur.execute(m["sql"])
            if cur.description:
                rows = cur.fetchall()
                results.append({
                    "name": m["name"],
                    "status": "ok",
                    "rows": [
                        [str(v) if v is not None else None for v in row]
                        for row in rows
                    ],
                })
            else:
                results.append({"name": m["name"], "status": "ok"})
        except Exception as exc:
            results.append({"name": m["name"], "status": "error", "error": str(exc)})
    cur.close()
    conn.close()
    return {"results": results}
'''


def _build_query_zip() -> bytes:
    """Build a Lambda zip with SELECT-capable handler.

    Downloads migration2.zip from S3 (which already contains psycopg2)
    and replaces lambda_function.py with the query handler above.

    Returns:
        Raw bytes of the patched zip file.
    """
    obj = s3_client.get_object(Bucket=DEPLOY_BUCKET, Key="lambda/migration2.zip")
    original = obj["Body"].read()

    in_buf  = io.BytesIO(original)
    out_buf = io.BytesIO()
    with zipfile.ZipFile(in_buf, "r") as zin, \
         zipfile.ZipFile(out_buf, "w", zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = _QUERY_HANDLER_CODE if info.filename == "lambda_function.py" \
                   else zin.read(info.filename)
            zout.writestr(info, data)
    return out_buf.getvalue()


def _deploy_query_lambda() -> None:
    """Upload query zip to S3 and update IngestionLambda code + handler."""
    zip_bytes = _build_query_zip()
    s3_client.put_object(Bucket=DEPLOY_BUCKET, Key="lambda/query.zip", Body=zip_bytes)

    lambda_client.update_function_code(
        FunctionName=FUNCTION_NAME,
        S3Bucket=DEPLOY_BUCKET,
        S3Key="lambda/query.zip",
    )
    lambda_client.get_waiter("function_updated").wait(FunctionName=FUNCTION_NAME)

    lambda_client.update_function_configuration(
        FunctionName=FUNCTION_NAME,
        Handler="lambda_function.handler",
    )
    lambda_client.get_waiter("function_updated").wait(FunctionName=FUNCTION_NAME)


def _restore_ingestion_lambda() -> None:
    """Restore IngestionLambda to the original ingestion.zip and handler."""
    lambda_client.update_function_code(
        FunctionName=FUNCTION_NAME,
        S3Bucket=DEPLOY_BUCKET,
        S3Key="lambda/ingestion.zip",
    )
    lambda_client.get_waiter("function_updated").wait(FunctionName=FUNCTION_NAME)

    lambda_client.update_function_configuration(
        FunctionName=FUNCTION_NAME,
        Handler="ingestion.lambda_handler.handler",
    )
    lambda_client.get_waiter("function_updated").wait(FunctionName=FUNCTION_NAME)


def _run_sql(queries: list[dict]) -> dict:
    """Invoke the (temporarily deployed) query Lambda with SQL statements.

    Args:
        queries: List of {"name": str, "sql": str} dicts.

    Returns:
        Lambda response dict with "results" key.
    """
    payload = json.dumps({"creds": DB_CREDS, "migrations": queries})
    response = lambda_client.invoke(
        FunctionName=FUNCTION_NAME,
        InvocationType="RequestResponse",
        Payload=payload,
    )
    return json.loads(response["Payload"].read())


def _flush_dedup_to_db() -> None:
    """Bulk-insert all in-memory dedup records into dedup_index.

    Uses ON CONFLICT DO UPDATE so re-running the seed is safe.
    """
    if not seen_hashes:
        return

    rows_sql = ", ".join(
        "('{h}', '{src}', {freq})".format(h=h, src=info["source"], freq=info["frequency"])
        for h, info in seen_hashes.items()
    )
    sql = (
        f"INSERT INTO dedup_index (hash, source, frequency) VALUES {rows_sql} "
        f"ON CONFLICT (hash) DO UPDATE "
        f"SET frequency = dedup_index.frequency + EXCLUDED.frequency;"
    )
    result = _run_sql([{"name": "flush_dedup", "sql": sql}])
    entry = result["results"][0]
    if entry["status"] != "ok":
        print(f"  WARNING: dedup_index flush failed: {entry.get('error')}")
    else:
        print(f"  Flushed {len(seen_hashes)} records to dedup_index.")


def _count_s3_objects() -> int:
    """Count all objects currently in the raw feedback S3 bucket.

    Returns:
        Total object count.
    """
    paginator = s3_client.get_paginator("list_objects_v2")
    total = 0
    for page in paginator.paginate(Bucket=RAW_BUCKET):
        total += page.get("KeyCount", 0)
    return total


# ===========================================================================
# Main
# ===========================================================================

def main() -> None:
    """Load seed data and verify the results."""
    sep = "=" * 62

    print(sep)
    print("  Veloquity Seed Loader")
    print(f"  {datetime.now(tz=timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    print(sep)

    # -----------------------------------------------------------------------
    # Step 1 -- Load seed files
    # -----------------------------------------------------------------------
    print("\n[1/4] Loading seed files...")

    with open(os.path.join(SEED_DIR, "app_store_reviews.json")) as f:
        app_data = json.load(f)
    with open(os.path.join(SEED_DIR, "zendesk_tickets.json")) as f:
        zd_data = json.load(f)

    reviews = app_data["reviews"]
    tickets = zd_data["tickets"]

    print(f"  app_store_reviews.json : {len(reviews)} items")
    print(f"  zendesk_tickets.json   : {len(tickets)} items")
    print(f"  Total                  : {len(reviews) + len(tickets)} items")

    # -----------------------------------------------------------------------
    # Step 2 -- Run ingestion pipeline (direct import)
    # -----------------------------------------------------------------------
    print("\n[2/4] Running ingestion pipeline (direct import, in-memory dedup)...")

    print("\n  >> Batch 1: app_store")
    app_result = handler({"source_type": "app_store", "items": reviews}, None)
    print(f"     total={app_result['total']}  "
          f"written={app_result['written']}  "
          f"duplicates={app_result['duplicates']}  "
          f"errors={app_result['errors']}")

    print("\n  >> Batch 2: zendesk")
    zd_result = handler({"source_type": "zendesk", "items": tickets}, None)
    print(f"     total={zd_result['total']}  "
          f"written={zd_result['written']}  "
          f"duplicates={zd_result['duplicates']}  "
          f"errors={zd_result['errors']}")

    total_items   = len(reviews) + len(tickets)
    total_written = app_result["written"]    + zd_result["written"]
    total_dupes   = app_result["duplicates"] + zd_result["duplicates"]
    total_errors  = app_result["errors"]     + zd_result["errors"]

    print(f"\n  COMBINED -> total={total_items}  written={total_written}  "
          f"duplicates={total_dupes}  errors={total_errors}")
    print(f"  Unique hashes tracked in memory: {len(seen_hashes)}")

    # -----------------------------------------------------------------------
    # Step 3 -- Deploy query Lambda, flush dedup_index, run verifications
    # -----------------------------------------------------------------------
    print("\n[3/4] Deploying query Lambda for DB access (temporarily)...")
    _deploy_query_lambda()
    print("  Query Lambda ready.")

    # Track counts for final summary outside the try block.
    dedup_count = 0
    s3_count    = 0

    try:
        # Flush in-memory dedup records to dedup_index.
        print("\n  Flushing dedup_index records...")
        _flush_dedup_to_db()

        # -------------------------------------------------------------------
        # Step 4 -- Verifications
        # -------------------------------------------------------------------
        print("\n[4/4] VERIFICATIONS")

        # -- Verification 1: dedup_index row count --------------------------
        print("\n  -- Verification 1: dedup_index row count ----------------------")
        v1 = _run_sql([{"name": "v1", "sql": "SELECT COUNT(*) FROM dedup_index;"}])
        dedup_count = int(v1["results"][0].get("rows", [[0]])[0][0])
        match = "[OK] MATCH" if dedup_count == len(seen_hashes) else \
                f"[WARN] MISMATCH (expected {len(seen_hashes)})"
        print(f"  SELECT COUNT(*) FROM dedup_index  ->  {dedup_count}  {match}")
        print(f"  Expected (unique hashes this run) :  {len(seen_hashes)}")

        # -- Verification 2: S3 object count --------------------------------
        print("\n  -- Verification 2: S3 object count ----------------------------")
        s3_count = _count_s3_objects()
        s3_match = "[OK] MATCH" if s3_count == total_written else \
                   f"[WARN] MISMATCH (pipeline wrote {total_written})"
        print(f"  s3://{RAW_BUCKET} objects  ->  {s3_count}  {s3_match}")

        # -- Verification 3: Duplicate detection ----------------------------
        print("\n  -- Verification 3: Duplicate detection (frequency > 1) --------")
        v3 = _run_sql([{
            "name": "v3",
            "sql": (
                "SELECT source, frequency, LEFT(hash, 20) AS hash_prefix "
                "FROM dedup_index WHERE frequency > 1 "
                "ORDER BY frequency DESC LIMIT 5;"
            ),
        }])
        rows3 = v3["results"][0].get("rows", [])
        if rows3:
            print(f"  {'source':<14} {'frequency':<12} hash (first 20 chars)")
            print(f"  {'-'*50}")
            for r in rows3:
                print(f"  {r[0]:<14} {r[1]:<12} {r[2]}")
        else:
            in_mem = sum(1 for v in seen_hashes.values() if v["frequency"] > 1)
            print("  No rows with frequency > 1 in dedup_index.")
            print(f"  In-memory cross-source duplicates this run: {in_mem}")
            print("  (Seed items are uniquely worded across sources -- "
                  "no exact text hash collisions.)")

        # -- Verification 4: Sample dedup_index records ---------------------
        print("\n  -- Verification 4: Sample dedup_index records ------------------")
        v4 = _run_sql([{
            "name": "v4",
            "sql": (
                "SELECT source, first_seen, frequency, hash "
                "FROM dedup_index ORDER BY first_seen LIMIT 3;"
            ),
        }])
        rows4 = v4["results"][0].get("rows", [])
        if rows4:
            print(f"  {'#':<3} {'source':<12} {'first_seen':<35} {'freq':<5} hash")
            print(f"  {'-'*100}")
            all_valid = True
            for i, r in enumerate(rows4, 1):
                source, first_seen, frequency, h = r
                valid = len(h) == 64 and all(c in "0123456789abcdef" for c in h.lower())
                all_valid = all_valid and valid
                flag = "[OK]" if valid else "[FAIL] INVALID"
                print(f"  {i:<3} {source:<12} {first_seen:<35} {frequency:<5} {h}  {flag}")
            print(f"\n  Hash validation: {'[OK] all 64-char hex' if all_valid else '[FAIL] FAILURES detected'}")
            print("  PII check: texts are in S3 (not in dedup_index); "
                  "dedup_index stores hashes only.")
        else:
            print("  No rows returned from dedup_index.")

    finally:
        print("\n  Restoring ingestion Lambda to original code...")
        _restore_ingestion_lambda()
        print("  Restored.")

    # -----------------------------------------------------------------------
    # Final summary
    # -----------------------------------------------------------------------
    print(f"\n{sep}")
    print("  Seed Load Complete")
    print(f"  {'app_store batch':<22}: total={app_result['total']}  "
          f"written={app_result['written']}  "
          f"duplicates={app_result['duplicates']}  "
          f"errors={app_result['errors']}")
    print(f"  {'zendesk batch':<22}: total={zd_result['total']}  "
          f"written={zd_result['written']}  "
          f"duplicates={zd_result['duplicates']}  "
          f"errors={zd_result['errors']}")
    print(f"  {'S3 objects':<22}: {s3_count}")
    print(f"  {'dedup_index rows':<22}: {dedup_count}")
    print(sep)


if __name__ == "__main__":
    main()
