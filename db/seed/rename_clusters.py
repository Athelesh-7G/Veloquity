#!/usr/bin/env python3
# =============================================================
# db/seed/rename_clusters.py
# One-time job: rename active evidence clusters that still carry
# raw user-quote text as their theme, replacing them with a clean
# 4-8 word title-case name synthesized by Nova Pro.
#
# Flow:
#   1. Build a minimal Lambda zip (api + evidence packages).
#   2. Upload zip to S3, create temp Lambda with the same
#      IAM role and env vars as veloquity-governance-dev.
#   3. Invoke synchronously, print result.
#   4. Delete temp Lambda and clean up local files.
# =============================================================

import boto3
import json
import os
import shutil
import tempfile
import time
import zipfile

REGION        = "us-east-1"
S3_BUCKET     = "veloquity-deploy-dev-082228066878"
FUNCTION_NAME = "veloquity-rename-clusters"
ROLE_SOURCE   = "veloquity-governance-dev"
REPO_ROOT     = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

HANDLER_CODE = '''
import json, sys
sys.path.insert(0, "/var/task")
import boto3
from api.db import get_conn, release_conn
from evidence.evidence_writer import rename_existing_clusters

def handler(event, context):
    conn = get_conn()
    bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")
    try:
        result = rename_existing_clusters(conn, bedrock)
        return {"statusCode": 200, "body": json.dumps(result)}
    except Exception as exc:
        return {"statusCode": 500, "error": str(exc)}
    finally:
        release_conn(conn)
'''

lc = boto3.client("lambda", region_name=REGION)
s3 = boto3.client("s3",     region_name=REGION)

# ── Build Lambda zip ─────────────────────────────────────────────────────────
print("Building Lambda zip…")
tmpdir  = tempfile.mkdtemp()
pkg_dir = os.path.join(tmpdir, "pkg")
os.makedirs(pkg_dir)

# Handler
with open(os.path.join(pkg_dir, "rename_handler.py"), "w") as f:
    f.write(HANDLER_CODE)

# api + evidence packages
shutil.copytree(os.path.join(REPO_ROOT, "api"),      os.path.join(pkg_dir, "api"))
shutil.copytree(os.path.join(REPO_ROOT, "evidence"), os.path.join(pkg_dir, "evidence"))

# psycopg2 for Linux Lambda runtime
os.system(
    f"python3 -m pip install psycopg2-binary "
    f"--platform manylinux2014_x86_64 --python-version 3.12 "
    f"--only-binary=:all: -t {pkg_dir} --quiet"
)

zip_path = os.path.join(tmpdir, "rename_clusters.zip")
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(pkg_dir):
        dirs[:] = [d for d in dirs if d != "__pycache__"]
        for fname in files:
            if not fname.endswith(".pyc"):
                fp      = os.path.join(root, fname)
                arcname = os.path.relpath(fp, pkg_dir)
                zf.write(fp, arcname)

size_kb = os.path.getsize(zip_path) // 1024
print(f"Zip built: {size_kb} KB")

# ── Upload to S3 ─────────────────────────────────────────────────────────────
print("Uploading to S3…")
s3.upload_file(zip_path, S3_BUCKET, "lambda/rename_clusters.zip")
print("Uploaded.")

# ── Get role + env vars from existing Lambda ─────────────────────────────────
existing  = lc.get_function_configuration(FunctionName=ROLE_SOURCE)
role_arn  = existing["Role"]
env_vars  = existing.get("Environment", {}).get("Variables", {})
print(f"Using role: {role_arn}")

# ── Create (or replace) temp Lambda ──────────────────────────────────────────
try:
    lc.delete_function(FunctionName=FUNCTION_NAME)
    print(f"Deleted existing {FUNCTION_NAME}.")
    time.sleep(3)
except lc.exceptions.ResourceNotFoundException:
    pass

lc.create_function(
    FunctionName=FUNCTION_NAME,
    Runtime="python3.12",
    Role=role_arn,
    Handler="rename_handler.handler",
    Code={"S3Bucket": S3_BUCKET, "S3Key": "lambda/rename_clusters.zip"},
    Environment={"Variables": env_vars},
    Timeout=120,
)
print(f"Lambda {FUNCTION_NAME} created. Waiting for active state…")
lc.get_waiter("function_active").wait(FunctionName=FUNCTION_NAME)
print("Lambda active.")

# ── Invoke synchronously ─────────────────────────────────────────────────────
print("Invoking rename job…")
response = lc.invoke(
    FunctionName=FUNCTION_NAME,
    InvocationType="RequestResponse",
    Payload=json.dumps({}).encode(),
)
result = json.loads(response["Payload"].read())
print("Result:")
print(json.dumps(result, indent=2))

# ── Cleanup ───────────────────────────────────────────────────────────────────
lc.delete_function(FunctionName=FUNCTION_NAME)
shutil.rmtree(tmpdir, ignore_errors=True)
print(f"\nCleanup: {FUNCTION_NAME} deleted, temp files removed.")
