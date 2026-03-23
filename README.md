# Veloquity
### Agentic Evidence Intelligence for Product Teams

Veloquity turns thousands of raw customer reviews and support tickets into prioritised, evidence-backed product recommendations — automatically. It ingests feedback from App Store and Zendesk, clusters it semantically using AI embeddings, scores each cluster for urgency and impact, and runs a reasoning agent that produces ranked recommendations a PM can act on immediately. No manual tagging, no spreadsheet archaeology, no guesswork.

---

## How It Works

```
Raw Feedback → Ingestion Agent → Evidence Intelligence → Reasoning Agent → Governance Agent → Product Decisions
```

| Stage | What happens |
|---|---|
| **Ingestion** | Normalise, PII-redact, SHA-256 deduplicate, write to S3. |
| **Evidence Intelligence** | Embed via Titan V2, cluster by cosine similarity, score confidence. |
| **Reasoning** | Score by impact + recency + corroboration, prompt Nova Pro, return ranked recommendations. |
| **Governance** | Flag stale evidence, promote low-confidence signals, monitor cost. |

---

## Architecture

| Component | Purpose |
|---|---|
| React Frontend (Vercel) | Dashboard, evidence grid, agent controls, chat interface |
| FastAPI Backend (Render) | REST API bridge between frontend and AWS services |
| Ingestion Lambda | Normalise, deduplicate, and store raw feedback from any source |
| Evidence Intelligence Lambda | Embed text, cluster semantically, route by confidence threshold |
| Reasoning Lambda (Nova Pro) | Score clusters, build prompt, generate prioritised recommendations |
| Governance Lambda (EventBridge daily) | Stale detection, signal promotion, cost monitoring, audit log |
| PostgreSQL + pgvector (RDS) | Stores evidence clusters, embeddings, reasoning runs, and audit trail |
| Titan Embed V2 (Bedrock) | 1024-dimension text embeddings for semantic clustering |
| S3 | Immutable raw feedback store and reasoning report archive |
| Secrets Manager | Runtime credential injection — no passwords in code or config |

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS, Radix UI, Framer Motion, Recharts |
| **Backend** | FastAPI 0.115, Python 3.12, psycopg2, boto3, Pydantic v2 |
| **AI / ML** | Amazon Nova Pro (reasoning), Titan Embed V2 (embeddings), pgvector (HNSW index), cosine similarity clustering |
| **Infrastructure** | AWS Lambda, RDS PostgreSQL 16, S3, EventBridge, CloudFormation, Secrets Manager, IAM |
| **Deployment** | Vercel (frontend), Render (backend), deploy.sh → CloudFormation (AWS agents + DB) |

---

## Repository Structure

```
veloquity/
├── api/              # FastAPI app — routes, DB pool, Pydantic schemas, dependencies
│   └── routes/       # Six endpoint groups: evidence, recommendations, agents, chat, governance, constraints
├── evidence/         # Phase 2 Lambda — embed, cluster, confidence score, threshold routing
├── ingestion/        # Phase 1 Lambda — normalise, PII-redact, deduplicate, write to S3
├── reasoning/        # ReAct agent logic — scorer, retriever, prompt builder, output writer
├── lambda_reasoning/ # Lambda entry point that wraps reasoning/ for AWS invocation
├── governance/       # Phase 5 Lambda — stale detection, signal promotion, cost monitor, audit log
├── output/           # HTML report generator (S3-hosted) and Slack digest placeholder
├── db/
│   ├── migrations/   # 8 SQL files — extensions → evidence → dedup → cache → staging → governance → runs → provenance
│   └── seed/         # Sample App Store reviews and Zendesk tickets for local testing
├── infra/
│   ├── cloudformation.yaml  # Full AWS stack — 4 Lambdas, RDS, S3, EventBridge, IAM, Secrets Manager
│   ├── deploy.sh            # One-command deploy: package → upload → validate → CloudFormation → migrate
│   └── parameters.json      # Per-environment CloudFormation parameter overrides
├── frontend_final/   # React SPA (deployed to Vercel) — active frontend
├── tests/            # 158 automated tests across ingestion, evidence, and reasoning phases
└── .build/           # Compiled Lambda zip artifacts (regenerated on each deploy)
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| pgvector over Pinecone | One database, one backup, sufficient scale for this workload |
| Regex PII over Amazon Comprehend | No API cost, no latency, no external dependency |
| Nova Pro as reasoning LLM | Direct Bedrock access; no AWS Marketplace payment instrument required |
| Reasoning Lambda outside VPC | Needs direct internet access to reach Bedrock and S3 |
| Confidence thresholds at 0.4 / 0.6 | Three bands: auto-reject, LLM-validate, auto-accept |
| SHA-256 deduplication | O(1) duplicate detection across millions of items |
| Append-only governance log | Historical integrity — deleted rows cannot be recovered or trusted |

---

## Live Demo

**[veloquity.vercel.app](https://veloquity.vercel.app)**

Opens to a working dashboard with evidence clusters, confidence visualisations, agent pipeline controls, and a context-aware AI chat assistant — all grounded in real reasoning output.

---

## Setup

Full deployment requires AWS credentials, an RDS instance, and Bedrock model access. See [CLAUDE.md](CLAUDE.md) for complete environment variable reference and step-by-step deployment instructions.

---

## What's Next

- **Slack digest** — `output/slack_digest.py` is a placeholder; the EventBridge trigger and webhook config exist but the send logic is not implemented
- **Zendesk live connector** — ingestion normalises Zendesk schema but there is no polling/webhook integration yet; data is batch-loaded manually
- **Staging promotion window** — the SQL comment in migration 005 references a 7-day window; the promotion logic uses frequency count only with no time gate implemented
- **VPC + private RDS** — `PubliclyAccessible: true` is set for dev convenience; production hardening requires VPC endpoints and private subnet routing for Lambda→RDS access
