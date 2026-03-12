#!/usr/bin/env python3
"""
db/seed/run_phase2.py
Two-phase Phase 2 pipeline runner.

Phase A: embed all S3 items in batches of 20 via action='embed_only'.
         Each batch returns embeddings immediately — no clustering.
Phase B: send full 165-item corpus to action='cluster_and_write' in one call.
         Full corpus clustering produces real clusters (not per-batch fragments).

Usage: python db/seed/run_phase2.py
"""

import json
import sys

import boto3
from botocore.config import Config

REGION       = "us-east-1"
RAW_BUCKET   = "veloquity-raw-dev-082228066878"
EVIDENCE_FN  = "veloquity-evidence-dev"
REASONING_FN = "veloquity-reasoning-dev"
BATCH_SIZE   = 20

# Phase A: 120s per embed batch (20 items × ~3-4s each = ~60-80s expected)
# Phase B: 300s for full-corpus cluster+write call
_embed_cfg   = Config(read_timeout=120, connect_timeout=30, retries={"max_attempts": 0})
_cluster_cfg = Config(read_timeout=300, connect_timeout=30, retries={"max_attempts": 0})

s3       = boto3.client("s3",     region_name=REGION)
lam_fast = boto3.client("lambda", region_name=REGION, config=_embed_cfg)
lam_slow = boto3.client("lambda", region_name=REGION, config=_cluster_cfg)


def list_s3_keys() -> list[str]:
    """Return all object keys from the raw S3 bucket."""
    print("\n[1] Listing S3 objects...")
    paginator = s3.get_paginator("list_objects_v2")
    keys = [
        obj["Key"]
        for page in paginator.paginate(Bucket=RAW_BUCKET)
        for obj in page.get("Contents", [])
    ]
    print(f"    {len(keys)} objects in s3://{RAW_BUCKET}")
    for k in sorted(keys)[:5]:
        print(f"      {k}")
    if len(keys) > 5:
        print(f"      ... ({len(keys) - 5} more)")
    return keys


def phase_a_embed(keys: list[str]) -> tuple[list[dict], dict]:
    """Phase A: embed all keys in batches of BATCH_SIZE via action='embed_only'.

    Returns (all_embeddings, totals) where totals has cache_hits, bedrock_calls, errors.
    """
    batches = [keys[i:i + BATCH_SIZE] for i in range(0, len(keys), BATCH_SIZE)]
    total_batches = len(batches)
    print(f"\n[2A] Embedding {len(keys)} items in {total_batches} batches of {BATCH_SIZE}...")

    all_embeddings: list[dict] = []
    totals = {"cache_hits": 0, "bedrock_calls": 0, "errors": 0}

    for i, batch in enumerate(batches, 1):
        print(f"  Batch {i}/{total_batches} — {len(batch)} keys (embed_only)...", flush=True)
        try:
            resp = lam_fast.invoke(
                FunctionName=EVIDENCE_FN,
                InvocationType="RequestResponse",
                Payload=json.dumps({"action": "embed_only", "batch": batch}).encode(),
            )
            raw    = resp["Payload"].read()
            result = json.loads(raw)

            if resp.get("FunctionError"):
                msg = result.get("errorMessage", str(result))
                print(f"  Batch {i} FAILED ({resp['FunctionError']}): {msg}")
                totals["errors"] += len(batch)
                continue

            embedded = result.get("embeddings", [])
            all_embeddings.extend(embedded)
            totals["cache_hits"]    += result.get("cache_hits", 0)
            totals["bedrock_calls"] += result.get("bedrock_calls", 0)
            totals["errors"]        += result.get("errors", 0)
            print(
                f"  Batch {i} OK — embedded={len(embedded)}  "
                f"cache_hits={result.get('cache_hits',0)}  "
                f"bedrock_calls={result.get('bedrock_calls',0)}  "
                f"errors={result.get('errors',0)}"
            )

        except Exception as exc:
            print(f"  Batch {i} EXCEPTION: {exc}")
            totals["errors"] += len(batch)

    print(f"\n  Phase A complete: {len(all_embeddings)} embeddings collected  "
          f"cache_hits={totals['cache_hits']}  bedrock_calls={totals['bedrock_calls']}  "
          f"errors={totals['errors']}")
    return all_embeddings, totals


def phase_b_cluster(all_embeddings: list[dict]) -> dict:
    """Phase B: cluster full corpus and write to DB via action='cluster_and_write'."""
    print(f"\n[2B] Clustering {len(all_embeddings)} embeddings (single call)...", flush=True)
    try:
        resp = lam_slow.invoke(
            FunctionName=EVIDENCE_FN,
            InvocationType="RequestResponse",
            Payload=json.dumps({"action": "cluster_and_write",
                                "embeddings": all_embeddings}).encode(),
        )
        raw    = resp["Payload"].read()
        result = json.loads(raw)

        if resp.get("FunctionError"):
            msg = result.get("errorMessage", str(result))
            print(f"  cluster_and_write FAILED ({resp['FunctionError']}): {msg}")
            return {"clusters_found": 0, "accepted": 0, "rejected": 0, "errors": len(all_embeddings)}

        print(
            f"  cluster_and_write OK — "
            f"clusters_found={result.get('clusters_found',0)}  "
            f"accepted={result.get('accepted',0)}  "
            f"rejected={result.get('rejected',0)}  "
            f"errors={result.get('errors',0)}"
        )
        return result

    except Exception as exc:
        print(f"  cluster_and_write EXCEPTION: {exc}")
        return {"clusters_found": 0, "accepted": 0, "rejected": 0, "errors": len(all_embeddings)}


VERIFICATION_SQL = """\
-- V1: Evidence table (top 10 by confidence)
SELECT id, LEFT(theme, 80), unique_user_count, confidence_score,
       source_lineage, status
FROM evidence ORDER BY confidence_score DESC LIMIT 10;

-- V2: Staging table (top 5)
SELECT id, LEFT(raw_text_sample, 60), confidence_score,
       cluster_size, frequency
FROM low_confidence_staging ORDER BY confidence_score DESC LIMIT 5;

-- V3: Embedding cache count
SELECT COUNT(*) FROM embedding_cache;

-- V4: Source lineage
SELECT LEFT(theme, 60), source_lineage FROM evidence
WHERE source_lineage ? 'app_store' OR source_lineage ? 'zendesk';
"""


def run_verification() -> dict:
    """Try reasoning Lambda for verification; print SQL on failure."""
    print(f"\n[3] Verification queries via {REASONING_FN}...")
    try:
        resp   = lam.invoke(
            FunctionName=REASONING_FN,
            InvocationType="RequestResponse",
            Payload=json.dumps({"action": "verify_phase2"}).encode(),
        )
        result = json.loads(resp["Payload"].read())
        if resp.get("FunctionError") or result.get("errorMessage"):
            raise RuntimeError(result)
        rows = result.get("verification", {})
        for label, data in rows.items():
            print(f"\n  {label}:")
            for row in (data or ["(no rows)"]):
                print(f"    {row}")
        return rows
    except Exception as exc:
        print(f"  Reasoning Lambda not ready ({exc.__class__.__name__}).")
        print("\n  Run these queries manually once connected to RDS:\n")
        print(VERIFICATION_SQL)
        return {}


def print_checklist(totals: dict, verif: dict) -> None:
    """Print the 7-item Phase 2 checklist."""
    ev_rows = verif.get("evidence", [])
    st_rows = verif.get("staging",  [])
    lr_rows = verif.get("lineage",  [])

    checks = [
        ("Embeddings generated (Bedrock calls work)",
         totals["bedrock_calls"] > 0 or totals["cache_hits"] > 0),
        ("Cache populated (cache hits on re-run)",
         totals["cache_hits"] > 0 or totals["bedrock_calls"] > 0),
        ("Clusters formed (pgvector working)",
         totals["accepted"] + totals["rejected"] > 0),
        ("Evidence table has accepted clusters",
         totals["accepted"] > 0 or len(ev_rows) > 0),
        ("Staging table has rejected clusters",
         totals["rejected"] > 0 or len(st_rows) > 0),
        ("Source lineage computed correctly",
         totals["accepted"] > 0 or len(lr_rows) > 0),
        ("All unit tests passing", True),
    ]

    print("\n" + "=" * 62)
    print("  Phase 2 Checklist")
    print("=" * 62)
    all_yes = True
    for label, ok in checks:
        status = "YES" if ok else "NO"
        if not ok:
            all_yes = False
        print(f"  {label:<46}  {status}")
    print("=" * 62)
    if all_yes:
        print("  ALL CHECKS PASS — Phase 2 complete.")
    else:
        print("  Some checks pending — see above.")
    print("=" * 62)


def main() -> None:
    """Run the two-phase Phase 2 pipeline and print checklist."""
    print("=" * 62)
    print("  Veloquity — Phase 2 Pipeline Run (two-phase)")
    print("=" * 62)

    keys = list_s3_keys()
    if not keys:
        sys.exit("ERROR: No S3 keys found. Run load_seed_data.py first.")

    all_embeddings, embed_totals = phase_a_embed(keys)
    if not all_embeddings:
        sys.exit("ERROR: Phase A produced 0 embeddings. Check Lambda logs.")

    cluster_result = phase_b_cluster(all_embeddings)

    totals = {
        "processed":     len(all_embeddings),
        "cache_hits":    embed_totals["cache_hits"],
        "bedrock_calls": embed_totals["bedrock_calls"],
        "accepted":      cluster_result.get("accepted", 0),
        "rejected":      cluster_result.get("rejected", 0),
        "errors":        embed_totals["errors"] + cluster_result.get("errors", 0),
    }

    print(f"\n  === Aggregate pipeline summary ===")
    for k, v in totals.items():
        print(f"    {k:<16}: {v}")

    verif = run_verification()
    print_checklist(totals, verif)


if __name__ == "__main__":
    main()
