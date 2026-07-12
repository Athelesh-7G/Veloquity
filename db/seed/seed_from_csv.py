#!/usr/bin/env python3
# =============================================================
# db/seed/seed_from_csv.py
# Ingest all 4 real CSV datasets through the live Ingestion Lambda.
# Passes every CSV row as a raw dict — normalization.py extracts
# the relevant text and timestamp fields per source_type.
# =============================================================

import csv
import json
import os
import time

import boto3

LAMBDA = "veloquity-ingestion-dev"
REGION = "us-east-1"
CSV_DIR = "/Users/atheleshb/Downloads/Veloquity Datasets"

# (filename, source_type, text_col, timestamp_col, id_col)
# text_col/timestamp_col are documented here for reference only —
# normalization.py picks them up automatically via _TEXT_KEYS / _TS_KEYS.
SOURCES = [
    ("app_store_reviews.csv",  "app_store",       "review",      "date",       "review_id"),
    ("support_tickets.csv",    "zendesk",          "description", "created_at", "ticket_id"),
    ("patient_portal.csv",     "patient_portal",   "review",      "date",       "review_id"),
    ("hospital_survey.csv",    "hospital_survey",  "description", "created_at", "ticket_id"),
]

client = boto3.client("lambda", region_name=REGION)

total_written = 0
for filename, source_type, text_col, ts_col, id_col in SOURCES:
    path = os.path.join(CSV_DIR, filename)
    items = []
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            items.append(dict(row))  # pass all columns — normalization picks what it needs

    payload = {"source_type": source_type, "items": items}
    response = client.invoke(
        FunctionName=LAMBDA,
        InvocationType="RequestResponse",
        Payload=json.dumps(payload).encode(),
    )
    result = json.loads(response["Payload"].read())
    print(f"{filename}: {result}")
    total_written += result.get("written", 0)
    time.sleep(2)  # avoid Lambda throttling

print(f"\nTotal written: {total_written}")
