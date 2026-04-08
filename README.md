<div align="center">

# Veloquity

### Agentic Evidence Intelligence — Raw Feedback to Evidence-Driven Decisions

[Live Demo](https://veloquity.vercel.app) · [AWS Bedrock](https://aws.amazon.com/bedrock/) · [Nova Pro](https://aws.amazon.com/bedrock/nova/)

![Tests](https://img.shields.io/badge/tests-158%20passing-brightgreen)
![Cost](https://img.shields.io/badge/pipeline%20cost-%240.029%2Frun-blue)
![Lambda](https://img.shields.io/badge/AWS%20Lambda-4%20agents-orange)
![pgvector](https://img.shields.io/badge/pgvector-1024--dim%20HNSW-purple)

</div>

---

## What Veloquity Does

Veloquity is a fully serverless agentic pipeline that transforms raw user feedback into prioritized, evidence-backed product decisions. Feedback enters through ingestion, gets embedded via Amazon Titan, clustered with pgvector HNSW similarity search, scored by a mathematical confidence formula, and reasoned over by a Nova Pro ReAct loop — producing ranked recommendations that trace back to every original source item.

---

## Why It Is Different

Existing tools like Zendesk, Qualtrics, and UserVoice produce dashboards. Veloquity produces evidence. Every recommendation links through confidence-scored clusters back to individual raw feedback items via the evidence_item_map table — full source-to-decision traceability with an immutable governance audit log. The confidence score is mathematical (cosine centroid variance, not keyword frequency), the reasoning is a four-step ReAct loop (not a single prompt), and the entire pipeline is domain-agnostic — the same Lambda code processes SaaS product complaints and hospital patient surveys without modification. Full pipeline cost is $0.029 per run, roughly 10,000 times cheaper than enterprise alternatives.

---

## Architecture
```
┌──────────────────────────────────────────────────────────────┐
│                     VELOQUITY PIPELINE                       │
├─────────────┬─────────────┬──────────────┬───────────────────┤
│ Ingestion   │ Evidence    │ Reasoning    │ Governance        │
│ Lambda      │ Lambda      │ Lambda       │ Lambda            │
│             │             │              │                   │
│ PII strip   │ Titan       │ Nova Pro     │ Stale detection   │
│ SHA-256     │ Embed V2    │ ReAct loop   │ Signal promotion  │
│ dedup       │ pgvector    │ Priority     │ Audit log         │
│ S3 write    │ HNSW        │ scoring      │ EventBridge daily │
└─────────────┴─────────────┴──────────────┴───────────────────┘
        ↕                          ↕
RDS PostgreSQL              Amazon S3
pgvector 1024-dim           Raw feedback
8 SQL migrations            JSON store
        ↕
FastAPI on Render
        ↕
React on Vercel
```

---

## Agent Pipeline

| Agent | Trigger | Key Technology | Avg Runtime |
|-------|---------|---------------|-------------|
| Ingestion | Manual or CSV upload | SHA-256 dedup, PII regex, S3 | 18s |
| Evidence Intelligence | Post-ingestion | Titan Embed V2, HNSW clustering, confidence scoring | 34s |
| Reasoning | Post-evidence | Nova Pro, ReAct loop, priority formula | 27s |
| Governance | EventBridge daily | Stale detection, signal promotion, audit log | 12s |
| Chat | Real-time | Nova Pro, evidence context, guided recommendation flow | under 3s |

Full pipeline: 91 seconds total · $0.029 per run · 10,000x cheaper than Qualtrics

---

## Confidence Scoring
```
distance_i = 1 - cosine_similarity(item_vector, centroid)
variance   = mean(distance_i for all cluster members)
confidence = clamp(1.0 - variance x 2.0, 0.0, 1.0)
```
Routing bands:
```
score < 0.40  →  auto-reject  (no LLM cost)
score < 0.60  →  LLM validation via Nova Pro
score >= 0.60 →  auto-accept
```

---

## Priority Scoring
```
priority = confidence x 0.35
         + users x 0.25
         + corroboration x 0.20
         + recency x 0.20

corroboration_bonus = +0.10 if sources > 1
user_score          = min(unique_users / 50, 1.0)
recency_score       = max(0, 1 - days_since_validated / 90)
```

---

## Tech Stack

**Backend and Infrastructure**

Python · FastAPI · PostgreSQL 16 + pgvector · AWS Lambda x4 · Amazon Bedrock Nova Pro · Amazon Titan Embed V2 · S3 · EventBridge · CloudFormation · Secrets Manager · IAM · Render

**Frontend**

React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Recharts · Radix UI · Vercel

---

## Project Structure
```
veloquity/
├── api/              FastAPI backend, 5 route modules
├── ingestion/        Ingestion Lambda, PII strip, dedup, S3
├── evidence/         Evidence Lambda, embeddings, clustering
├── reasoning/        Reasoning Lambda, ReAct loop, Nova Pro
├── governance/       Governance Lambda, daily maintenance
├── lambda_reasoning/ Lambda entry point wrapper
├── frontend_final/   React frontend, 10 pages
├── db/migrations/    8 SQL migrations, pgvector schema
├── infra/            CloudFormation and deploy scripts
└── tests/            158 automated tests, 0.72s runtime
```

---

## Key Design Decisions

**pgvector over Pinecone** — collocated with relational data, zero extra service, HNSW at 1024 dimensions stays sub-10ms to 100K vectors

**Nova Pro over Claude** — AISPL accounts cannot access Anthropic models on Bedrock; Nova Pro is first-party AWS and available universally

**Regex PII over Comprehend** — deterministic, zero latency, zero cost, sufficient for email, phone, and name patterns at this scale

**Append-only governance log** — immutable audit trail means recommendations are traceable across time with no delete risk

**Embedding cache** — re-runs on unchanged corpus cost near zero; cache hit rate monitored with configurable alert threshold

**Domain-agnostic pipeline** — zero hardcoded product or domain vocabulary; same Lambda code handles SaaS feedback and hospital patient surveys

---

## Validation
```
158 automated tests · 0 failures · 0.72s runtime

Test modules:
test_ingestion.py          33 tests  PII, dedup, normalization, S3, handler
test_embedding_pipeline.py 33 tests  Bedrock cache, clustering, confidence, routing
test_evidence_item_map.py  39 tests  S3 keys, lineage, quotes, write operations
test_governance.py         25 tests  Audit log, stale detection, promotion, cost monitor
test_reasoning_agent.py    28 tests  Fetch, priority scoring, prompt, write, full run

Zero AWS or DB calls in test suite — fully mocked
```

---

## Real Failure Modes Encountered and Fixed

Every production failure below was real, encountered during build, and resolved:

**AISPL Payment Restriction** — Anthropic Claude models unavailable for Indian AWS accounts. Switched entire pipeline to Amazon Nova Pro with updated request format (inferenceConfig, system as list, content as list).

**VPC Blocking Bedrock** — Lambda inside VPC could not reach Bedrock API without NAT or VPC endpoint. Removed VpcConfig from Evidence Lambda; RDS uses public endpoint for MVP.

**Lambda Handler Mismatch** — Handler path in CloudFormation pointed to wrong function. Corrected to evidence.embedding_pipeline.handler.

**Missing python-multipart** — FastAPI file upload returned HTTP 422 silently. Added to requirements.txt.

---

## Live Demo

[veloquity.vercel.app](https://veloquity.vercel.app)

Upload App Store or Zendesk feedback and watch the full pipeline run. Explore evidence clusters, get AI recommendations with source traceability, and drill down to individual feedback items from the chat interface.

Switch to Patient Portal and Hospital Survey data to see the same pipeline process a completely different domain with zero code changes.
