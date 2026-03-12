# CLAUDE.md — Veloquity

## What This Project Is

Veloquity is an Agentic Evidence Intelligence system built on AWS.
It ingests multi-source product feedback, extracts structured evidence
using LLM embeddings and semantic clustering, and surfaces prioritized,
constraint-aware signals to a human product team for planning decisions.

This is a functional MVP. Build what works. Do not over-engineer.

---

## MVP Goal

Prove the core loop end-to-end:
  ingest → deduplicate → embed → cluster → reason → human decision

---

## Architecture (8 Sections)

  Section 1  Feedback Sources         App Store Reviews + Zendesk (MVP: 2 sources only)
  Section 2  Ingestion Agent          Lambda + Comprehend PII + Normalization + SHA-256 dedup
  Section 3  Raw Storage              S3 append-only landing zone
  Section 4  Evidence Intelligence    Bedrock Titan Embed V2 + pgvector HNSW clustering
  Section 5  Evidence Memory          PostgreSQL + pgvector (single DB for everything)
  Section 6  Reasoning Agent          ReAct tool-calling LLM agent (Bedrock Claude Sonnet)
  Section 7  Human Interface          Slack digest or S3 HTML page
  Section 8  Governance Agent         Scheduled Lambda — stale detection, cost monitoring

Governance Agent has an ACTIVE feedback loop into Sections 2, 4, 5, and 6.
It is not a passive monitor. It writes back to the evidence store.

---

## Repository Structure

  veloquity/
  ├── CLAUDE.md                        ← You are here
  ├── README.md
  ├── .env.example                     ← Environment variable template
  ├── requirements.txt                 ← Shared Python dependencies
  │
  ├── infra/
  │   ├── cloudformation.yaml          ← Full AWS infrastructure stack
  │   ├── deploy.sh                    ← One-command deploy script
  │   └── parameters.json              ← CloudFormation parameter overrides
  │
  ├── db/
  │   ├── migrations/
  │   │   ├── 001_create_extensions.sql
  │   │   ├── 002_create_evidence.sql
  │   │   ├── 003_create_dedup.sql
  │   │   ├── 004_create_embedding_cache.sql
  │   │   ├── 005_create_staging.sql
  │   │   └── 006_create_governance_log.sql
  │   └── seed/
  │       ├── app_store_reviews.json   ← Test dataset (200-500 items)
  │       └── zendesk_tickets.json     ← Test dataset (200-500 items)
  │
  ├── ingestion/
  │   ├── lambda_handler.py            ← Lambda entry point (per source)
  │   ├── normalization.py             ← Flatten sources to common schema
  │   ├── deduplication.py             ← SHA-256 hash check + dedup table
  │   ├── pii_redaction.py             ← Comprehend wrapper
  │   └── s3_writer.py                 ← Write normalized JSON to S3
  │
  ├── evidence/
  │   ├── embedding_pipeline.py        ← Cache check → Bedrock → cache write
  │   ├── clustering.py                ← pgvector HNSW clustering logic
  │   ├── confidence.py                ← Centroid variance → confidence score
  │   ├── threshold.py                 ← Fixed threshold + LLM ambiguous validation
  │   └── evidence_writer.py           ← Write accepted clusters to evidence table
  │
  ├── reasoning/
  │   ├── agent.py                     ← ReAct loop — main agent entry point
  │   ├── tools.py                     ← get_evidence / get_constraints / get_source_lineage
  │   ├── constraints.json             ← Active constraint config (human-editable)
  │   └── output_schema.py             ← Structured JSON recommendation schema
  │
  ├── governance/
  │   ├── governance_lambda.py         ← Lambda entry point (EventBridge daily cron)
  │   ├── stale_detection.py           ← Flag evidence older than 30 days
  │   ├── signal_promotion.py          ← Promote staging clusters with frequency > 10
  │   ├── cost_monitor.py              ← Cache hit rate + Bedrock call tracking
  │   └── audit_log.py                 ← Write all actions to governance_log
  │
  ├── api/
  │   ├── app.py                       ← FastAPI application entry point
  │   ├── routes/
  │   │   ├── evidence.py              ← GET /evidence, GET /clusters
  │   │   ├── recommendations.py       ← GET /recommendations
  │   │   └── constraints.py           ← GET /constraints, POST /constraints
  │   └── db.py                        ← PostgreSQL connection pool
  │
  ├── output/
  │   ├── slack_digest.py              ← Format + send Slack digest
  │   └── html_report.py               ← Generate static HTML report → S3
  │
  └── tests/
      ├── test_ingestion.py
      ├── test_embedding_pipeline.py
      ├── test_clustering.py
      ├── test_reasoning_agent.py
      └── test_governance.py

---

## Key Technical Decisions

### Database
- Single PostgreSQL instance (RDS t3.medium) with pgvector extension.
- Replaces DynamoDB. Handles temporal queries, vector similarity, multi-condition filters.
- Tables: evidence, dedup_index, embedding_cache, low_confidence_staging, governance_log.
- NO DynamoDB. NO OpenSearch Serverless (saves $172/month floor cost).

### Embedding Cache
- PostgreSQL table: content_hash + model_version → vector.
- Cache key includes model_version so cache auto-invalidates on model change.
- No Redis for MVP. PostgreSQL lookup is fast enough at this volume.
- Expected 30–50% cache hit rate reduces Bedrock costs significantly.

### Clustering
- pgvector with HNSW index.
- Fixed thresholds for MVP: min cluster size = 5, min cosine similarity = 0.75.
- Confidence 0.0–0.4: auto-reject → staging table.
- Confidence 0.4–0.6: LLM validation call (ambiguous).
- Confidence 0.6–1.0: auto-accept → evidence table.

### Reasoning Agent
- ReAct-style tool-calling loop. NOT a single prompt call.
- Tools: get_evidence(), get_constraints(), get_source_lineage().
- Agent decides tool call order dynamically.
- LLM: Bedrock Claude Sonnet.
- Output: structured JSON (see output_schema.py).

### Governance
- Scheduled via EventBridge cron (daily).
- NOT an LLM agent. Decision-tree logic only.
- Has write access to evidence table (status updates).
- Active loop: triggers reprocessing, promotes signals, flags threshold drift.

### Temporal Decay
- Formula: decay_weight = exp(-lambda * days_since_last_validated)
- Lambda per source: Enterprise = 0.02, App Store = 0.05.
- Computed on READ (at query time in Reasoning Agent). No background job for MVP.

---

## Environment Variables

Copy .env.example to .env and fill in values.

  AWS_REGION                  AWS region (e.g. us-east-1)
  AWS_ACCOUNT_ID              Your AWS account ID
  S3_RAW_BUCKET               veloquity-raw-{env}
  DB_HOST                     RDS PostgreSQL endpoint
  DB_PORT                     5432
  DB_NAME                     veloquity
  DB_USER                     veloquity_user
  DB_PASSWORD                 (use Secrets Manager in prod)
  BEDROCK_EMBED_MODEL         amazon.titan-embed-text-v2:0
  BEDROCK_LLM_MODEL           anthropic.claude-3-sonnet-20240229-v1:0
  SLACK_WEBHOOK_URL           Incoming webhook URL
  EMBEDDING_CACHE_TTL_DAYS    30
  CONFIDENCE_AUTO_REJECT      0.4
  CONFIDENCE_AUTO_ACCEPT      0.6
  MIN_CLUSTER_SIZE            5
  MIN_COSINE_SIMILARITY       0.75
  STALE_SIGNAL_DAYS           30
  SIGNAL_PROMOTION_FREQ       10
  CACHE_HIT_RATE_ALERT        0.40

---

## AWS Services Used (MVP Only)

  AWS Lambda            Ingestion + Governance (event-driven, serverless)
  Amazon Comprehend     PII detection and redaction
  Amazon S3             Raw feedback storage + HTML report hosting
  Amazon Bedrock        Titan Embed V2 (embeddings) + Claude Sonnet (reasoning)
  Amazon RDS            PostgreSQL t3.medium with pgvector extension
  Amazon EventBridge    Daily cron trigger for Governance Agent
  AWS IAM               Least-privilege roles per Lambda function
  AWS Secrets Manager   DB credentials (do not hardcode)

NOT used in MVP (v2 only):
  OpenSearch Serverless ($172/month floor — replaced by pgvector)
  ElastiCache Redis     (replaced by PostgreSQL cache table)

---

## Deployment

  1. Fill in infra/parameters.json with your account values.
  2. Run: bash infra/deploy.sh
  3. CloudFormation creates all infrastructure in one stack.
  4. Run DB migrations: psql $DB_HOST -f db/migrations/*.sql (in order)
  5. Upload constraints.json to the reasoning Lambda environment.
  6. Load test data: python db/seed/load_seed_data.py

---

## Build Phases

  Phase 1 (Week 1–2)   Ingestion pipeline end-to-end. Data flows in clean and deduplicated.
  Phase 2 (Week 3–4)   Evidence extraction. Feedback clusters into themes with confidence scores.
  Phase 3 (Week 5–6)   Reasoning Agent. Produces ranked recommendations a PM can act on.
  Phase 4 (Week 7)     Governance loop. System self-maintains. Stale signals handled.

---

## What This MVP Proves

  1. Multi-source feedback ingests, deduplicates, and stores cleanly.
  2. Embeddings generate without redundant API calls (cache works).
  3. Semantic clustering groups real feedback into coherent themes.
  4. Reasoning Agent produces explainable, constraint-aware recommendations.
  5. Stale and emerging signals handled autonomously by Governance.
  6. A PM can read the output and make a planning decision.

---

## Rules for Claude Code

- Follow the repository structure exactly. Do not create files outside it.
- Each module has one responsibility. Do not mix concerns.
- All DB access goes through api/db.py connection pool.
- All environment variables come from os.environ. No hardcoded values ever.
- All Lambda handlers follow the pattern: handler(event, context) → dict.
- Write docstrings on every function. One-line minimum.
- When in doubt, refer to this file. The architecture does not change without updating CLAUDE.md first.
