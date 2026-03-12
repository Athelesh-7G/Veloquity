#!/usr/bin/env python3
"""
db/seed/run_phase3.py
Phase 3 local test runner — Reasoning Agent.

Connects directly to RDS (no Lambda invoke), calls run_reasoning_agent()
and prints the full structured output to stdout.

Usage: python db/seed/run_phase3.py
"""

import json
import os
import sys

import boto3
import psycopg2

# Allow imports from project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from reasoning.agent import run_reasoning_agent

REGION      = "us-east-1"
BUCKET      = "veloquity-reports-dev-082228066878"
DB_HOST     = "REDACTED_RDS_HOST"
DB_PORT     = 5432
DB_NAME     = "veloquity"
DB_USER     = "veloquity_user"
DB_PASSWORD = "REDACTED_DB_PASSWORD"


def get_direct_conn():
    """Open a direct psycopg2 connection to RDS (bypasses Secrets Manager)."""
    return psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD,
        connect_timeout=15,
    )


def main() -> None:
    """Run Phase 3 Reasoning Agent locally and print full output."""
    print("=" * 62)
    print("  Veloquity — Phase 3 Reasoning Agent (local run)")
    print("=" * 62)

    conn = get_direct_conn()
    bedrock = boto3.client("bedrock-runtime", region_name=REGION)
    s3 = boto3.client("s3", region_name=REGION)

    try:
        result = run_reasoning_agent(conn, bedrock, s3, BUCKET)
    except Exception as exc:
        print(f"\nERROR: {exc}")
        sys.exit(1)
    finally:
        conn.close()

    # ------------------------------------------------------------------ #
    # Print recommendations                                               #
    # ------------------------------------------------------------------ #
    print(f"\n{'='*62}")
    print(f"  Recommendations ({len(result['recommendations'])} total)")
    print(f"{'='*62}")
    for rec in result["recommendations"]:
        print(f"\n  #{rec['rank']}  {rec['theme']}")
        print(f"     Action   : {rec['recommended_action']}")
        print(f"     Effort   : {rec['effort_estimate']}  |  Impact: {rec['user_impact']}")
        print(f"     Tradeoff : {rec['tradeoff_explanation']}")
        if rec.get("risk_flags"):
            print(f"     Risks    : {', '.join(rec['risk_flags'])}")
        if rec.get("related_clusters"):
            print(f"     Related  : clusters {rec['related_clusters']}")

    # ------------------------------------------------------------------ #
    # Print meta                                                          #
    # ------------------------------------------------------------------ #
    meta = result.get("meta", {})
    print(f"\n{'='*62}")
    print("  Meta / Synthesis")
    print(f"{'='*62}")
    print(f"  Summary   : {meta.get('reasoning_summary', '')}")
    print(f"  Top Theme : {meta.get('highest_priority_theme', '')}")
    print(f"  Insight   : {meta.get('cross_cluster_insight', '')}")

    # ------------------------------------------------------------------ #
    # Verification block                                                  #
    # ------------------------------------------------------------------ #
    token = result["token_usage"]
    db_ok = "YES"  # If we got here, the DB write succeeded (no exception raised)

    print(f"\n{'='*62}")
    print("  Phase 3 Verification")
    print(f"{'='*62}")
    print(f"  Evidence clusters reasoned over : {result['evidence_count']}")
    print(f"  Recommendations generated        : {len(result['recommendations'])}")
    print(f"  Highest priority theme           : {meta.get('highest_priority_theme', 'n/a')}")
    print(f"  S3 report key                    : {result['s3_report_key']}")
    print(f"  reasoning_runs table row written : {db_ok}")
    print(f"  Token usage                      : {token['input_tokens']} in / {token['output_tokens']} out")
    print(f"{'='*62}")
    print("  Phase 3 complete.")
    print(f"{'='*62}")


if __name__ == "__main__":
    main()
