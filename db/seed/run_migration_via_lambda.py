#!/usr/bin/env python3
# =============================================================
# db/seed/run_migration_via_lambda.py
# Run migration 009 (dedup + UNIQUE constraint) via a temporary
# Lambda that has DB access through api.db / DB_SECRET_ARN.
# Creates the Lambda, invokes it, prints the result, then deletes it.
# =============================================================

import boto3
import json
import os
import shutil
import tempfile
import time
import zipfile

REGION = "us-east-1"
S3_BUCKET = "veloquity-deploy-dev-082228066878"
MIGRATION_FUNCTION = "veloquity-migration-009"
EXISTING_FUNCTION = "veloquity-governance-dev"
API_ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "api")

MIGRATION_HANDLER_CODE = '''
import json
import sys
sys.path.insert(0, '/var/task')
from api.db import get_conn, release_conn


def handler(event, context):
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Step 1: count rows before
            cur.execute("SELECT COUNT(*) FROM evidence WHERE status = 'active'")
            before = cur.fetchone()[0]

            # Step 2: delete duplicates keeping highest id per theme
            cur.execute("""
                DELETE FROM evidence
                WHERE id NOT IN (
                    SELECT MAX(id)
                    FROM evidence
                    GROUP BY theme
                )
            """)
            deleted = cur.rowcount if cur.rowcount != -1 else 0

            # Step 3: count rows after
            cur.execute("SELECT COUNT(*) FROM evidence WHERE status = 'active'")
            after = cur.fetchone()[0]

            # Step 4: add UNIQUE constraint on theme if not present
            cur.execute("""
                SELECT 1 FROM pg_constraint WHERE conname = 'evidence_theme_unique'
            """)
            constraint_existed = cur.fetchone() is not None

            if not constraint_existed:
                cur.execute("""
                    ALTER TABLE evidence
                    ADD CONSTRAINT evidence_theme_unique UNIQUE (theme)
                """)

            # Step 5: list surviving unique themes
            cur.execute("""
                SELECT theme, confidence_score
                FROM evidence
                WHERE status = 'active'
                ORDER BY confidence_score DESC
            """)
            clusters = [
                {"theme": row[0][:80], "confidence": round(float(row[1]) * 100)}
                for row in cur.fetchall()
            ]

        conn.commit()

        return {
            "statusCode": 200,
            "rows_before": before,
            "deleted_duplicates": deleted,
            "rows_after": after,
            "constraint_added": not constraint_existed,
            "unique_clusters": clusters,
        }

    except Exception as e:
        conn.rollback()
        return {"statusCode": 500, "error": str(e)}
    finally:
        release_conn(conn)
'''

lambda_client = boto3.client("lambda", region_name=REGION)
s3_client = boto3.client("s3", region_name=REGION)

# ── Build zip ───────────────────────────────────────────────────────────────
print("Building migration Lambda zip…")
tmpdir = tempfile.mkdtemp()
pkg_dir = os.path.join(tmpdir, "pkg")
os.makedirs(pkg_dir)

# Write the handler
with open(os.path.join(pkg_dir, "migration_handler.py"), "w") as f:
    f.write(MIGRATION_HANDLER_CODE)

# Copy api package (has db.py and dependencies needed at import time)
shutil.copytree(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "api")),
    os.path.join(pkg_dir, "api"),
)

# Install psycopg2 for Linux Lambda runtime
os.system(
    f"python3 -m pip install psycopg2-binary "
    f"--platform manylinux2014_x86_64 "
    f"--python-version 3.12 "
    f"--only-binary=:all: "
    f"-t {pkg_dir} --quiet"
)

zip_path = os.path.join(tmpdir, "migration_009.zip")
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(pkg_dir):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for fname in files:
            if not fname.endswith(".pyc"):
                filepath = os.path.join(root, fname)
                arcname = os.path.relpath(filepath, pkg_dir)
                zf.write(filepath, arcname)

size_kb = os.path.getsize(zip_path) // 1024
print(f"Migration zip built: {size_kb} KB")

# ── Upload to S3 ────────────────────────────────────────────────────────────
print("Uploading to S3…")
s3_client.upload_file(zip_path, S3_BUCKET, "lambda/migration_009.zip")
print("Uploaded.")

# ── Get role + env from existing Lambda ─────────────────────────────────────
existing = lambda_client.get_function_configuration(FunctionName=EXISTING_FUNCTION)
role_arn = existing["Role"]
env_vars = existing.get("Environment", {}).get("Variables", {})
print(f"Using role: {role_arn}")

# ── Create (or update) migration Lambda ─────────────────────────────────────
try:
    lambda_client.delete_function(FunctionName=MIGRATION_FUNCTION)
    print(f"Deleted existing {MIGRATION_FUNCTION}")
    time.sleep(3)
except lambda_client.exceptions.ResourceNotFoundException:
    pass

lambda_client.create_function(
    FunctionName=MIGRATION_FUNCTION,
    Runtime="python3.12",
    Role=role_arn,
    Handler="migration_handler.handler",
    Code={"S3Bucket": S3_BUCKET, "S3Key": "lambda/migration_009.zip"},
    Environment={"Variables": env_vars},
    Timeout=60,
)
print(f"Lambda {MIGRATION_FUNCTION} created. Waiting for active state…")
lambda_client.get_waiter("function_active").wait(FunctionName=MIGRATION_FUNCTION)
print("Lambda active.")

# ── Invoke migration ─────────────────────────────────────────────────────────
print("Invoking migration…")
response = lambda_client.invoke(
    FunctionName=MIGRATION_FUNCTION,
    InvocationType="RequestResponse",
    Payload=json.dumps({}).encode(),
)
result = json.loads(response["Payload"].read())
print("Migration result:")
print(json.dumps(result, indent=2))

# ── Cleanup temp Lambda ───────────────────────────────────────────────────────
lambda_client.delete_function(FunctionName=MIGRATION_FUNCTION)
print(f"\nCleanup: {MIGRATION_FUNCTION} deleted.")

# ── Cleanup local temp dir ───────────────────────────────────────────────────
shutil.rmtree(tmpdir, ignore_errors=True)
print("Done.")
