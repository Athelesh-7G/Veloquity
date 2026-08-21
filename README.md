<div align="center">

![Veloquity Banner](https://capsule-render.vercel.app/api?type=waving&color=0:0f0c29,50:302b63,100:24243e&height=200&section=header&text=VELOQUITY&fontSize=70&fontColor=ffffff&animation=fadeIn&fontAlignY=35&desc=Agentic%20Evidence%20Intelligence%20%E2%80%94%20Raw%20Feedback%20to%20Evidence-Driven%20Decisions&descAlignY=55&descSize=18)

[![AWS APJC Regional Champion](https://img.shields.io/badge/AWS%2010%2C000%20AIdeas-APJC%20Regional%20Champion%20%F0%9F%8F%86-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](#recognition)
[![Demo Video](https://img.shields.io/badge/Demo%20Video-Watch%20on%20YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/wEG5jTQxlJ4?si=l1tH72icmjTMdh_H)
[![AWS Builder Center Article](https://img.shields.io/badge/Full%20Technical%20Write--up-AWS%20Builder%20Center-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://builder.aws.com/content/3AzrKpJbhJwEP6EZbm87vdxufgi/aideas-finalist-veloquity-the-agentic-evidence-intelligent-platform-turning-raw-feedback-into-evidence-driven-decisions)

<br/>

![Tests](https://img.shields.io/badge/tests-158%20passing-brightgreen?style=flat-square)
![Cost](https://img.shields.io/badge/pipeline%20cost-%240.029%2Frun-blue?style=flat-square)
![Runtime](https://img.shields.io/badge/end--to--end-91s-informational?style=flat-square)
![Agents](https://img.shields.io/badge/agentic%20pipeline-4%20stages-orange?style=flat-square)
![Domains](https://img.shields.io/badge/validated%20on-2%20domains-9cf?style=flat-square)

</div>

---

## International Recognition

<a name="recognition"></a>

Veloquity won the **Global AWS 10,000 AIdeas Competition 2026 - Asia Pacific & Japan (APJC) Regional Championship**, selected from 10,000+ teams across 115 countries.

- 🏆 **AWS APJC Regional Champion** — $15,000 prize support · $1,500 AWS credits · AWS re:Invent Las Vegas invitation
- 📰 Full technical write-up: [AWS Builder Center Article](https://builder.aws.com/content/3AzrKpJbhJwEP6EZbm87vdxufgi/aideas-finalist-veloquity-the-agentic-evidence-intelligent-platform-turning-raw-feedback-into-evidence-driven-decisions)
- 🎥 Demo video: [Watch on YouTube](https://youtu.be/wEG5jTQxlJ4?si=l1tH72icmjTMdh_H)
- 📰 Featured in **Business Today** alongside **Jeff Barr** *(VP & Chief Evangelist, AWS)*

---

## What Veloquity Does

Veloquity is a fully serverless & domain-agnostic multi agent evidence intelligence platform that transforms massive, fragmented customer feedback into prioritized, evidence-backed product decisions. Feedback enters through ingestion, gets embedded via Amazon Titan Embed V2, clustered with pgvector HNSW similarity search, scored by a mathematical confidence formula, and reasoned over by a Nova Pro ReAct loop — producing ranked recommendations that trace back to every original source item. 

Every recommendation links through confidence-scored clusters to individual raw feedback items via the `evidence_item_map` table, providing full source-to-decision traceability with an immutable governance audit log. The same pipeline processes SaaS product crash reports and hospital patient experience surveys without a single line of code changed.

---

## Why It Is Different

- **Mathematical confidence scoring** — cosine centroid variance, not keyword frequency; tight semantic clusters score near 100%, loosely-related mentions are rejected before reaching the reasoning agent
- **Source-to-decision traceability** — every recommendation traces through `evidence_item_map` to the exact raw feedback item, source system, timestamp, and S3 path that generated it
- **ReAct reasoning loop** — four-step pipeline: retrieve evidence → compute priority scores → build structured prompt → invoke Nova Pro; consistent, parseable, comparable output across every run
- **Append-only governance audit log** — every governance action is permanently recorded; any recommendation from any point in time is fully reproducible and auditable
- **$0.029 per full pipeline run** — embedding + reasoning + governance on 547 items; subsequent runs with cached embeddings cost ~$0.013
- **Domain-agnostic pipeline** — zero hardcoded product or domain vocabulary; same Lambda code runs on software product feedback and hospital patient surveys without modification

---

## Architecture

```
Raw Feedback
     │
     ▼
┌─────────────────────┐
│  Ingestion Agent    │  PII redaction · SHA-256 dedup · S3 write
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Evidence Intel Agent│  Titan Embed V2 · pgvector HNSW · confidence scoring
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Reasoning Agent    │  Priority formula · Nova Pro ReAct · ranked output
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Governance Agent   │  Stale detection · signal promotion · audit log
└─────────────────────┘
     │
     ▼
  PM Decision
```

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

Full pipeline: 91 seconds total · $0.029 per run

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

## Domain Applications

Veloquity is domain-agnostic. The same pipeline processes completely different kinds of feedback without code changes.

**Software Product Teams** — 547 items · 6 clusters · App Store Reviews + Support Tickets Tickets

Six evidence clusters identified: app crashes on project switch (91% conf, 94 users), black screen after latest update (87%, 78 users), dashboard load regression (86%, 71 users), no onboarding checklist (81%, 63 users), export to CSV silently fails (77%, 54 users), notification delay on mobile (72%, 48 users). The Reasoning Agent identified that clusters 1 and 2 share a root cause and recommended a single P0 hotfix.

**Healthcare and Hospital Operations** — 310 items · 4 clusters · Patient Portal + Hospital Survey

Four evidence clusters identified: extended emergency wait times (91% conf, 87 patients, rising trend), online appointment booking failures (84%, 71 patients), billing statement errors and confusion (78%, 58 patients), medical records portal access issues (72%, 44 patients, decreasing). Same pipeline, same confidence formula, same reasoning agent. Zero code changes.

Other applicable domains: **e-commerce** (product quality, checkout friction, returns) · **financial services** (fee disputes, mobile deposit failures, loan process) · **hospitality** (room maintenance, check-in friction, amenity expectations) · **education** (content quality, assessment clarity, support response time)

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

**Single default experience** — the V1 live-pipeline mode toggle was removed due to bugs and reliability issues.

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

**Lambda Cold Start Latency** — Evidence Lambda loaded a 254MB ML dependency stack (numpy/scipy/scikit-learn/hdbscan) at module init on every cold start. Fixed with lazy imports (loaded only when clustering runs), `is_warmup` guards on all 4 Lambda handlers, and 8 EventBridge keep-warm rules pinging every 5 minutes. `deploy.sh` now force-updates Lambda code after every CloudFormation deploy.

---

## AWS Services

| Service | Role in Veloquity |
|---|---|
| AWS Lambda | Hosts all four pipeline agents |
| Amazon Bedrock — Nova Pro | Reasoning and recommendation generation |
| Amazon Bedrock — Titan Embed V2 | 1024-dimensional semantic embeddings |
| Amazon RDS (PostgreSQL + pgvector) | HNSW vector search and relational storage |
| Amazon S3 | Feedback storage and reasoning run archival |
| Amazon EventBridge | Scheduled governance triggers |
| AWS IAM | Access control across all services |
| AWS Secrets Manager | Credential management — nothing hardcoded |

---

