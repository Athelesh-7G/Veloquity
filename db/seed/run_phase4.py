#!/usr/bin/env python3
"""
db/seed/run_phase4.py
Phase 4 local test runner — Governance Agent + HTML Report.

Connects directly to RDS (no Lambda invoke), runs the full governance
cycle and HTML report generation, then prints the Phase 4 Verification
block to stdout.

Usage: python db/seed/run_phase4.py
"""

import os
import sys

import boto3
import psycopg2

# Allow imports from project root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from governance import stale_detection, signal_promotion, cost_monitor
from output import html_report

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
    """Run Phase 4 Governance Agent locally and print full output."""
    print("=" * 62)
    print("  Veloquity — Phase 4 Governance Agent (local run)")
    print("=" * 62)

    conn = get_direct_conn()
    s3 = boto3.client("s3", region_name=REGION)

    try:
        stale = stale_detection.detect_and_flag_stale(conn)
        promoted = signal_promotion.promote_staging_signals(conn)
        cost = cost_monitor.check_cost_signals(conn)
        url = html_report.generate_and_upload(conn, s3, BUCKET)
    except Exception as exc:
        print(f"\nERROR: {exc}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

    # Count governance_log rows written this session (approximation: total rows)
    conn2 = get_direct_conn()
    try:
        with conn2.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM governance_log")
            gov_count = cur.fetchone()[0]
    finally:
        conn2.close()

    print(f"\n{'='*62}")
    print("  Phase 4 Verification")
    print(f"{'='*62}")
    print("  Governance run:")
    print(f"    Stale signals flagged    : {len(stale)}")
    print(f"    Staging signals promoted : {len(promoted)}")
    print(f"    Cost alert triggered     : {'YES' if cost['alert_triggered'] else 'NO'}")
    print(f"    governance_log rows      : {gov_count}")
    print("  HTML report:")
    print(f"    URL                      : {url}")
    print(f"{'='*62}")
    print("  Phase 4 complete.")
    print(f"{'='*62}")


if __name__ == "__main__":
    main()
