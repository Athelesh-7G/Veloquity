#!/usr/bin/env python3
"""
e2e_pipeline_test.py
End-to-end pipeline test against the deployed Veloquity API.
Runs 9 tests, prints a formatted box report, saves to e2e_test_results.txt.
"""

import json
import os
import sys
import textwrap
import time
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    print("Installing requests...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "requests", "-q"])
    import requests

BASE = os.environ.get("VELOQUITY_API_URL", "https://veloquity-api.onrender.com")
V1   = f"{BASE}/api/v1"
SAMPLE_CSV = os.path.join(
    os.path.dirname(__file__),
    "frontend_final", "public", "samples", "appstore_sample.csv",
)

RESULTS = []


def run_test(name: str, fn):
    start = time.perf_counter()
    try:
        detail = fn()
        elapsed = time.perf_counter() - start
        RESULTS.append({"name": name, "status": "PASS", "detail": detail, "elapsed": elapsed})
    except Exception as exc:
        elapsed = time.perf_counter() - start
        RESULTS.append({"name": name, "status": "FAIL", "detail": str(exc), "elapsed": elapsed})


# ── Tests ─────────────────────────────────────────────────────

def test_health():
    r = requests.get(f"{BASE}/health", timeout=30)
    r.raise_for_status()
    body = r.json()
    assert body.get("status") == "ok", f"status != ok: {body}"
    return f"status=ok  service={body.get('service', '?')}"


def test_upload():
    if not os.path.exists(SAMPLE_CSV):
        raise FileNotFoundError(f"Sample CSV not found: {SAMPLE_CSV}")
    with open(SAMPLE_CSV, "rb") as f:
        r = requests.post(
            f"{V1}/upload/feedback",
            files={"file": ("appstore_sample.csv", f, "text/csv")},
            data={"source": "appstore"},
            timeout=180,
        )
    r.raise_for_status()
    body = r.json()
    assert "items_submitted" in body, f"missing items_submitted: {body}"
    assert "estimated_embedding_cost_usd" in body, f"missing cost field: {body}"
    cost = body["estimated_embedding_cost_usd"]
    submitted = body["items_submitted"]
    batches = body.get("batches_total", "?")
    deduped = body.get("items_deduplicated", 0)
    return (
        f"submitted={submitted}  batches={batches}  "
        f"deduped={deduped}  cost=${cost:.6f}"
    )


def _run_agent(name: str) -> str:
    r = requests.post(f"{V1}/agents/{name}/run", timeout=120)
    r.raise_for_status()
    body = r.json()
    status = body.get("status", "?")
    return f"agent={name}  status={status}"


def test_agent_ingestion():
    return _run_agent("ingestion")


def test_agent_evidence():
    return _run_agent("evidence")


def test_agent_reasoning():
    return _run_agent("reasoning")


def test_evidence_fetch():
    r = requests.get(f"{V1}/evidence/", timeout=30)
    r.raise_for_status()
    clusters = r.json()
    assert isinstance(clusters, list), f"expected list, got {type(clusters)}"
    count = len(clusters)
    if count > 0:
        avg_conf = sum(c.get("confidence_score", 0) for c in clusters) / count
        return f"clusters={count}  avg_confidence={avg_conf:.3f}"
    return "clusters=0 (no active clusters yet)"


def test_evidence_items():
    r = requests.get(f"{V1}/evidence/", timeout=30)
    r.raise_for_status()
    clusters = r.json()
    if not clusters:
        return "SKIP -- no clusters available to drill into"
    cluster_id = clusters[0]["id"]
    r2 = requests.get(f"{V1}/evidence/{cluster_id}/items", timeout=30)
    r2.raise_for_status()
    items = r2.json()
    assert isinstance(items, list), f"expected list, got {type(items)}"
    return f"cluster_id={cluster_id[:8]}...  items={len(items)}"


def test_chat():
    payload = {"message": "What are the top user issues?", "history": []}
    r = requests.post(f"{V1}/chat/", json=payload, timeout=60)
    r.raise_for_status()
    body = r.json()
    assert "response" in body, f"missing response: {body}"
    assert "evidence_used" in body, f"missing evidence_used: {body}"
    preview = body["response"][:80].replace("\n", " ")
    ev_count = len(body.get("evidence_used", []))
    return f"response='{preview}...'  evidence_used={ev_count}"


def test_metrics():
    r = requests.get(f"{V1}/metrics/", timeout=30)
    r.raise_for_status()
    body = r.json()
    required = ["data_pipeline", "model_performance", "agent_activity", "cost_estimates"]
    missing = [k for k in required if k not in body]
    assert not missing, f"missing keys: {missing}"
    total_cost = body["cost_estimates"]["total_cost_usd"]
    active = body["data_pipeline"]["evidence_clusters"]["active"]
    return f"active_clusters={active}  total_cost_usd=${total_cost:.6f}"


# ── Execution ─────────────────────────────────────────────────

run_test("1. Health check",            test_health)
run_test("2. Upload CSV (batched)",    test_upload)
run_test("3. Agent run -- ingestion",  test_agent_ingestion)
run_test("4. Agent run -- evidence",   test_agent_evidence)
run_test("5. Agent run -- reasoning",  test_agent_reasoning)
run_test("6. Evidence fetch",          test_evidence_fetch)
run_test("7. Evidence items (trace)",  test_evidence_items)
run_test("8. Chat endpoint",           test_chat)
run_test("9. Metrics endpoint",        test_metrics)

# ── Report ────────────────────────────────────────────────────

W = 72
now = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
passed = sum(1 for r in RESULTS if r["status"] == "PASS")
failed = len(RESULTS) - passed

lines = []
lines.append("+" + "-" * W + "+")
lines.append("|" + " Veloquity API -- End-to-End Pipeline Test Results".center(W) + "|")
lines.append("|" + f" Run at: {now}".ljust(W) + "|")
lines.append("|" + f" Target: {BASE}".ljust(W) + "|")
lines.append("+" + "-" * W + "+")
lines.append("|" + f"  {'Test':<38} {'Status':<8} {'Time':>7}  {'Detail':<10}".ljust(W) + "|")
lines.append("+" + "-" * W + "+")

for r in RESULTS:
    status_str = "[PASS]" if r["status"] == "PASS" else "[FAIL]"
    time_str   = f"{r['elapsed']:.2f}s"
    detail_short = r["detail"][:28] + "..." if len(r["detail"]) > 28 else r["detail"]
    row = f"  {r['name']:<38} {status_str:<8} {time_str:>7}  {detail_short}"
    lines.append("|" + row.ljust(W) + "|")
    if len(r["detail"]) > 28:
        wrapped = textwrap.wrap(r["detail"], W - 8)
        for wl in wrapped[1:]:
            lines.append("|" + ("    " + wl).ljust(W) + "|")

lines.append("+" + "-" * W + "+")
summary = f"  PASSED: {passed}/{len(RESULTS)}   FAILED: {failed}/{len(RESULTS)}"
lines.append("|" + summary.ljust(W) + "|")
lines.append("+" + "-" * W + "+")

report = "\n".join(lines)
print(report)

out_path = os.path.join(os.path.dirname(__file__), "e2e_test_results.txt")
with open(out_path, "w", encoding="utf-8") as f:
    f.write(report + "\n")
print(f"\nResults saved to: {out_path}")

sys.exit(0 if failed == 0 else 1)
