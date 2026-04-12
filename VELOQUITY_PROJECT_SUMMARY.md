# Veloquity — Complete Technical Project Summary

> **Audience:** Technical PMs and senior engineers with no prior project context.
> **Scope:** Every build phase, every architectural decision, every deviation visible in the code, and all verified results drawn directly from source files.
> **Generated:** 2026-03-18
> **Source of truth:** The code in `veloquity/`. Where any prior document conflicts with what the code shows, the code wins.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
   - [What Veloquity Is](#what-veloquity-is)
   - [The Core Loop](#the-core-loop)
   - [Full Architecture Overview](#full-architecture-overview)
   - [AWS Services Used](#aws-services-used)
2. [Phase 1 — Ingestion Pipeline](#2-phase-1--ingestion-pipeline)
3. [Phase 2 — Evidence Intelligence](#3-phase-2--evidence-intelligence)
4. [Phase 3 — Reasoning Agent](#4-phase-3--reasoning-agent)
5. [Phase 5 — Governance Agent](#5-phase-5--governance-agent)
6. [Output Generation](#6-output-generation)
7. [API Layer (FastAPI)](#7-api-layer-fastapi)
8. [Database Schema](#8-database-schema)
9. [Frontend (React SPA)](#9-frontend-react-spa)
10. [Deployment](#10-deployment)
11. [Strategic Decisions and Deviations](#11-strategic-decisions-and-deviations)
12. [Real vs Demo Boundary](#12-real-vs-demo-boundary)
13. [Gaps and Open Issues](#13-gaps-and-open-issues)
14. [Deployment Checklist](#14-deployment-checklist)

---

## 1. Project Overview

### What Veloquity Is

Veloquity is an agentic evidence intelligence system built on AWS. It ingests multi-source product feedback (App Store reviews, Zendesk tickets), extracts structured evidence clusters using LLM embeddings and semantic clustering, and surfaces prioritized, constraint-aware signals to a product team for planning decisions. The target user is a technical PM or product lead who needs to turn a large, noisy feedback corpus into a ranked, explainable action list without manually reading every ticket.

**Deployed Render URL:** Set at deploy time via `FRONTEND_URL` secret in `render.yaml` — no hardcoded URL exists in the codebase.
**Deployed Vercel URL:** Set at deploy time via `VITE_API_URL` env var in `vercel.json` — placeholder value is `"your-render-api-url-here"`.

### The Core Loop

```
ingest → deduplicate → embed → cluster → reason → human decision
```

| Step | What It Proves |
|---|---|
| **ingest** | Multi-source feedback flows in clean and normalized |
| **deduplicate** | SHA-256 prevents the same feedback being processed twice, even across runs |
| **embed** | Titan Embed V2 (1024-dim) turns text into vectors; cache avoids redundant Bedrock calls |
| **cluster** | Greedy cosine similarity groups semantically identical feedback into coherent themes |
| **reason** | A ReAct LLM agent turns scored evidence into ranked, tradeoff-aware recommendations |
| **human decision** | A PM reads the output and makes a planning decision — Veloquity does not auto-act |

### Full Architecture Overview

| Section | Name | File / Service |
|---|---|---|
| 1 | Feedback Sources | App Store Reviews + Zendesk (2 sources, MVP-only) |
| 2 | Ingestion Agent | `ingestion/lambda_handler.py` — AWS Lambda |
| 3 | PII Redaction | `ingestion/pii_redaction.py` — regex-based (not Comprehend, see §11) |
| 4 | Raw Storage | AWS S3 — `veloquity-raw-dev-082228066878` |
| 5 | Evidence Intelligence | `evidence/embedding_pipeline.py` — AWS Lambda |
| 6 | Embedding Model | AWS Bedrock `amazon.titan-embed-text-v2:0`, 1024 dims |
| 7 | Embedding Cache | PostgreSQL `embedding_cache` table, keyed `(content_hash, model_version)` |
| 8 | Clustering | `evidence/clustering.py` — greedy cosine, pure Python |
| 9 | Evidence Store | PostgreSQL `evidence` table with pgvector HNSW index |
| 10 | Reasoning Agent | `reasoning/agent.py` + `lambda_reasoning/handler.py` — AWS Lambda |
| 11 | LLM Reasoning | AWS Bedrock `anthropic.claude-3-5-haiku-20241022-v1:0` |
| 12 | Report Storage | AWS S3 — `veloquity-reports-dev-082228066878` |
| 13 | API Layer | `api/main.py` — FastAPI on Render |
| 14 | Frontend | `frontend_final/` — React 18 + Vite 6 on Vercel |
| 15 | Governance Agent | `governance/governance_lambda.py` — AWS Lambda, EventBridge daily cron |
| 16 | Infrastructure | `infra/cloudformation.yaml` — single stack `veloquity-{env}` |

### AWS Services Used

| Service | Role | Why Chosen |
|---|---|---|
| AWS Lambda | Runs all 4 agent pipelines (ingestion, evidence, reasoning, governance) | Event-driven, serverless, scales to zero for MVP cost |
| AWS S3 | Raw feedback landing zone + HTML report hosting | Append-only, cheap, durable |
| AWS Bedrock | Titan Embed V2 (embeddings) + Claude 3.5 Haiku (reasoning + chat + ambiguous validation) | Managed LLM API with IAM auth, no separate key management |
| AWS RDS PostgreSQL | Single DB for evidence store, embedding cache, dedup index, governance log, reasoning runs | pgvector extension replaces OpenSearch; simpler, cheaper |
| AWS EventBridge | Daily cron trigger for Governance Agent at `cron(0 6 * * ? *)` | Native Lambda scheduling |
| AWS Secrets Manager | DB credentials; fetched by API and Lambda at runtime | No hardcoded passwords; rotatable |
| AWS IAM | Least-privilege role `veloquity-lambda-role-{env}` | Required for all Lambda→AWS API calls |
| AWS CloudWatch | Log groups per Lambda (30-day retention) | Default Lambda integration |

**NOT used (explicitly excluded):**

| Service | Reason Excluded |
|---|---|
| Amazon OpenSearch Serverless | $172/month minimum floor cost — replaced by pgvector on existing RDS |
| Amazon ElastiCache Redis | Replaced by PostgreSQL `embedding_cache` table — sufficient at MVP volume |
| Amazon Comprehend | Listed in `CLAUDE.md` architecture but `pii_redaction.py` uses regex-only; Comprehend is never called |

---

## 2. Phase 1 — Ingestion Pipeline

### What Was Built

| File | Key Functions |
|---|---|
| `ingestion/lambda_handler.py` | `handler(event: dict[str, Any], context: Any) -> dict[str, Any]` |
| `ingestion/normalization.py` | `normalize(raw: dict[str, Any], source: str) -> dict[str, Any]` |
| `ingestion/deduplication.py` | `check_and_record(normalized: dict[str, Any]) -> dict[str, Any]` |
| `ingestion/pii_redaction.py` | `redact(text: str) -> str` |
| `ingestion/s3_writer.py` | `write(normalized: dict[str, Any]) -> str` |

### Key Technical Decisions

**SHA-256 content fingerprint deduplication**
The `dedup_index` table stores `hash TEXT PRIMARY KEY` — a SHA-256 of the normalized text field only. Changing metadata (timestamp, source) does not change the hash. This is verified in `test_hash_is_sha256_of_text_only`. On duplicate detection, `frequency` is incremented (not skipped silently), which feeds the Governance Agent's signal promotion logic.

```python
# ingestion/normalization.py — hash is computed on text only
content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
```

**Regex-based PII redaction (not Comprehend)**
Despite `CLAUDE.md` specifying Amazon Comprehend for PII, the actual `pii_redaction.py` uses pure regex with zero AWS API calls. The test `test_no_api_calls_made` explicitly verifies no network calls occur. PII types covered: email, US phone, SSN `(\d{3}-\d{2}-\d{4})`, credit card `(\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4})`, IP address. Replacements are the literal string `[REDACTED]`.

**S3 partitioned key format**
```
{source}/{year}/{month:02d}/{day:02d}/{id}.json
# Example: app_store/2024/06/15/uuid-001.json
```
If timestamp parsing fails, UTC now is used — the write never raises on a bad timestamp (verified in `test_malformed_timestamp_falls_back_to_utc_now`).

**Per-item error isolation**
The `handler` loop catches exceptions per item and increments `errors` without stopping the batch. A failing item does not abort remaining items (verified in `test_bad_item_increments_errors_continues_batch`).

### Data Structures

**Lambda event input shape (inferred from tests):**
```python
event = {
    "source_type": "app_store" | "zendesk",
    "items": [{"body": "..."}, ...]        # app_store: "body" field
              [{"description": "..."}, ...] # zendesk: "description" field
}
```

**Normalized item schema (output of `normalize()`):**
```python
{
    "id":        str,   # UUID v4, unique per call
    "source":    str,   # "app_store" or "zendesk"
    "text":      str,   # PII-redacted text
    "timestamp": str,   # ISO 8601
    "hash":      str,   # SHA-256 hex of text (pre-redaction? post-redaction? — see §13)
}
```

**Lambda return dict:**
```python
{"total": int, "written": int, "duplicates": int, "errors": int}
```
On invalid event (missing `source_type` or non-list `items`): `{"total": 0, "message": str}`.

### What Was Verified

| Class | Test | What It Covers |
|---|---|---|
| `TestPiiRedaction` | `test_pii_email_and_phone_redacted` | Email + phone both replaced |
| `TestPiiRedaction` | `test_clean_text_passes_through` | No-PII text unchanged byte-for-byte |
| `TestPiiRedaction` | `test_no_api_calls_made` | Zero network calls, no boto3 |
| `TestPiiRedaction` | `test_empty_string_returns_empty` | Empty and whitespace returned as-is |
| `TestPiiRedaction` | `test_multiple_pii_types_all_redacted` | SSN, email, phone, CC, IP — ≥5 `[REDACTED]` |
| `TestNormalization` | `test_output_schema_keys` | Exactly `{id, source, text, timestamp, hash}` |
| `TestNormalization` | `test_source_is_propagated` | Source argument flows to output |
| `TestNormalization` | `test_id_is_unique_uuid` | Each call produces distinct 36-char UUID |
| `TestNormalization` | `test_hash_is_sha256_of_text_only` | Same text, different metadata → same hash |
| `TestNormalization` | `test_missing_timestamp_defaults_to_utc_now` | Defaults to UTC now within test window |
| `TestNormalization` | `test_iso8601_timestamp_parsed_correctly` | ISO 8601 strings preserved |
| `TestNormalization` | `test_unix_timestamp_parsed` | Unix int → ISO 8601 |
| `TestNormalization` | `test_app_store_text_extraction` | Reads `body` field for app_store |
| `TestNormalization` | `test_zendesk_text_extraction` | Reads `description` field for zendesk |
| `TestNormalization` | `test_pii_redaction_applied_to_text` | `redact()` called and output used |
| `TestDeduplication` | `test_new_hash_returns_not_duplicate` | New hash → `is_duplicate=False`, INSERT executed, connection released |
| `TestDeduplication` | `test_duplicate_hash_returns_is_duplicate_true` | Existing hash → `is_duplicate=True` |
| `TestDeduplication` | `test_frequency_counter_incremented_on_duplicate` | UPDATE with `frequency` increment executed |
| `TestDeduplication` | `test_db_error_rolls_back_and_reraises` | Exception → rollback + re-raise |
| `TestDeduplication` | `test_connection_always_released` | `release_conn` called even on exception |
| `TestS3Writer` | `test_s3_key_format` | `app_store/2024/06/15/uuid-001.json` |
| `TestS3Writer` | `test_zendesk_key_format` | `zendesk/2025/01/03/ticket-999.json` |
| `TestS3Writer` | `test_put_object_called_with_correct_bucket_and_key` | Bucket from `S3_RAW_BUCKET`, key matches format, `ContentType=application/json` |
| `TestS3Writer` | `test_client_error_is_reraised` | `ClientError` propagates |
| `TestS3Writer` | `test_malformed_timestamp_falls_back_to_utc_now` | Bad timestamp → UTC now used |
| `TestS3Writer` | `test_written_body_is_json` | Body is valid JSON containing `id` and `hash` |
| `TestLambdaHandler` | `test_single_clean_item_written` | `{total:1, written:1, duplicates:0, errors:0}` |
| `TestLambdaHandler` | `test_duplicate_item_not_written` | Duplicate → `written:0`, `s3_writer.write` not called |
| `TestLambdaHandler` | `test_bad_item_increments_errors_continues_batch` | Error on item 1 → `errors:1`, item 2 still processed |
| `TestLambdaHandler` | `test_returns_correct_dict_shape_always` | Empty items list → correct shape |
| `TestLambdaHandler` | `test_missing_source_type_returns_error_response` | Missing key → safe dict with `message` |
| `TestLambdaHandler` | `test_items_not_list_returns_error_response` | Non-list `items` → safe dict |
| `TestLambdaHandler` | `test_mixed_batch_counts` | written+duplicates+errors == total |

---

## 3. Phase 2 — Evidence Intelligence

### What Was Built

| File | Key Functions |
|---|---|
| `evidence/embedding_pipeline.py` | `handler(event: dict[str, Any], context: Any) -> dict[str, Any]`<br>`get_or_create_embedding(text: str, model_version: str) -> list[float] \| None` |
| `evidence/clustering.py` | `cluster_embeddings(vectors: list[dict[str, Any]]) -> list[dict[str, Any]]`<br>`cosine_similarity(a: list[float], b: list[float]) -> float` |
| `evidence/confidence.py` | `compute_confidence(cluster: dict) -> float`<br>`classify_confidence(score: float) -> str` |
| `evidence/threshold.py` | `evaluate_cluster(cluster: dict[str, Any], confidence_score: float) -> dict[str, Any]`<br>`validate_with_llm(cluster: dict[str, Any]) -> dict[str, Any]` |
| `evidence/evidence_writer.py` | `write_evidence(cluster: dict[str, Any], confidence_score: float) -> str`<br>`write_staging(cluster: dict[str, Any], confidence_score: float) -> str`<br>`write_item_map(conn, evidence_id: str, cluster_items: list[dict]) -> int`<br>`compute_source_lineage(items: list[dict[str, Any]]) -> dict[str, float]`<br>`_extract_quotes(items: list[dict[str, Any]], max_quotes: int = 5) -> list[dict]` |

### Key Technical Decisions

**Pure Python cosine clustering (no numpy)**
`clustering.py` implements greedy cosine similarity using only Python's `math` module. Two items merge into a cluster if their cosine similarity to the running mean centroid exceeds `MIN_COSINE_SIMILARITY` (default `0.75` from env var). Clusters below `MIN_CLUSTER_SIZE` (default `5`) are dropped entirely. This was chosen to avoid native extension dependencies in Lambda.

```python
# evidence/clustering.py
def cosine_similarity(a: list[float], b: list[float]) -> float:
    # pure Python dot product / (norm_a * norm_b)
```

**Embedding cache keyed on (content_hash, model_version)**
If the Bedrock model changes, the cache automatically invalidates because `model_version` is part of the composite primary key. No manual purge needed. Cache write failures are non-fatal — the vector is returned anyway (verified in `test_cache_write_failure_is_non_fatal`).

**Three-band confidence routing**
```
score < CONFIDENCE_AUTO_REJECT (0.4)  → "reject"   → write_staging()
score < CONFIDENCE_AUTO_ACCEPT (0.6)  → "ambiguous" → validate_with_llm() → accept or reject
score >= CONFIDENCE_AUTO_ACCEPT (0.6) → "accept"    → write_evidence()
```
Boundary behavior (verified by tests): `classify_confidence(0.4) == "ambiguous"` (not "reject"), `classify_confidence(0.6) == "accept"`.

**Confidence formula:**
```python
clamp(1.0 - (variance * 2), 0.0, 1.0)
# where variance = mean(1 - cosine_similarity(member_vector, centroid))
```
Tight clusters score near 1.0. Very spread vectors clamp to 0.0 — never go negative (verified in `test_clamped_to_zero_not_negative`).

**Lambda event input shape:**
```python
event = {
    "batch": ["app_store/2024/01/01/item-0.json", ...]  # list of S3 keys
}
```
Items are read individually from S3 via `get_object`. Invalid event (missing `batch`) returns `{"processed": 0, "message": str}`.

**Lambda return dict:**
```python
{
    "processed": int,
    "cache_hits": int,
    "bedrock_calls": int,
    "accepted": int,
    "rejected": int,
    "errors": int
}
```

### Data Structures

**Cluster dict (output of `cluster_embeddings()`):**
```python
{
    "cluster_id":       str,            # internal identifier
    "centroid_vector":  list[float],    # running mean of member vectors
    "items":            list[dict],     # each item: {vector, text, source, hash, s3_key, ...}
    "size":             int
}
```

**Evidence written to DB (from `evidence_writer.py`):**
```python
# Columns populated at write time:
theme                 = representative text from _extract_quotes()
representative_quotes = TEXT[]  # proportional source sampling, max 5
unique_user_count     = len(cluster["items"])
confidence_score      = float  # 0–1
source_lineage        = JSONB  # {"app_store": 0.65, "zendesk": 0.35}, sums to 1.0
embedding_vector      = vector(1024)  # centroid vector
embedding_model_version = str  # e.g. "amazon.titan-embed-text-v2:0"
status                = "active"
```

### What Was Verified

| Class | Test | What It Covers |
|---|---|---|
| `TestGetOrCreateEmbeddingCacheHit` | `test_returns_cached_vector_without_bedrock` | Cache hit → Bedrock not called, `cache_hits` +1 |
| `TestGetOrCreateEmbeddingCacheHit` | `test_cache_hit_increments_counter` | `_stats["cache_hits"]` incremented |
| `TestGetOrCreateEmbeddingCacheMiss` | `test_calls_bedrock_on_miss` | Bedrock called, result returned, cache write called, `bedrock_calls` +1 |
| `TestGetOrCreateEmbeddingCacheMiss` | `test_returns_none_on_bedrock_error` | Bedrock returns None → function returns None |
| `TestGetOrCreateEmbeddingCacheMiss` | `test_empty_text_returns_none` | Whitespace-only text → None, cache_lookup not called |
| `TestGetOrCreateEmbeddingCacheMiss` | `test_cache_write_failure_is_non_fatal` | `_cache_write` raises → vector still returned |
| `TestClusterEmbeddings` | `test_skips_none_vectors` | Items with `vector=None` excluded |
| `TestClusterEmbeddings` | `test_similar_items_grouped_together` | 5 identical vectors → 1 cluster of size 5 |
| `TestClusterEmbeddings` | `test_different_items_form_separate_clusters` | Orthogonal vectors → 2 separate clusters |
| `TestClusterEmbeddings` | `test_undersized_clusters_dropped` | 3 items with `MIN_CLUSTER_SIZE=5` → empty result |
| `TestClusterEmbeddings` | `test_empty_input_returns_empty` | `[]` → `[]` |
| `TestComputeConfidence` | `test_identical_vectors_give_high_confidence` | score > 0.9 |
| `TestComputeConfidence` | `test_spread_vectors_give_lower_confidence` | Spread < tight |
| `TestComputeConfidence` | `test_clamped_to_zero_not_negative` | Result always in [0.0, 1.0] |
| `TestComputeConfidence` | `test_empty_cluster_returns_zero` | Empty items → 0.0 |
| `TestComputeConfidence` | `test_items_with_null_vectors_skipped` | None vectors excluded from variance |
| `TestClassifyConfidence` | `test_low_score_is_reject` | 0.3 → "reject" |
| `TestClassifyConfidence` | `test_mid_score_is_ambiguous` | 0.5 → "ambiguous" |
| `TestClassifyConfidence` | `test_high_score_is_accept` | 0.8 → "accept" |
| `TestClassifyConfidence` | `test_boundary_at_reject_threshold` | 0.4 → "ambiguous" (not "reject") |
| `TestClassifyConfidence` | `test_boundary_at_accept_threshold` | 0.6 → "accept" |
| `TestEvaluateCluster` | `test_high_score_auto_accept` | 0.9 → `{decision:"accept", reason:None}` |
| `TestEvaluateCluster` | `test_low_score_auto_reject` | 0.2 → `{decision:"reject", reason:None}` |
| `TestEvaluateCluster` | `test_ambiguous_score_calls_llm` | 0.5 → `validate_with_llm()` called |
| `TestEvaluateCluster` | `test_llm_failure_returns_reject` | LLM returns `{decision:"reject"}` → propagated |
| `TestWriteEvidence` | `test_returns_uuid_string` | Returns 36-char UUID, `commit()` called |
| `TestWriteEvidence` | `test_rollback_on_db_error` | DB error → `rollback()` called, exception re-raised |
| `TestWriteStaging` | `test_returns_uuid_string` | Returns UUID, `commit()` called |
| `TestWriteStaging` | `test_rollback_on_db_error` | DB error → `rollback()` |
| `TestHandlerIntegration` | `test_full_pipeline_accept` | 5 items → 1 cluster → accepted → `write_evidence` called once |
| `TestHandlerIntegration` | `test_full_pipeline_reject` | Rejected cluster → `write_staging` called, `write_evidence` not called |
| `TestHandlerIntegration` | `test_invalid_event_returns_error_dict` | Missing `batch` key → `{processed:0, message:str}` |
| `TestHandlerIntegration` | `test_s3_read_error_counted_in_errors` | `ClientError` on get_object → `errors >= 1` |

---

## 4. Phase 3 — Reasoning Agent

### What Was Built

| File | Key Functions |
|---|---|
| `lambda_reasoning/handler.py` | `handler(event: dict, context: Any) -> dict` |
| `reasoning/agent.py` | `run_reasoning_agent(conn, bedrock_client, s3_client, bucket_name: str) -> dict` |
| `reasoning/retriever.py` | `fetch_active_evidence(conn) -> list[dict]` |
| `reasoning/scorer.py` | `compute_priority_scores(evidence_list: list[dict]) -> list[dict]` |
| `reasoning/prompt_builder.py` | `build_prompt(scored_evidence: list[dict]) -> str`<br>`_format_lineage(source_lineage: dict) -> str` |
| `reasoning/output_writer.py` | `write_results(conn, s3_client, bucket_name: str, evidence_ids: list[str], priority_scores: list[dict], llm_response: dict, token_usage: dict, model_id: str) -> str` |
| `reasoning/output_schema.py` | Placeholder file |
| `reasoning/tools.py` | Placeholder file |
| `reasoning/constraints.json` | Static constraint config (human-editable) |

### Key Technical Decisions

**Priority scoring formula (exact, from `scorer.py`):**
```python
_W_CONFIDENCE   = 0.35
_W_USER_COUNT   = 0.25
_W_SOURCE_CORR  = 0.20
_W_RECENCY      = 0.20

source_corroboration  = 0.1 if len(source_lineage) > 1 else 0.0
normalized_user_count = min(unique_user_count / 50.0, 1.0)

priority_score = (
    confidence_score      * 0.35
    + normalized_user_count * 0.25
    + source_corroboration  * 0.20
    + recency_score         * 0.20
)
```
User count is normalized against a cap of 50. Multi-source presence adds a flat +0.1 bonus applied at weight 0.20 (effective contribution: +0.02 max). Results are sorted descending by `priority_score`.

**Recency score formula (from `retriever.py`):**
```python
recency_score = max(0.0, 1.0 - (days_since_validated / 90.0))
# Evidence validated today → 1.0
# Evidence validated 45 days ago → 0.5
# Evidence validated 90+ days ago → 0.0
```

**LLM model and call parameters (from `agent.py`):**
```
Model:      anthropic.claude-3-5-haiku-20241022-v1:0
Max tokens: 2000
Temperature: 0.2
```
Called via `bedrock_client.invoke_model()`. Response parsed from `body["content"][0]["text"]` as JSON.

**Prompt instructs JSON-only output:**
Verified in test `test_prompt_instructs_json_only`: prompt contains `"Return ONLY a valid JSON object"` and `"No markdown"`. The agent raises `ValueError` on malformed JSON response (verified in `test_raises_on_malformed_json`).

**Raises on empty evidence:**
```python
# reasoning/agent.py
if not evidence_list:
    raise ValueError("No active evidence")
```
Verified in `test_raises_on_no_evidence`.

**S3 report key format:**
```
reasoning-runs/{run_id}.json
```
Verified in `test_s3_put_called_with_correct_key`.

**Lambda handler return shape:**
```python
{"statusCode": 200, "body": "<JSON string>"}  # success
{"statusCode": 500, "body": "<JSON string>"}  # failure
```
Constants in `lambda_reasoning/handler.py`:
```python
BUCKET = "veloquity-reports-dev-082228066878"
REGION = os.environ.get("AWS_REGION_NAME", "us-east-1")
```

**Reasoning constraints (loaded from `reasoning/constraints.json`):**
```json
{
  "engineering_capacity": "medium",
  "current_sprint_load": "high",
  "business_priorities": ["retention", "onboarding", "performance"],
  "risk_flags": ["no breaking API changes", "GDPR compliance"]
}
```

### Data Structures

**LLM response schema (from `test_reasoning_agent.py` fixture and `prompt_builder.py`):**
```json
{
  "recommendations": [
    {
      "rank": 1,
      "theme": "...",
      "recommended_action": "...",
      "effort_estimate": "low|medium|high",
      "user_impact": "low|medium|high",
      "tradeoff_explanation": "...",
      "risk_flags": [],
      "related_clusters": []
    }
  ],
  "meta": {
    "reasoning_summary": "...",
    "highest_priority_theme": "...",
    "cross_cluster_insight": "..."
  }
}
```

**`run_reasoning_agent()` return dict:**
```python
{
    "run_id":          str,   # UUID
    "evidence_count":  int,
    "recommendations": list,
    "meta":            dict,
    "token_usage":     {"input_tokens": int, "output_tokens": int},
    "s3_report_key":   str    # "reasoning-runs/{run_id}.json"
}
```

### What Was Verified

| Class | Test | What It Covers |
|---|---|---|
| `TestFetchActiveEvidence` | `test_returns_empty_list_when_no_rows` | No DB rows → `[]` |
| `TestFetchActiveEvidence` | `test_maps_columns_correctly` | Row → dict with `theme`, `unique_user_count`, `confidence_score` |
| `TestFetchActiveEvidence` | `test_recency_score_recent` | Today → `recency_score = 1.0` |
| `TestFetchActiveEvidence` | `test_recency_score_90_days` | 90 days ago → `recency_score = 0.0` |
| `TestFetchActiveEvidence` | `test_recency_score_45_days` | 45 days ago → `recency_score ≈ 0.5` |
| `TestFetchActiveEvidence` | `test_db_exception_propagates` | DB error → exception raised |
| `TestComputePriorityScores` | `test_single_source_no_corroboration` | Single source: `source_corroboration = 0.0`, formula verified |
| `TestComputePriorityScores` | `test_multi_source_corroboration` | Two sources: `source_corroboration = 0.1`, formula verified |
| `TestComputePriorityScores` | `test_user_count_capped_at_1` | user_count=200 → `normalized_user_count = 1.0` |
| `TestComputePriorityScores` | `test_sorted_descending` | High-score item appears first |
| `TestComputePriorityScores` | `test_empty_list` | `[]` → `[]` |
| `TestComputePriorityScores` | `test_zero_recency` | `recency_score=0.0` included in formula |
| `TestBuildPrompt` | `test_format_lineage_single` | `{"zendesk": 1.0}` → `"zendesk (100%)"` |
| `TestBuildPrompt` | `test_format_lineage_multi` | Two sources → both appear in string |
| `TestBuildPrompt` | `test_format_lineage_empty` | `{}` → `"unknown"` |
| `TestBuildPrompt` | `test_prompt_contains_theme` | Theme string appears in prompt |
| `TestBuildPrompt` | `test_prompt_contains_json_schema` | `recommendations`, `recommended_action`, `effort_estimate`, `meta` all present |
| `TestBuildPrompt` | `test_prompt_instructs_json_only` | `"Return ONLY a valid JSON object"` and `"No markdown"` present |
| `TestBuildPrompt` | `test_cluster_rank_numbers` | `"Cluster #1"`, `"Cluster #2"`, `"Cluster #3"` present |
| `TestWriteResults` | `test_returns_run_id_string` | Returns 36-char UUID |
| `TestWriteResults` | `test_s3_put_called_with_correct_key` | `Bucket=my-bucket`, key contains `run_id` and `"reasoning-runs/"` |
| `TestWriteResults` | `test_db_commit_called` | `conn.commit()` called |
| `TestWriteResults` | `test_db_error_raises` | `conn.cursor()` raises → exception propagates |
| `TestRunReasoningAgent` | `test_raises_on_no_evidence` | Empty DB → `ValueError` |
| `TestRunReasoningAgent` | `test_raises_on_malformed_json` | Non-JSON LLM response → `ValueError` |
| `TestRunReasoningAgent` | `test_happy_path_returns_expected_keys` | All keys present, `evidence_count=1`, `token_usage` correct |
| `TestRunReasoningAgent` | `test_happy_path_s3_upload_called` | S3 `put_object` called with correct bucket |
| `TestRunReasoningAgent` | `test_bedrock_error_propagates` | Bedrock raises → exception propagates |

---

## 5. Phase 5 — Governance Agent

### What Was Built

| File | Key Functions |
|---|---|
| `governance/governance_lambda.py` | `handler(event: dict, context) -> dict` |
| `governance/stale_detection.py` | `detect_and_flag_stale(conn) -> list[dict]` |
| `governance/signal_promotion.py` | `promote_staging_signals(conn) -> list[dict]`<br>`_recover_item_map(conn, evidence_id: str, source: str, frequency: int) -> int` |
| `governance/cost_monitor.py` | `check_cost_signals(conn) -> dict` |
| `governance/audit_log.py` | `write_audit_entry(conn, event_type: str, details: Optional[dict] = None, target_id: Optional[str] = None) -> None` |

### Key Technical Decisions

**Decision-tree only (no LLM)**
The Governance Agent uses hardcoded threshold logic, not an LLM. All decisions are deterministic: the same DB state always produces the same actions. This is intentional — it makes governance behavior auditable.

**Stale threshold (from `stale_detection.py`):**
```python
_STALE_DAYS = 30
# Query: evidence WHERE last_validated_at < NOW() - INTERVAL '30 days'
# Action: UPDATE evidence SET status = 'stale'
```

**Signal promotion threshold (from `signal_promotion.py`):**
```python
_PROMOTION_THRESHOLD = 10
# Query: low_confidence_staging WHERE frequency >= 10 AND promoted = FALSE
# Action: INSERT into evidence, UPDATE staging SET promoted=TRUE, promoted_at=NOW()
```

**Cost monitoring threshold (from `cost_monitor.py`):**
```python
_CACHE_HIT_RATE_THRESHOLD = 0.40
# alert_triggered = cache_count < 0.40 * evidence_count
```

**Return dict:**
```python
{"statusCode": 200|500, "body": "<JSON string>"}
# body contains: {"stale_flagged": [...], "signals_promoted": [...], "cost_signals": {...}, "report_url": str}
```

**Reports bucket constant (from `governance_lambda.py`):**
```python
REPORTS_BUCKET = os.environ.get("REPORTS_BUCKET", "veloquity-reports-dev-082228066878")
```

**`governance_log` is append-only.** `write_audit_entry()` only does INSERT. The SQL schema comment states `"Never update or delete rows from this table."` The valid `event_type` values (enforced by DB CHECK constraint) are:
```
'stale_detected', 'signal_promoted', 'reprocess_triggered', 'cost_alert',
'threshold_alert', 'cache_purge', 'duplicate_pattern_flagged'
```

**Note on test coverage:** `tests/test_governance.py` exists but is a placeholder — no test methods are implemented.

### Data Structures

**`detect_and_flag_stale()` return:**
```python
[{"id": str, "theme": str, "days_stale": int}, ...]
```

**`promote_staging_signals()` return:**
```python
[{"staging_id": str, "cluster_size": int, "frequency": int, "confidence_score": float}, ...]
```

**`check_cost_signals()` return:**
```python
{"cache_count": int, "evidence_count": int, "alert_triggered": bool}
```

---

## 6. Output Generation

### What Was Built

| File | Key Functions |
|---|---|
| `output/html_report.py` | `generate_and_upload(conn, s3_client, bucket_name: str) -> str` |
| `output/slack_digest.py` | Placeholder file — no implemented functions |

**`html_report.py` constants:**
```python
_S3_KEY = "reports/latest.html"
_PRESIGN_EXPIRY = 86400  # 24 hours
```
Generates a self-contained dark-theme HTML report. Uploads to S3. Returns a public or pre-signed URL. Called by both the Reasoning Agent (after each run) and the Governance Agent (daily).

**`slack_digest.py`** is a placeholder. No Slack messages are ever sent by the current codebase.

---

## 7. API Layer (FastAPI)

### What Was Built

| File | Key Functions / Endpoints |
|---|---|
| `api/main.py` | FastAPI app, CORS middleware, route registration, health check, global exception handler |
| `api/db.py` | `_get_credentials() -> dict`, `get_pool() -> SimpleConnectionPool`, `get_conn()`, `release_conn(conn)` |
| `api/dependencies.py` | `get_db_connection() -> Generator`, `get_bedrock_client()`, `get_lambda_client()` |
| `api/schemas.py` | Pydantic v2 models: `EvidenceItem`, `EvidenceMapItem`, `Recommendation`, `ReasoningRun`, `ChatMessage`, `ChatRequest`, `ChatResponse` |
| `api/routes/evidence.py` | `GET /api/v1/evidence/`, `GET /api/v1/evidence/{evidence_id}/items` |
| `api/routes/recommendations.py` | `GET /api/v1/recommendations/` |
| `api/routes/constraints.py` | `GET /api/v1/constraints/`, `POST /api/v1/constraints/` |
| `api/routes/agents.py` | `GET /api/v1/agents/status`, `POST /api/v1/agents/{name}/run` |
| `api/routes/governance.py` | `GET /api/v1/governance/log`, `GET /api/v1/governance/stats` |
| `api/routes/chat.py` | `POST /api/v1/chat/` |

### Route Details

**`GET /api/v1/evidence/`**
- Query params: `source: Optional[str]`, `sort_by: str` (default `"confidence_score"`, validated by pattern)
- Response: `list[EvidenceItem]` — sorted, with normalized `representative_quotes` and `source_lineage`

**`GET /api/v1/evidence/{evidence_id}/items`**
- Response: `list[EvidenceMapItem]` — provenance map from `evidence_item_map` table

**`GET /api/v1/recommendations/`**
- Returns latest row from `reasoning_runs`, parsed into `ReasoningRun` schema
- Parses `llm_response JSONB` → `recommendations[]` + `meta` fields

**`GET /api/v1/constraints/` and `POST /api/v1/constraints/`**
- Reads/writes `system_config` table using JSONB merge on POST
- Defaults: `max_recommendations=10`, `min_confidence_threshold=0.6`, `stale_evidence_days=30`, `signal_promotion_frequency=10`

**`GET /api/v1/agents/status`**
- Returns status for 4 agents, reading `last_run_at` and `total_runs` from DB (tables: `dedup_index`, `evidence`, `reasoning_runs`, `governance_log`)

**`POST /api/v1/agents/{name}/run`**
- Invokes Lambda synchronously via `boto3.client("lambda").invoke()`
- Agent name maps to Lambda function name: `veloquity-{name}-dev`

**`POST /api/v1/chat/`**
- Model: `anthropic.claude-3-5-haiku-20241022-v1:0`, `max_tokens=1024`
- Builds system prompt from active evidence, latest reasoning run, governance events
- Falls back gracefully when Bedrock unavailable

**CORS configuration (from `api/main.py:25–33`):**
```python
frontend_url = os.environ.get("FRONTEND_URL", "*")
origins = [frontend_url] if frontend_url != "*" else ["*"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
```
If `FRONTEND_URL` is not set, CORS allows all origins (`"*"`).

**DB connection pool (from `api/db.py`):**
```python
psycopg2.pool.SimpleConnectionPool(minconn=1, maxconn=5)
```
Credentials fetched from AWS Secrets Manager via `DB_SECRET_ARN`. Falls back to direct env vars `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Falls back to `_MockConnection` if pool init fails (so the API starts even without DB access).

**`api/app.py`** also exists as a legacy entry point (`FastAPI(title="Veloquity API", version="0.1.0")`) with basic routes. The active entry point is `api/main.py` (referenced in `render.yaml`).

### Pydantic v2 Schemas

```python
class EvidenceItem(BaseModel):
    id: str
    theme: str
    confidence_score: float
    unique_user_count: int
    source_lineage: Record[str, number]
    representative_quotes: list[dict]  # [{text: str, source: str}]
    status: str
    last_validated_at: str | None

class Recommendation(BaseModel):
    rank: int
    theme: str
    recommended_action: str
    effort_estimate: Literal["low", "medium", "high"]
    user_impact: Literal["low", "medium", "high"]
    tradeoff_explanation: str
    risk_flags: list[str]
    related_clusters: list[int]

class ReasoningRun(BaseModel):
    id: str
    run_at: str
    model_id: str
    token_usage: dict  # {input_tokens?, output_tokens?}
    recommendations: list[Recommendation]
    reasoning_summary: str
    highest_priority_theme: str
    cross_cluster_insight: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str
    context_used: list[str]
```

---

## 8. Database Schema

All migrations run in order `001` → `008`. Requires PostgreSQL 16+ with `pgvector` extension.

### Migration 001 — Extensions
```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Migration 002 — evidence
```sql
CREATE TABLE evidence (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    theme                   TEXT NOT NULL,
    representative_quotes   TEXT[] NOT NULL DEFAULT '{}',
    unique_user_count       INTEGER NOT NULL DEFAULT 0,
    confidence_score        FLOAT NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    source_lineage          JSONB NOT NULL DEFAULT '{}',
    temporal_decay_weight   FLOAT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_validated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    embedding_vector        vector(1024),
    embedding_model_version TEXT NOT NULL,
    status                  TEXT NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','stale','rejected','pending_reprocess'))
);
CREATE INDEX idx_evidence_embedding ON evidence
    USING hnsw (embedding_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_evidence_last_validated ON evidence (last_validated_at);
CREATE INDEX idx_evidence_status ON evidence (status);
CREATE INDEX idx_evidence_confidence ON evidence (confidence_score);
```

### Migration 003 — dedup_index
```sql
CREATE TABLE dedup_index (
    hash        TEXT PRIMARY KEY,
    source      TEXT NOT NULL,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    frequency   INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_dedup_source ON dedup_index (source);
```

### Migration 004 — embedding_cache
```sql
CREATE TABLE embedding_cache (
    content_hash     TEXT NOT NULL,
    model_version    TEXT NOT NULL,
    embedding_vector vector(1024) NOT NULL,
    cached_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (content_hash, model_version)
);
CREATE INDEX idx_embedding_cache_cached_at ON embedding_cache (cached_at);
```

### Migration 005 — low_confidence_staging
```sql
CREATE TABLE low_confidence_staging (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_hash     TEXT NOT NULL,
    source           TEXT NOT NULL,
    raw_text_sample  TEXT,
    confidence_score FLOAT NOT NULL,
    cluster_size     INTEGER NOT NULL DEFAULT 1,
    frequency        INTEGER NOT NULL DEFAULT 1,
    first_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    promoted         BOOLEAN NOT NULL DEFAULT FALSE,
    promoted_at      TIMESTAMPTZ
);
CREATE INDEX idx_staging_frequency ON low_confidence_staging (frequency, last_seen);
CREATE INDEX idx_staging_promoted ON low_confidence_staging (promoted);
```
Comment: `"If frequency > 10 in 7 days → promote to pending_reprocess."` (7-day window mentioned in SQL comment; code uses threshold only, no time window — see §13.)

### Migration 006 — governance_log
```sql
CREATE TABLE governance_log (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type  TEXT NOT NULL CHECK (event_type IN (
                    'stale_detected', 'signal_promoted', 'reprocess_triggered',
                    'cost_alert', 'threshold_alert', 'cache_purge',
                    'duplicate_pattern_flagged'
                )),
    target_id   UUID,
    details     JSONB NOT NULL DEFAULT '{}',
    actioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_governance_log_event_type ON governance_log (event_type, actioned_at DESC);
```

### Migration 007 — reasoning_runs
```sql
CREATE TABLE IF NOT EXISTS reasoning_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evidence_ids    UUID[] NOT NULL,
    priority_scores JSONB NOT NULL,
    llm_response    JSONB NOT NULL,
    model_id        TEXT NOT NULL,
    token_usage     JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'completed',
    s3_report_key   TEXT
);
CREATE INDEX idx_reasoning_runs_run_at ON reasoning_runs(run_at DESC);
```

### Migration 008 — evidence_item_map
```sql
CREATE TABLE IF NOT EXISTS evidence_item_map (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id    UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
    dedup_hash     TEXT NOT NULL,
    s3_key         TEXT NOT NULL,
    source         TEXT NOT NULL,
    item_id        TEXT NOT NULL,
    item_timestamp TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evidence_item UNIQUE (evidence_id, dedup_hash),
    CONSTRAINT fk_dedup_hash FOREIGN KEY (dedup_hash) REFERENCES dedup_index(hash)
);
CREATE INDEX IF NOT EXISTS idx_eim_evidence_id    ON evidence_item_map(evidence_id);
CREATE INDEX IF NOT EXISTS idx_eim_dedup_hash     ON evidence_item_map(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_eim_source_evidence ON evidence_item_map(source, evidence_id);
CREATE INDEX IF NOT EXISTS idx_eim_item_timestamp  ON evidence_item_map(item_timestamp DESC)
    WHERE item_timestamp IS NOT NULL;
```

---

## 9. Frontend (React SPA)

The active frontend is `frontend_final/`. The `frontend/` directory is a prior iteration.

### Component Inventory

| File | What It Renders | Key State | Data Source |
|---|---|---|---|
| `App.tsx` | BrowserRouter + all routes | — | — |
| `pages/Landing.tsx` | Navbar, Hero, BentoGrid, Footer | — | Hardcoded |
| `pages/Dashboard.tsx` | 4 stat cards, Theme Rankings, Confidence Distribution histogram | `evidence` (starts as `MOCK_EVIDENCE`) | `getEvidence()` on mount; `VELOQUITY_THEMES` and metric constants always hardcoded |
| `pages/EvidenceGrid.tsx` | 6 expandable evidence cards with confidence gauges, quotes, linked feedback | `evidenceList` (starts as `EVIDENCE_DATA`), `expandedId` | `getEvidence()` on mount; API result replaces only if `isValidApiItem()` passes |
| `pages/Agents.tsx` | Pipeline flow diagram, 4 agent cards with Run buttons, per-agent output boxes, toasts | `agents`, `runStatus`, `lastResult`, `lastRanAt`, `toasts` | `getAgentStatus()` on mount; `runAgent(shortKey)` on button click |
| `pages/Chat.tsx` | System context panel (left), chat messages (right), starter questions, input bar | `messages`, `input`, `sending`, `contextInfo` | `getEvidence()` + `getRecommendations()` on mount for context counts; `sendChatMessage()` per message |
| `pages/DataStudio.tsx` | Feedback table with search/filter/bulk actions | `searchQuery`, `selectedSource`, `selectedStatus`, `selectedItems`, `showAddModal` | Hardcoded `MOCK_FEEDBACK` — no API calls |
| `pages/Settings.tsx` | Profile, appearance, notifications settings | Local state | Hardcoded; reads/writes `AppContext` |
| `pages/ConfidenceScores.tsx` | Confidence score visualizations | Local state | Hardcoded |
| `pages/Themes.tsx` | Theme breakdown | Local state | Hardcoded |
| `pages/Trends.tsx` | Trend charts | Local state | Hardcoded |
| `pages/Scenarios.tsx` | Scenario planning UI | Local state | Hardcoded |
| `pages/DecisionPlayground.tsx` | Decision simulation | Local state | Hardcoded |
| `pages/ImportSources.tsx` | Source connection UI | Local state | Hardcoded |
| `components/app/AppLayout.tsx` | Shell with `LeftRail` + `Outlet` | — | AppContext |
| `components/app/AppHeader.tsx` | Top bar with search, theme toggle, user avatar | — | AppContext |
| `components/app/LeftRail.tsx` | Navigation sidebar with route links | `collapsed` | AppContext |
| `components/app/ContextPanel.tsx` | Slide-in context drawer | — | AppContext |
| `components/app/OnboardingTour.tsx` | First-visit overlay | — | AppContext (`showOnboarding`) |
| `components/landing/Hero.tsx` | Landing page hero section | — | Hardcoded |
| `components/landing/BentoGrid.tsx` | Feature grid | — | Hardcoded |
| `components/landing/Navbar.tsx` | Landing page nav | — | Hardcoded |
| `components/landing/Footer.tsx` | Landing page footer | — | Hardcoded |
| `components/landing/AppMockup.tsx` | Product screenshot mockup | — | Hardcoded |
| `components/ui/*` | shadcn/ui Radix primitives: badge, button, card, dropdown-menu, input, label, progress, select, separator, slider, switch, tabs, textarea | — | — |

### Design System

**CSS variables (`src/globals.css`) — Light mode:**
```css
--background:           0 0% 100%
--foreground:           222.2 84% 4.9%
--card:                 0 0% 100%
--primary:              262.1 83.3% 57.8%    /* violet */
--secondary:            210 40% 96.1%
--muted:                210 40% 96.1%
--muted-foreground:     215.4 16.3% 46.9%
--accent:               210 40% 96.1%
--destructive:          0 84.2% 60.2%
--border:               214.3 31.8% 91.4%
--input:                214.3 31.8% 91.4%
--ring:                 262.1 83.3% 57.8%
--radius:               0.75rem
```

**CSS variables — Dark mode (`.dark`):**
```css
--background:           222.2 84% 4.9%
--foreground:           210 40% 98%
--card:                 222.2 84% 4.9%
--primary:              263.4 70% 50.4%
--secondary:            217.2 32.6% 17.5%
--muted:                217.2 32.6% 17.5%
--muted-foreground:     215 20.2% 65.1%
--accent:               217.2 32.6% 17.5%
--destructive:          0 62.8% 30.6%
--border:               217.2 32.6% 17.5%
--input:                217.2 32.6% 17.5%
--ring:                 263.4 70% 50.4%
```

**Font:** `system-ui, -apple-system, sans-serif` (no custom font imports).

**Dark mode:** `darkMode: ['class']` in `tailwind.config.js`. Toggled by `document.documentElement.classList.toggle('dark', ...)` in `app-context.tsx:82`. Persisted to `localStorage['veloquity-theme']`. Default: `'system'` (respects `prefers-color-scheme`).

**Animation:** Framer Motion 12.26.2. Patterns used:
- Entry: `initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}`
- Hover lift: `whileHover={{ y: -4 }}`
- Bar fill: `initial={{ width: 0 }} animate={{ width: '...' }} transition={{ duration: 0.8 }}`
- Stagger: `transition={{ delay: i * 0.1 }}`
- `AnimatePresence` wraps message list in Chat, expanded panels in EvidenceGrid

**Scrollbar:** Custom 6px wide, transparent track, `hsl(var(--border))` thumb.

### Canonical Dataset

**Dashboard constants (always hardcoded, never replaced by API):**
```typescript
TOTAL_FEEDBACK    = 547
EVIDENCE_CLUSTERS = 6
AVG_CONFIDENCE    = 84   // percent
ANALYZED_PCT      = 91   // percent
```

**`VELOQUITY_THEMES` (Dashboard theme rankings — always hardcoded):**
```typescript
{ id:'t1', name:'App crashes on project switch',        feedbackCount:138, avgConfidence:91, trend:'rising'   }
{ id:'t2', name:'Black screen after latest update',     feedbackCount:112, avgConfidence:87, trend:'rising'   }
{ id:'t3', name:'Dashboard load time regression',       feedbackCount:94,  avgConfidence:85, trend:'stable'   }
{ id:'t4', name:'No onboarding checklist for new users',feedbackCount:82,  avgConfidence:81, trend:'rising'   }
{ id:'t5', name:'Export to CSV silently fails',         feedbackCount:58,  avgConfidence:76, trend:'declining'}
{ id:'t6', name:'Notification delay on mobile',         feedbackCount:37,  avgConfidence:71, trend:'stable'   }
// feedbackCounts sum: 521 (26 ungrouped noise items — intentional)
```

**`CONFIDENCE_BUCKETS` (Dashboard histogram — always hardcoded):**
```typescript
{ label:'90-100%', count:153, color:'bg-green-500'  }
{ label:'70-89%',  count:235, color:'bg-blue-500'   }
{ label:'50-69%',  count:109, color:'bg-orange-500' }
{ label:'<50%',    count:50,  color:'bg-red-500'     }
// 153+235+109+50 = 547 ✓
```

**`EVIDENCE_DATA` (EvidenceGrid — 6 clusters, used when API is absent or fails guard):**
```typescript
{ id:'ev1', title:'App crashes on project switch',        confidence:91, uncertaintyRange:[84,96], feedbackCount:138, uniqueUsers:94,  category:'Technical', trend:'rising',   lastValidated:'2026-03-10' }
{ id:'ev2', title:'Black screen after latest update',     confidence:87, uncertaintyRange:[80,93], feedbackCount:112, uniqueUsers:78,  category:'Technical', trend:'rising',   lastValidated:'2026-03-10' }
{ id:'ev3', title:'Dashboard load time regression',       confidence:86, uncertaintyRange:[79,91], feedbackCount:94,  uniqueUsers:61,  category:'Technical', trend:'stable',   lastValidated:'2026-03-10' }
{ id:'ev4', title:'No onboarding checklist for new users',confidence:81, uncertaintyRange:[74,87], feedbackCount:82,  uniqueUsers:67,  category:'UX',        trend:'rising',   lastValidated:'2026-03-09' }
{ id:'ev5', title:'Export to CSV silently fails',         confidence:77, uncertaintyRange:[69,84], feedbackCount:58,  uniqueUsers:39,  category:'Feature',   trend:'declining',lastValidated:'2026-03-09' }
{ id:'ev6', title:'Notification delay on mobile',         confidence:72, uncertaintyRange:[63,80], feedbackCount:37,  uniqueUsers:28,  category:'Feature',   trend:'stable',   lastValidated:'2026-03-08' }
```

**`MOCK_EVIDENCE` (4 clusters — used as Dashboard initial state, from `src/api/mockData.ts`):**
```typescript
{ id:'ev-001', theme:'Mobile App Performance Degradation', confidence:0.91, user_count:247, source_distribution:{app_store:68, zendesk:32} }
{ id:'ev-002', theme:'Dark Mode Feature Request',           confidence:0.87, user_count:189, source_distribution:{app_store:45, zendesk:55} }
{ id:'ev-003', theme:'Data Export Reliability Issues',      confidence:0.78, user_count:134, source_distribution:{app_store:20, zendesk:80} }
{ id:'ev-004', theme:'Enterprise SSO Integration Demand',   confidence:0.82, user_count:98,  source_distribution:{app_store:10, zendesk:90} }
```

**`MOCK_RECOMMENDATIONS` (from `src/api/mockData.ts`):**
```typescript
run_id: "run-demo-001"
model_id: "anthropic.claude-3-haiku-20240307-v1:0"   // ← DIFFERS from deployed model
reasoning_summary: "Analysis of 668 feedback signals across 4 evidence clusters..."
cross_cluster_insight: "Mobile performance issues correlate strongly with enterprise churn signals..."
rank1: Mobile App Performance Degradation  effort=high   impact=high   confidence=0.91
rank2: Dark Mode Feature Request           effort=medium impact=high   confidence=0.87
rank3: Data Export Reliability Issues      effort=low    impact=medium confidence=0.78
rank4: Enterprise SSO Integration Demand   effort=high   impact=high   confidence=0.82
```

**`AGENT_CONFIG` (Agents page — exact values including accent colors):**
```typescript
{ lambdaName:'veloquity-ingestion-dev',  shortKey:'ingestion',  display:'Ingestion Agent',              accent:'#6366f1', Icon:Zap,      tags:['AWS Lambda','S3','SHA-256','PII Redact'] }
{ lambdaName:'veloquity-evidence-dev',   shortKey:'evidence',   display:'Evidence Intelligence Agent',  accent:'#8b5cf6', Icon:Database, tags:['Titan Embed V2','pgvector','RDS','1024-dim'] }
{ lambdaName:'veloquity-reasoning-dev',  shortKey:'reasoning',  display:'Reasoning Agent',              accent:'#a855f7', Icon:Brain,    tags:['Claude 3 Haiku','Bedrock','Confidence Score'] }
{ lambdaName:'veloquity-governance-dev', shortKey:'governance', display:'Governance Agent',             accent:'#3b82f6', Icon:Shield,   tags:['EventBridge','Stale Detection','Daily Cron'] }
```

**`MOCK_AGENTS` (from `src/api/mockData.ts`):**
```typescript
{ name:'ingestion',  last_run_at:'2026-03-10T06:02:00Z', total_runs:47, last_run_status:'success' }
{ name:'evidence',   last_run_at:'2026-03-10T06:08:00Z', total_runs:43, last_run_status:'success' }
{ name:'reasoning',  last_run_at:'2026-03-10T06:15:00Z', total_runs:38, last_run_status:'success' }
{ name:'governance', last_run_at:'2026-03-10T06:00:00Z', total_runs:52, last_run_status:'success' }
```

**`MOCK_GOVERNANCE` (5 events, from `src/api/mockData.ts`):**
```typescript
{ id:'g-001', event_type:'signal_promoted',  details:{theme:'Mobile App Performance Degradation', user_count:247, reason:'frequency>=10 threshold met'} }
{ id:'g-002', event_type:'stale_flagged',    details:{evidence_id:'ev-legacy-003', days_inactive:34} }
{ id:'g-003', event_type:'cache_rate_alert', details:{cache_hit_rate:0.67, threshold:0.70, recommendation:'Consider expanding embedding cache TTL'} }
{ id:'g-004', event_type:'signal_promoted',  details:{theme:'Dark Mode Feature Request', user_count:189} }
{ id:'g-005', event_type:'stale_flagged',    details:{evidence_id:'ev-legacy-001', days_inactive:31} }
```
Note: mock uses `cache_rate_alert`; DB schema `event_type` CHECK constraint uses `cost_alert`. These do not match.

**`MOCK_STATS`:**
```typescript
{ total:5, last_24h:3, last_7d:5, events_by_type:{signal_promoted:2, stale_flagged:2, cache_rate_alert:1}, active_evidence:4, staging_count:0 }
```

**Status dot color logic (Agents page):**
```typescript
running → '#F59E0B'   // amber
success → '#10B981'   // emerald
error   → '#EF4444'   // red
last_run_at ≤ 7 days  → '#10B981'
last_run_at 8-30 days → '#F59E0B'
last_run_at > 30 days → '#EF4444'
```

**Chat fallback keyword matching (`src/pages/Chat.tsx:29–37`):**
```typescript
q.includes('top 3') || q.includes('evidence cluster') → detailed top-3 response
q.includes('prioritize') || q.includes('sprint')      → sprint allocation response
q.includes('stale')                                    → governance stale check response
q.includes('governance') || q.includes('flag')        → governance log response
q.includes('confident') || q.includes('crash') || q.includes('mobile') → confidence detail
(default)                                              → 547-item / 84% avg / 6 clusters summary
```

**Global app context defaults (from `src/lib/app-context.tsx`):**
```typescript
theme: 'system'
userProfile: { name: 'Alex Johnson', email: 'alex@veloquity.io', company: 'Acme Corp' }
sidebarCollapsed: false
showOnboarding: false  // true on first visit (checked via localStorage['veloquity-visited'])
```
localStorage keys: `'veloquity-theme'`, `'veloquity-profile'`, `'veloquity-visited'`

### API Integration

| Endpoint | Method | Component | Error Handling |
|---|---|---|---|
| `${V1}/evidence/` | GET | Dashboard, EvidenceGrid, Chat | `.catch(() => {})` — silently keeps mock data |
| `${V1}/evidence/{id}/items` | GET | EvidenceGrid (expand) | `.catch(() => {})` |
| `${V1}/recommendations/` | GET | Chat (context count) | `.catch(() => {})` |
| `${V1}/agents/status` | GET | Agents | `.catch(() => { setAgents(MOCK_AGENTS) })` |
| `${V1}/agents/{name}/run` | POST | Agents (Run button) | `addToast(msg, false)` — amber toast for 4s |
| `${V1}/governance/log` | GET | (not wired to any page at time of reading) | — |
| `${V1}/governance/stats` | GET | (not wired to any page at time of reading) | — |
| `${V1}/chat/` | POST | Chat | `getSmartFallback(text)` — keyword-matched response |
| `${V1}/constraints/` | GET | Settings | — |
| `${V1}/constraints/` | POST | Settings | — |

**Base URL (`src/api/client.ts:6`):**
```typescript
const BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:8002'
```
Note: fallback port is `8002`, not `8000`. If the API runs on `8000` locally, all frontend API calls will fail and mock data will be shown.

---

## 10. Deployment

### Deployment Topology

```
Vercel (frontend_final/) ←→ Render (api/) ←→ AWS RDS (PostgreSQL)
                                           ←→ AWS Lambda × 4
                                           ←→ AWS Bedrock
                                           ←→ AWS S3 × 2
                                           ←→ AWS Secrets Manager
```

### Every Environment Variable

| Variable | Where Set | Where Used | What It Controls |
|---|---|---|---|
| `VITE_API_URL` | Vercel env / `vercel.json` | `frontend_final/src/api/client.ts:6` | Backend base URL for all frontend fetch calls |
| `FRONTEND_URL` | Render dashboard / `render.yaml` (sync:false) | `api/main.py:25` | CORS allowed origin; if unset → `"*"` (all origins) |
| `DB_SECRET_ARN` | Render dashboard / `render.yaml` (sync:false) | `api/db.py` | Secrets Manager ARN for DB credentials |
| `AWS_REGION_NAME` | `render.yaml` value: `us-east-1` | `api/dependencies.py`, `lambda_reasoning/handler.py` | Bedrock + Lambda + S3 region |
| `AWS_ACCESS_KEY_ID` | Render dashboard / `render.yaml` (sync:false) | boto3 default credential chain | AWS authentication |
| `AWS_SECRET_ACCESS_KEY` | Render dashboard / `render.yaml` (sync:false) | boto3 default credential chain | AWS authentication |
| `DB_HOST` | `.env` / Lambda env | `api/dependencies.py` (fallback) | RDS hostname |
| `DB_PORT` | `.env` / Lambda env | `api/dependencies.py` (fallback) | RDS port (default 5432) |
| `DB_NAME` | `.env` / Lambda env | `api/dependencies.py` (fallback) | DB name (default `veloquity`) |
| `DB_USER` | `.env` / Lambda env | `api/dependencies.py` (fallback) | DB username |
| `DB_PASSWORD` | `.env` / Lambda env | `api/dependencies.py` (fallback) | DB password |
| `S3_RAW_BUCKET` | Lambda env / `.env` | `ingestion/s3_writer.py`, `evidence/embedding_pipeline.py` | Raw feedback landing bucket |
| `REPORTS_BUCKET` | Lambda env | `governance/governance_lambda.py`, `lambda_reasoning/handler.py` | HTML report + reasoning-runs S3 bucket |
| `BEDROCK_EMBED_MODEL` | Lambda env / `.env` | `evidence/embedding_pipeline.py` | Bedrock embedding model ID |
| `BEDROCK_LLM_MODEL` | Lambda env / `.env` | `reasoning/agent.py`, `evidence/threshold.py` (LLM validation) | Bedrock reasoning/chat model ID |
| `REASONING_LAMBDA_NAME` | API env | `api/routes/agents.py` | Lambda function name prefix for invocation |
| `CONFIDENCE_AUTO_REJECT` | Lambda env | `evidence/confidence.py` | Below this score → reject (default `0.4`) |
| `CONFIDENCE_AUTO_ACCEPT` | Lambda env | `evidence/confidence.py` | Above this score → accept (default `0.6`) |
| `MIN_CLUSTER_SIZE` | Lambda env | `evidence/clustering.py` | Minimum items to form valid cluster (default `5`) |
| `MIN_COSINE_SIMILARITY` | Lambda env | `evidence/clustering.py` | Minimum cosine similarity for cluster membership (default `0.75`) |
| `STALE_SIGNAL_DAYS` | Lambda env | `governance/stale_detection.py` | Days before evidence flagged stale (default `30`) |
| `SIGNAL_PROMOTION_FREQ` | Lambda env | `governance/signal_promotion.py` | Frequency threshold for staging promotion (default `10`) |
| `CACHE_HIT_RATE_ALERT` | Lambda env | `governance/cost_monitor.py` | Cache rate below this triggers alert (default `0.40`) |
| `SLACK_WEBHOOK_URL` | Lambda env | `output/slack_digest.py` (placeholder — never called) | Slack outbound webhook |
| `PORT` | Render auto-set | `api/main.py:63` | Uvicorn listen port |

### Deployment Config Files

**`vercel.json` (complete):**
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "env": {
    "VITE_API_URL": "your-render-api-url-here"
  }
}
```

**`render.yaml` (complete):**
```yaml
services:
  - type: web
    name: veloquity-api
    runtime: python
    rootDir: api
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn main:app --host 0.0.0.0 --port $PORT
    envVars:
      - key: DB_SECRET_ARN
        sync: false
      - key: AWS_REGION_NAME
        value: us-east-1
      - key: AWS_ACCESS_KEY_ID
        sync: false
      - key: AWS_SECRET_ACCESS_KEY
        sync: false
      - key: FRONTEND_URL
        sync: false
```

**`api/requirements.txt` (exact versions):**
```
fastapi==0.115.0
uvicorn==0.30.0
pydantic==2.9.2
psycopg2-binary==2.9.9
pgvector==0.2.5
boto3==1.34.0
python-dotenv==1.0.1
```

### Step-by-Step Deployment Guide

**Prerequisites:** AWS account, filled `infra/parameters.json`, S3 deploy bucket pre-created.

**Step 1 — AWS Infrastructure:**
```bash
bash infra/deploy.sh dev
# Packages 4 Lambda zips, uploads to S3, validates and deploys CloudFormation stack veloquity-dev
# Runs DB migrations automatically
```

**Step 2 — DB migrations (if not run by deploy.sh):**
```bash
psql -h $DB_HOST -U veloquity_user -d veloquity \
  -f db/migrations/001_create_extensions.sql \
  -f db/migrations/002_create_evidence.sql \
  -f db/migrations/003_create_dedup.sql \
  -f db/migrations/004_create_embedding_cache.sql \
  -f db/migrations/005_create_staging.sql \
  -f db/migrations/006_create_governance_log.sql \
  -f db/migrations/007_create_reasoning_runs.sql \
  -f db/migrations/008_create_evidence_item_map.sql
```

**Step 3 — Seed data (optional):**
```bash
python db/seed/load_seed_data.py
```

**Step 4 — Render (backend):**
- Connect repo to Render; service config read from `render.yaml` automatically
- Set in Render dashboard (all marked `sync: false`): `DB_SECRET_ARN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `FRONTEND_URL` (set after step 5)

**Step 5 — Vercel (frontend):**
- Connect repo to Vercel; set root directory to `frontend_final`
- Build command: `npm run build` (runs `tsc && vite build`)
- Output directory: `dist`
- Set env var: `VITE_API_URL` = Render service URL
- **Replace placeholder** in `vercel.json` `env.VITE_API_URL` before first deploy or set via Vercel dashboard

**Step 6 — Update FRONTEND_URL on Render:**
After Vercel assigns a URL, set `FRONTEND_URL` on Render to that URL to enable CORS.

### Known Production Notes and Patches

| Problem | File | Line | Fix / Note |
|---|---|---|---|
| `VITE_API_URL` placeholder not replaced | `vercel.json:4` | Literal `"your-render-api-url-here"` — must be replaced before deploy; Vite bakes env at build time |
| Frontend fallback port is 8002, not 8000 | `src/api/client.ts:6` | Fallback is `http://localhost:8002`; if local API runs on 8000 all API calls fail silently |
| CORS allows `"*"` without `FRONTEND_URL` | `api/main.py:25–26` | If `FRONTEND_URL` env var unset, all origins allowed — insecure in production |
| RDS publicly accessible | `infra/cloudformation.yaml` | `PubliclyAccessible: true` — MVP shortcut; set to `false` for production |
| `DeletionProtection: false` on RDS | `infra/cloudformation.yaml` | Must be set to `true` before production |
| Dark-mode hardcoded colors patched to use CSS vars | `Agents.tsx:200,259,269` | Comments: `FIX: bg-background instead of bg-[#080D1A]`, `FIX: text-foreground instead of text-slate-300` — all patched |
| API guard for malformed evidence | `EvidenceGrid.tsx:174–183` | `isValidApiItem()` rejects themes with `|` or length > 120 — workaround for early pipeline returning raw quote-dump as theme |
| `api/app.py` vs `api/main.py` duplication | `api/app.py`, `api/main.py` | Two FastAPI entry points exist; `render.yaml` uses `main.py`; `app.py` is a legacy stub |

---

## 11. Strategic Decisions and Deviations

| Decision | Original Plan (CLAUDE.md) | What Was Actually Built | Reason for Change |
|---|---|---|---|
| PII Redaction | Amazon Comprehend for PII detection | Pure regex in `pii_redaction.py`; Comprehend never called | Simpler, zero API cost, no latency; regex covers the MVP PII surface |
| Staging promotion time window | "frequency > 10 in 7 days" (SQL comment in `005_create_staging.sql`) | `promote_staging_signals()` checks `frequency >= 10` only — no 7-day window in the code | Code does not implement the 7-day window mentioned in the migration comment |
| BEDROCK_LLM_MODEL env var default | `CLAUDE.md` specifies `anthropic.claude-3-sonnet-20240229-v1:0` | Test env uses `anthropic.claude-3-sonnet-20240229-v1:0`; actual `chat.py` and `agent.py` use `anthropic.claude-3-5-haiku-20241022-v1:0` | Haiku is cheaper and faster for the inference volume at MVP |
| Mock data model mismatch | Frontend should show live data | `MOCK_RECOMMENDATIONS.model_id = "anthropic.claude-3-haiku-20240307-v1:0"` differs from deployed model ID | Demo data was written before model was finalized |
| `output_schema.py` and `tools.py` | Documented in CLAUDE.md as containing output schema and ReAct tools | Both are placeholder files with no implemented code | Not yet needed for the basic ReAct loop in `agent.py` which handles these inline |
| `slack_digest.py` | CLAUDE.md lists Slack digest as an output | Placeholder file — no Slack messages sent | Not required for MVP; HTML report to S3 was sufficient |
| `reasoning/` Phase numbering | CLAUDE.md refers to Governance as "Phase 4 (Week 7)" | `governance/governance_lambda.py` header calls itself "Phase 5" | Minor numbering inconsistency; content is correct |

---

## 12. Real vs Demo Boundary

| Feature | Real or Mock | Notes |
|---|---|---|
| Evidence clusters (EvidenceGrid) | **Both** | Attempts `getEvidence()` on mount; replaces with live data only if `isValidApiItem()` passes; otherwise shows `EVIDENCE_DATA` (6 hardcoded clusters) |
| Dashboard stats (547, 6, 84%, 91%) | **Mock** | `TOTAL_FEEDBACK`, `EVIDENCE_CLUSTERS`, `AVG_CONFIDENCE`, `ANALYZED_PCT` are always hardcoded constants |
| Dashboard theme rankings | **Mock** | `VELOQUITY_THEMES` is always hardcoded; never replaced by API |
| Confidence distribution histogram | **Mock** | `CONFIDENCE_BUCKETS` is always hardcoded |
| Recommendations | **Both** | Attempts `getRecommendations()` but only used for context count in Chat; no page renders live recommendations except via API guard |
| Agent status (last run, total runs) | **Both** | Attempts `getAgentStatus()`; falls back to `MOCK_AGENTS` on error |
| Running an agent | **Real** | `POST /api/v1/agents/{name}/run` → boto3 `invoke()` → actual Lambda; if Lambda unavailable, error toast shown |
| Chat responses | **Both** | Attempts `POST /api/v1/chat/` → Bedrock Claude 3.5 Haiku; falls back to keyword-matched hardcoded responses on any error |
| Governance log / stats | **Real** | `getGovernanceLog()` / `getGovernanceStats()` exist in client but no frontend page currently renders them (routes exist, pages are UI-only stubs) |
| DataStudio feedback items | **Mock** | Always `MOCK_FEEDBACK` — 24 cards; no API call |
| Ingestion pipeline | **Real** | Lambda processes actual seed data via `pii_redaction → dedup → S3 write` |
| Embedding pipeline | **Real** | Lambda calls actual Bedrock Titan Embed V2; uses real RDS cache |
| Reasoning agent | **Real** | Lambda calls actual Bedrock Claude 3.5 Haiku; writes to real DB |
| Governance agent | **Real** | Lambda runs daily via EventBridge; reads/writes real DB |
| HTML reports | **Real** | Generated by `html_report.py`, uploaded to S3 |
| Slack digest | **Never** | `slack_digest.py` is a placeholder; no messages sent |

---

## 13. Gaps and Open Issues

| Gap | File | Severity |
|---|---|---|
| `reasoning/output_schema.py` is a placeholder | `reasoning/output_schema.py` | Medium — output schema enforced inline in `agent.py`; no reusable schema object |
| `reasoning/tools.py` is a placeholder | `reasoning/tools.py` | Medium — ReAct tools `get_evidence()`, `get_constraints()`, `get_source_lineage()` referenced in CLAUDE.md but not implemented; agent handles inline |
| `output/slack_digest.py` is a placeholder | `output/slack_digest.py` | Low — no Slack output needed for MVP |
| `tests/test_governance.py` is a placeholder | `tests/test_governance.py` | High — Governance Agent has zero test coverage |
| `tests/test_clustering.py` is a placeholder | `tests/test_clustering.py` | Medium — clustering covered partially in `test_embedding_pipeline.py` but no dedicated file |
| 7-day window for signal promotion not implemented | `governance/signal_promotion.py` vs `005_create_staging.sql:5` | Low — SQL comment says "frequency > 10 in 7 days"; code checks `frequency >= 10` only |
| Frontend fallback base URL is port 8002 not 8000 | `src/api/client.ts:6` | Low — local development mismatch; API default is 8000 |
| `MOCK_GOVERNANCE` event type `cache_rate_alert` not in DB schema | `src/api/mockData.ts:169` vs `006_create_governance_log.sql:11` | Low — DB CHECK constraint uses `cost_alert`; mock uses `cache_rate_alert`; they don't match |
| `MOCK_RECOMMENDATIONS.model_id` stale | `src/api/mockData.ts:63` | Low — uses `anthropic.claude-3-haiku-20240307-v1:0`; deployed model is `claude-3-5-haiku-20241022-v1:0` |
| `FRONTEND_URL` CORS defaults to `"*"` | `api/main.py:25–26` | High — unset env var allows all origins in production |
| RDS `PubliclyAccessible: true` | `infra/cloudformation.yaml` | High — must be changed before production |
| RDS `DeletionProtection: false` | `infra/cloudformation.yaml` | High — must be changed before production |
| `api/app.py` is a duplicate entry point | `api/app.py` | Low — orphaned; `render.yaml` uses `main.py` |
| Hash computed on text before or after redaction unclear | `ingestion/normalization.py` | Medium — tests mock `redact()`; actual order determines whether hash matches pre-PII or post-PII text (affects dedup correctness for PII-containing items) |
| No rate limiting or auth on API | `api/main.py` | High — all `/api/v1/*` endpoints are unauthenticated |
| `EvidenceGrid` API guard may permanently show mock data | `EvidenceGrid.tsx:174–183` | Medium — `isValidApiItem()` blocks themes with `|` or length > 120; early pipeline data may have failed this and the guard was never removed |

---

## 14. Deployment Checklist

| Step | Detail | Status |
|---|---|---|
| ☐ | Create S3 deploy bucket: `veloquity-deploy-dev-{account_id}` | Manual — AWS console or CLI |
| ☐ | Fill `infra/parameters.json` with VpcId, SubnetIds, DBPassword, SecurityGroupId, DeployBucket | Manual |
| ☐ | Run `bash infra/deploy.sh dev` | Automated — packages and deploys CloudFormation stack |
| ☐ | Verify CloudFormation stack `veloquity-dev` reaches `CREATE_COMPLETE` | AWS console |
| ☐ | Run 8 DB migrations in order (001–008) | Manual or via deploy.sh |
| ☐ | Verify pgvector extension installed: `SELECT extname FROM pg_extension` | psql |
| ☐ | Optionally load seed data: `python db/seed/load_seed_data.py` | Manual |
| ☐ | Connect repo to Render; verify `render.yaml` auto-detected | Render dashboard |
| ☐ | Set `DB_SECRET_ARN` in Render env vars | Render dashboard |
| ☐ | Set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` in Render env vars | Render dashboard |
| ☐ | Verify Render deploy succeeds; confirm `/health` returns `{"status":"ok","version":"1.0.0"}` | Browser |
| ☐ | Replace `"your-render-api-url-here"` in `vercel.json` with actual Render URL | Edit file + commit |
| ☐ | Connect repo to Vercel; set root directory to `frontend_final` | Vercel dashboard |
| ☐ | Set `VITE_API_URL` in Vercel env vars to Render URL | Vercel dashboard |
| ☐ | Verify Vercel build succeeds (`tsc && vite build`) | Vercel dashboard |
| ☐ | Set `FRONTEND_URL` on Render to the Vercel deployment URL | Render dashboard — required for CORS |
| ☐ | Redeploy Render service after `FRONTEND_URL` is set | Render dashboard |
| ☐ | Verify CORS: open browser console on Vercel URL, confirm API calls succeed | Browser devtools |
| ☐ | Set Lambda env vars (`BEDROCK_EMBED_MODEL`, `BEDROCK_LLM_MODEL`, `S3_RAW_BUCKET`, `REPORTS_BUCKET`, thresholds) | AWS Lambda console or CloudFormation parameters |
| ☐ | Run ingestion agent via UI: `POST /api/v1/agents/ingestion/run` | Veloquity Agents page |
| ☐ | Confirm S3 raw bucket has objects | AWS S3 console |
| ☐ | Run evidence agent via UI | Veloquity Agents page |
| ☐ | Confirm `evidence` table has rows with `status='active'` | psql |
| ☐ | Run reasoning agent via UI | Veloquity Agents page |
| ☐ | Confirm `reasoning_runs` table has a row; confirm S3 report uploaded | psql + AWS S3 console |
| ☐ | Verify EvidenceGrid page shows live data (passes `isValidApiItem()` guard) | Browser |
| ☐ | **Production hardening:** Set `PubliclyAccessible: false` on RDS | `infra/cloudformation.yaml` — redeploy |
| ☐ | **Production hardening:** Set `DeletionProtection: true` on RDS | `infra/cloudformation.yaml` — redeploy |
| ☐ | **Production hardening:** Add authentication to API endpoints | `api/main.py` — no auth exists |
| ☐ | **Production hardening:** Replace `FRONTEND_URL="*"` default with explicit domain check | `api/main.py:25–26` |

---

## Phase 3 — Demo Layer and Competition Improvements (April 2026)

### Upload Gate System
All pages show zero state with empty charts and zero counts until CSV files are uploaded on the Import Sources page. Once connected, the full dataset appears instantly across all pages simultaneously via `getActiveDataset()` context.

### Dual Mock Dataset System
Two complete datasets prove domain-agnostic architecture:

App Product Complaints (547 items, 6 clusters):
- App crashes on project switch: confidence 0.91, 94 users
- Black screen after latest update: confidence 0.87, 78 users
- Dashboard load regression: confidence 0.86, 71 users
- No onboarding checklist: confidence 0.81, 63 users
- Export to CSV silently fails: confidence 0.77, 54 users
- Notification delay on mobile: confidence 0.72, 48 users
- Sources: App Store Reviews 275 + Zendesk Tickets 272

Patient Hospital Survey (310 items, 4 clusters):
- Extended Emergency Wait Times: confidence 0.91, 87 users
- Online Appointment Booking Failures: confidence 0.84, 71 users
- Billing Statement Errors: confidence 0.78, 58 users
- Medical Records Portal Access Issues: confidence 0.72, 44 users
- Sources: Patient Portal Reviews 155 + Hospital Survey 155

### Evidence Drill-Down in Chat
InlineEvidence component appears below every assistant response. Shows 3 representative quotes by default, expands to 10, VIEW ALL ITEMS button opens EvidenceDrawer slide-in panel with official cluster item counts and colored source badges (green App Store, blue Zendesk, purple Patient Portal, orange Hospital Survey).

### Guided Recommendation Flow
When user asks how to overcome or fix a specific cluster, Chat detects the intent and asks three questions before calling Nova Pro: primary goal, engineering capacity, and constraints. The enriched context produces actionable recommendations instead of generic advice.

### Infrastructure Improvements
- Cold start fix: health check retry on Agents and Chat pages
- 404 fix: SPA rewrite rule in frontend_final/vercel.json
- Agent run state persists in localStorage with real timestamps
- Data Studio shows 100+ items per dataset with source badges
- All Claude and Haiku references replaced with Amazon Nova Pro
- Loading sequence: 16 seconds, 5 phases, no item count shown

### Key Metrics Added
- 158 automated tests, 0 failures, 0.72 second runtime
- Pipeline cost: $0.029 per full run on 547 items
- Annual cost estimate: $5 to $20 per year
- End-to-end pipeline: 91 seconds total
- Subsequent runs with cached embeddings: ~$0.013 per run
