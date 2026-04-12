# Veloquity — Architecture Overview

## 1. The Problem Veloquity Solves

Every software product, hospital system, or service operation generates a continuous stream of raw user feedback — app store reviews, support tickets, patient surveys, portal complaints, chat transcripts. At small scale, a product manager can read through these manually and develop an intuition for what matters. As the product grows, that stops being possible. A team managing a product with a million active users might receive ten thousand feedback items per month across four or five channels. Reading all of it is physically impossible. Triaging it manually is unreliable. The result is that most feedback is never acted on.

The deeper problem is not volume — it is signal extraction. Even when product managers have access to feedback dashboards, those tools typically surface raw counts and keyword frequencies. They can tell you that the word "crash" appeared 847 times last month, but they cannot tell you whether those 847 mentions represent one reproducible bug affecting 600 users, three distinct edge cases each affecting 200 users, or a wave of one-off complaints that resolved themselves. That distinction determines whether you should drop everything and hotfix today, schedule a sprint item next week, or deprioritize entirely. Making the wrong call has real consequences: shipping a fix for a phantom problem while a genuine regression goes unaddressed, or spending an engineering sprint on a "top complaint" that turns out to be fifty people venting about the same one-day outage.

Healthcare operations face an even more acute version of this problem. Patient feedback arrives through portals, discharge surveys, pharmacy complaints, and billing disputes. Each of these is structurally different, uses different language, and routes to different teams. A hospital quality team trying to understand whether emergency wait time complaints are worsening, stable, or recovering — and whether they reflect a systemic triage failure or a staffing shortage on specific shifts — cannot answer that question from raw survey data. They need the patterns extracted, confidence-scored, and presented with traceable evidence before they can make a resource allocation decision.

The core failure in both cases is the same: there is no system that automatically extracts semantically coherent patterns from heterogeneous raw feedback, scores confidence in those patterns mathematically, tracks their trajectory over time, and produces ranked, evidence-backed recommendations with source traceability. Most teams compensate with manual analysis, periodic reviews, and intuition. Veloquity is built to replace that process with a fully automated, auditable, domain-agnostic pipeline.

---

## 2. What Veloquity Is

Veloquity is an agentic evidence intelligence platform that automatically ingests raw feedback from multiple sources, extracts semantic patterns using AI embeddings, scores confidence mathematically using centroid variance rather than keyword frequency, and runs a structured reasoning agent to produce ranked, evidence-backed product or operational decisions. Every recommendation Veloquity produces traces back through confidence-scored evidence clusters to the individual raw feedback items that generated it — creating a full chain of custody from source signal to final decision. The governance layer monitors signal freshness and cost automatically, running daily without human intervention, and writes an append-only audit log of every action taken so that decisions are always reproducible and explainable.

---

## 3. How It Works — The Pipeline

```
Raw Feedback
     │
     ▼
┌─────────────────────┐
│  Ingestion Agent    │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│ Evidence Intel Agent│
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Reasoning Agent    │
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Governance Agent   │
└─────────────────────┘
     │
     ▼
  PM Decision
```

**Ingestion Agent**
Raw feedback items — app store reviews, support tickets, survey responses, portal complaints — are fed into the Ingestion Agent. Each item is normalised to a common schema, stripped of personally identifiable information using pattern-based redaction, and deduplicated using SHA-256 hashing so identical items never enter the pipeline twice. Valid, unique items are written to an S3 raw landing zone. This stage is the boundary between the outside world and the evidence system, and its job is to ensure only clean, unique, PII-free records proceed.

**Evidence Intelligence Agent**
Every ingested item is converted into a 1024-dimensional semantic vector using Amazon Titan Embed V2 — an AI model that represents the meaning of text as a point in high-dimensional space. Items that mean similar things end up near each other. The agent then applies a greedy cosine similarity algorithm to group these vectors into clusters: if a new item is semantically close enough to an existing cluster's centroid, it joins that cluster; otherwise it starts a new one. Each cluster receives a confidence score computed from the mathematical variance of member vectors around the centroid — tight clusters with consistent member vectors score near 100%; loose clusters with scattered members score lower. Scores below 40% are rejected; scores between 40–60% go to additional AI validation; scores above 60% are automatically accepted as evidence.

**Reasoning Agent**
Once evidence clusters exist, the Reasoning Agent scores each one on a composite priority formula that weighs confidence, unique user count, cross-source corroboration, and recency. It then invokes Amazon Nova Pro — a first-party AWS large language model — to reason over the scored clusters in a structured loop and produce ranked recommendations with specific actions, effort estimates, and tradeoff explanations. The output is not a summary; it is a prioritised action plan with every recommendation grounded in specific clusters and their underlying feedback items.

**Governance Agent**
Running daily via a scheduled cron trigger, the Governance Agent performs three maintenance tasks: it detects evidence clusters that have not received new signals in more than 30 days and flags them as potentially stale; it monitors low-confidence staging signals and promotes any that have accumulated enough frequency to be worth examining; and it checks the embedding cache hit rate to detect unexpected cost spikes. Every action is written to an append-only audit log — nothing is ever deleted from this log, making the system's behaviour fully reproducible and auditable.

**Product Manager Interface**
The frontend provides a conversational AI assistant backed by Nova Pro, a real-time pipeline dashboard showing all four agents, an evidence explorer for drilling into individual feedback items, a governance activity log, and a constraint editor. When the PM asks "how do I fix the crash cluster?", the system does not just answer — it first asks three context questions about goals, engineering capacity, and constraints, then uses those answers to produce a recommendation tailored to the specific situation.

---

## 4. What Makes It Different

**Mathematical confidence, not keyword counting**
Most feedback tools count how often a keyword appears. Veloquity measures how tightly a cluster of semantically similar items coheres around a shared centroid in embedding space. A cluster where 94 users describe the same specific crash in nearly identical terms scores 91% confidence. A cluster where 50 users use the word "slow" in 50 completely different contexts scores below the threshold and is rejected before it ever reaches the reasoning agent. This eliminates false positives that plague keyword-based systems.

**Full source-to-decision traceability**
Every evidence cluster is linked to every raw feedback item that contributed to it through a provenance table that preserves the origin source, timestamp, and content hash of each item. When Veloquity recommends fixing a bug, you can click through and read the exact App Store review from a specific user on a specific date that contributed to that recommendation. There is no black box between the data and the decision.

**ReAct reasoning loop, not single-shot prompting**
The Reasoning Agent does not simply ask a language model "here is my data, what should I do?" It orchestrates a structured ten-step pipeline: retrieve active evidence, compute priority scores, build a structured prompt, call the model, extract and validate the output, record token usage, and persist results. This produces consistent, structured, parseable output that can be compared across runs, rather than free-form text that varies based on prompt wording.

**Append-only governance audit log**
Every governance action — stale signal flagged, signal promoted, cost alert triggered — is recorded permanently and never deleted. This means any recommendation Veloquity made three months ago can be fully reconstructed: the evidence that existed at that time, the confidence scores, the governance state, and the exact reasoning run that produced it.

**$0.029 per full pipeline run**
The complete pipeline — ingest, embed, cluster, score, reason, govern — costs approximately $0.029 per run. Enterprise alternatives like Qualtrics charge $300,000+ per year for comparable functionality. The cost difference is roughly 10,000 times.

**Domain agnostic by design**
The pipeline contains no hardcoded product vocabulary, no domain-specific logic, and no assumptions about what kind of feedback it will receive. The same Lambda code that processes SaaS product crash reports processes hospital patient experience surveys without a single line change. This is verified: the two demonstration datasets — a software product and a hospital — produce fully coherent evidence clusters with accurate confidence scores using identical pipeline code.

---

## 5. Domain Applications

### Application 1 — Software Product Teams

**Dataset:** 547 feedback items across App Store Reviews (275) and Zendesk Tickets (272)

A software product team ingested six months of feedback after a significant release and discovered six evidence clusters:

1. **App crashes on project switch** (91% confidence, 94 users) — A null pointer in the project context handler introduced in v2.4 causes a reproducible crash when switching between projects. Corroborated across both App Store and Zendesk, which adds additional confidence. Highest-priority signal in the corpus.

2. **Black screen after latest update** (87% confidence, 78 users) — A cold-start async initialisation deadlock causes a black screen on first launch after device restart on both iOS and macOS. Warm restart resolves it, confirming an async race condition. Affects all new and returning users on first run.

3. **Dashboard load regression** (86% confidence, 71 users) — Load time regressed from 2 seconds to 12 seconds following a frontend render cycle change in v2.4, scaling with project count. Enterprise accounts with 50+ projects are completely blocked. P1 after the crash fix ships.

4. **No onboarding checklist** (81% confidence, 63 users) — New users report confusion during initial setup with no guided walkthrough. Trial-to-paid conversion is dropping. Signal is rising — the gap is getting worse as growth picks up.

5. **Export to CSV silently fails** (77% confidence, 54 users) — CSV export produces a 0-byte file with no error message for datasets over 5,000 rows or date ranges over 30 days. Primarily reported through Zendesk by enterprise accounts. Blocking renewal conversations.

6. **Notification delay on mobile** (72% confidence, 48 users) — Push notifications arrive 3–5 hours late on iOS and Android. Signal is stable, lower urgency than the crash and dashboard clusters.

The Reasoning Agent identified that clusters 1 and 2 share a likely root cause (the v2.4 release) and recommended a single targeted hotfix as a P0 action, with the dashboard regression and onboarding issues as P1 items for the following sprint.

### Application 2 — Healthcare and Hospital Operations

**Dataset:** 310 feedback items across Patient Portal Reviews (155) and Hospital Survey Tickets (155)

A hospital quality team ingested patient experience feedback and discovered four evidence clusters:

1. **Extended Emergency Wait Times** (91% confidence, 87 patients, rising trend) — Patients are reporting 4–6 hour waits in the emergency department with no staff communication during the wait. The app's displayed wait time is consistently inaccurate — showing 30 minutes when actual wait is 4+ hours. The signal is rising, indicating a worsening systemic problem, not an isolated incident. Triage delays affecting chest pain, fractures, and paediatric fevers all appear in the corpus.

2. **Online Appointment Booking Failures** (84% confidence, 71 patients) — The booking portal crashes on the confirmation screen. Double-bookings are occurring because availability sync is failing. No confirmation email is sent after booking, forcing patients to call the front desk to verify every appointment they make online. Session timeouts log patients out mid-booking and lose all entered insurance information.

3. **Billing Statement Errors and Confusion** (78% confidence, 58 patients) — Patients are receiving bills for services never rendered, being charged at inpatient rates for outpatient procedures, and finding duplicate charges for the same lab test. Insurance pre-authorisations on file are being ignored. Billing dispute resolution is taking 30+ days with no acknowledgement. Financial harm to patients and regulatory exposure to the hospital.

4. **Medical Records Portal Access Issues** (72% confidence, 44 patients, decreasing trend) — MyChart login failures are locking patients out through password reset loops. Test results are missing from the portal. The Android app crashes on launch. Medication lists show discontinued drugs as active. The signal is decreasing, suggesting an in-progress fix is partially working.

The same pipeline, the same code, the same confidence formula, the same reasoning agent — applied to an entirely different domain and producing coherent, actionable clinical operations insights.

### E-Commerce

An e-commerce platform could ingest product reviews, customer service chat transcripts, return reason codes, and post-purchase surveys. The pipeline would naturally cluster signals like checkout abandonment patterns, specific product quality failures, delivery experience issues, and sizing inaccuracy complaints — each with confidence scores reflecting how consistently customers describe the same experience. The Reasoning Agent would rank clusters by impact on repeat purchase rate and customer lifetime value, with traceability to the exact review that described a product defect.

### Financial Services

A retail bank or lending platform could process customer complaint logs, branch feedback forms, mobile app reviews, and NPS survey comments. Clusters would emerge around themes like fee confusion, transfer delay frustrations, mobile deposit failures, and loan process opacity. The governance layer would monitor for signals that spike after regulatory changes or product updates, providing the compliance and product teams with an auditable record of how customer sentiment evolved in response to specific business decisions.

### Hospitality

A hotel group or airline could ingest post-stay surveys, loyalty programme feedback, online travel agent reviews, and in-app ratings. The pipeline would cluster experiences like room maintenance issues, check-in friction, staff responsiveness, and amenity expectations versus reality — with confidence scores that distinguish a systemic facility problem at a specific property from scattered one-off complaints. The Reasoning Agent could prioritise by revenue impact, flagging clusters concentrated in high-value loyalty segments.

### Education

A university or online learning platform could process student satisfaction surveys, course evaluation forms, support ticket logs, and community forum posts. Evidence clusters would emerge around themes like content quality gaps, assessment clarity, technical accessibility issues, and support response times. The governance layer would flag signals that stagnate — topics students keep raising that are never being addressed — providing academic leadership with an evidence trail for curriculum investment decisions.

---

## 6. System Architecture Summary

```
┌─────────────────────────────────┐
│     FRONTEND                    │
│  React 18 · TypeScript · Vite   │
│  Deployed on Vercel             │
└─────────────────┬───────────────┘
                  │ HTTPS
                  ▼
┌─────────────────────────────────┐
│     BACKEND API                 │
│  FastAPI · Python 3.12          │
│  Deployed on Render             │
│  6 route modules · /api/v1      │
└─────────────────┬───────────────┘
                  │ AWS SDK
                  ▼
┌─────────────────────────────────────────────────────┐
│                  AWS CLOUD                          │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │ Lambda   │  │ Lambda   │  │  Amazon Bedrock  │  │
│  │Ingestion │  │Evidence  │  │  Nova Pro (LLM)  │  │
│  └──────────┘  └──────────┘  │  Titan Embed V2  │  │
│  ┌──────────┐  ┌──────────┐  └──────────────────┘  │
│  │ Lambda   │  │ Lambda   │                         │
│  │Reasoning │  │Governance│  ┌──────────────────┐  │
│  └──────────┘  └──────────┘  │  Amazon S3       │  │
│                               │  Raw feedback    │  │
│  ┌──────────────────────────┐ │  JSON store      │  │
│  │  RDS PostgreSQL 16       │ └──────────────────┘  │
│  │  pgvector · 1024-dim     │                       │
│  │  HNSW index · 8 tables   │ ┌──────────────────┐  │
│  └──────────────────────────┘ │  EventBridge     │  │
│                               │  Daily cron      │  │
│  ┌──────────────────────────┐ │  06:00 UTC       │  │
│  │  Secrets Manager         │ └──────────────────┘  │
│  │  DB credentials          │                       │
│  └──────────────────────────┘                       │
└─────────────────────────────────────────────────────┘
```

All AWS infrastructure is defined in a single CloudFormation template covering S3, RDS, four Lambda functions, EventBridge rules, IAM roles, Secrets Manager, and CloudWatch alarms. Deployment is a single script invocation.

---

## 7. Key Metrics

| Metric | Value |
|--------|-------|
| Test suite | 158 tests, 0 failures, 0.72s runtime |
| Full pipeline cost | $0.029 per run |
| Full pipeline runtime | 91 seconds total |
| Cost versus enterprise alternatives | ~10,000× cheaper than Qualtrics |
| Embedding dimensions | 1024-dim HNSW vectors (pgvector) |
| Database migrations | 8 SQL migrations |
| Lambda functions | 4 (ingestion, evidence, reasoning, governance) |
| Agent runtimes | Ingestion 18s · Evidence 34s · Reasoning 27s · Governance 12s |
| Confidence routing bands | Auto-reject < 0.40 · LLM-validate 0.40–0.60 · Auto-accept ≥ 0.60 |
| Clustering threshold | 0.75 cosine similarity |
| Stale signal threshold | 30 days without new signals |
| Signal promotion threshold | Frequency ≥ 10 staging occurrences |
| Test coverage | 5 test modules: ingestion, embedding, evidence_item_map, governance, reasoning |
