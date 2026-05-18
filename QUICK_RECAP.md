# Veloquity — Quick Recap (Personal Cheat Sheet)

---

## 1. Project State

| Component | Status |
|-----------|--------|
| **Frontend** | Deployed to Vercel · active SPA is `frontend_final/` · `frontend/` is legacy |
| **Backend** | FastAPI on Render · entry point `api/main.py` · port via `$PORT` env var |
| **Database** | PostgreSQL 16 + pgvector on AWS RDS (`db.t3.medium`) · 8 migrations applied |
| **Lambdas** | 4 deployed: `veloquity-ingestion-dev`, `veloquity-evidence-dev`, `veloquity-reasoning-dev`, `veloquity-governance-dev` |
| **AI Models** | Amazon Nova Pro (`us.amazon.nova-pro-v1:0`) for reasoning + chat · Titan Embed V2 (`amazon.titan-embed-text-v2:0`) for embeddings |
| **Live Demo** | https://veloquity1.vercel.app |

---

## 2. Active Features

- **Dual mock dataset system** — `app_product` (547 items, 6 clusters) and `hospital_survey` (310 items, 4 clusters) · toggled by `localStorage['veloquity_uploaded_sources']` via `getActiveDataset()`
- **Upload gate** — `hasUploadedData()` blocks all AI features until at least one source is uploaded; `NO_DATA_RESPONSE` returned if gate fails
- **Guided 3-question recommendation flow** — 24 `TRIGGER_WORDS` (fix, solve, how do i, help me, strategy for, etc.) gate intercept; shows 3 context questions; enriched prompt sent to Nova Pro; realistic 1800–3200ms loading delay
- **Evidence drill-down** — `InlineEvidence` component shows per-cluster quotes inline; `EvidenceDrawer` shows all items with source labels; `VIEW ALL {N} ITEMS →` button
- **Dataset-aware system context to Nova Pro** — `APP_PRODUCT_CONTEXT` vs `HOSPITAL_CONTEXT` sent as `system` field in every chat request; backend uses it via `ChatRequest.system`
- **Cold start health check** — up to 8 retries at 1.5s intervals with 2.5s timeout; `sessionStorage['veloquity_health_ready']` caches success across page navigation
- **Optimistic UI unlock** — input enabled after 4s of retrying with placeholder "AI engine warming up — message will send when ready"; queued message auto-sends when health resolves
- **Dataset-aware starter questions** — `APP_STARTERS` vs `HOSPITAL_STARTERS` shown on Chat empty state
- **Per-cluster fallback responses** — 16-key `FALLBACK_RESPONSES` map covers all 10 clusters (6 app + 4 hospital) plus governance/stale/sprint questions for both datasets; returned when Nova Pro is unreachable
- **Query-first cluster detection** — `detectClusters()` scans query text first; only falls back to response text if query produces zero keyword matches
- **Ordinal cluster detection** — `detectOrdinalCluster()` maps "first", "2nd", "#3", "number 4" etc. to cluster by index position
- **Agent run state persistence** — `localStorage['veloquity_agent_run_state']` via `agentRunState.ts`; Agents page pre-populates run status from stored state on mount
- **Warming banner delayed** — amber "Waking up" banner only shown from health attempt 3 onward; first two pings are silent

---

## 3. Changes Made (Chronological)

### Evidence Drill-Down Reliability
- **Problem:** `detectClusters()` scanned response text broadly, causing false keyword matches from AI's wordy explanations
- **Fix:** Query-first scan — scans query only; falls back to response text only if query produces zero matches
- **Added:** `showEvidence` flag on `Message` interface to gate drill-down display separately from cluster detection
- **Added:** Per-cluster fallback responses for all 10 clusters (6 app + 4 hospital) in `FALLBACK_RESPONSES` map
- **Removed:** Slice cap that was limiting `detectClusters` to 2 results (now returns all matches)

### Hospital Mock State — Dataset Awareness
- **Problem:** Hospital mode was sending `APP_PRODUCT_CONTEXT` to Nova Pro because `getActiveDataset()` wasn't being used consistently
- **Problem:** `HOSPITAL_CLUSTERS` names didn't match `HOSPITAL_MOCK_DATA` theme strings — evidence drawer returned 0 items
- **Fix:** `systemContext` derived from `dataset` variable at component top; passed as `system` param to every `sendChatMessage` call
- **Added:** `HOSPITAL_STARTERS`, `HOSPITAL_CLUSTERS`, `HOSPITAL_KEYWORD_MAP`, `HOSPITAL_CONTEXT` system prompt
- **Added:** `'hospital stale signals'` and `'hospital governance flag'` entries in `FALLBACK_RESPONSES`
- **Added:** `getSmartFallback()` routes to hospital fallbacks when `dataset === 'hospital_survey'`

### Backend — System Context Support
- **Problem:** `ChatRequest` schema in `api/schemas.py` had no `system` field — Pydantic silently dropped it; backend always used DB-built system prompt (app product context) regardless of what frontend sent
- **Fix:** Added `system: str | None = None` to `ChatRequest` in `api/schemas.py`
- **Fix:** Added `if request.system:` branch in `api/routes/chat.py` — uses frontend-provided system context directly when present, otherwise falls back to `_build_system_prompt()` from DB

### Guided Recommendation Flow
- **Problem:** Inner `if (clusters.length > 0)` guard inside the guided flow block caused queries like "how do I fix the first cluster" to fall through to Nova Pro directly when no keyword matched
- **Fix:** `hasGuidedTrigger` is now the sole gate — inner guard removed; flow always intercepts if TRIGGER_WORDS match
- **Added:** `detectOrdinalCluster()` — maps ordinal words (first/1st/#1/number 1) and numbers (second/2nd/#2) to clusters by array index, up to sixth/6th
- **Expanded:** `TRIGGER_WORDS` from ~10 to 24 phrases: added `overcome`, `tackle`, `handle`, `what should i do`, `what can i do`, `what do i do`, `steps to`, `ways to`, `approach to`, `plan for`, `strategy for`, `recommendation for`, `suggestions for`, `advice on`
- **Added:** Realistic 1800–3200ms loading delay with progressive status labels ("Querying evidence clusters…" → "Nova Pro is analyzing your question…")
- **Strengthened:** Nova Pro formatting instruction — explicitly bans `#` headers, `##` headers, `###` headers, `**` bold, `*` bullets, `_` italic, `-` list markers at line start; permits plain numbered lists and dash in prose only

### Cold Start Reduction (Both Pages)
- **Changed:** Retry interval `3000ms → 1500ms` · max attempts `10 → 8` · total max wait `30s → 12s`
- **Changed:** Per-request timeout `4000ms → 2500ms` (Chat: `AbortSignal.timeout(2500)` · Agents: `checkHealth(2500)` via new optional param)
- **Added:** `sessionStorage['veloquity_health_ready']` — written on success, checked on mount, skips retry loop entirely if set
- **Added:** `optimisticReady` state — flips true after 4s; unlocks input with "warming up" placeholder
- **Added:** `pendingMessage` ref + `sendRef` ref — queues message if `optimisticReady && !healthReady`; auto-sends via `sendRef.current` when `healthReady` flips true
- **Changed:** Warming banner only shown when `healthAttempt >= 3` (was `healthAttempt <= 1` showing from first attempt)
- **Changed:** `checkHealth()` in `client.ts` now accepts `timeoutMs = 5000` optional parameter
- **Changed:** Failed state copy "10 attempts" → "8 attempts" on both pages

---

## 4. Known Limitations

| Area | Limitation |
|------|------------|
| **Mock data** | All "uploaded" sources are mock — no real ingestion runs; `addUploadedSource()` writes to localStorage only; row counts are hardcoded in `uploadState.ts` |
| **Timestamps** | `FALLBACK_RESPONSES` governance dates are hardcoded to `2026-03-10`; agent run timestamps in mockData are hardcoded |
| **Agent durations** | `agentRunState.ts` hardcodes agent durations: ingestion 18s, evidence 34s, reasoning 27s, governance 12s |
| **State persistence** | Upload state and agent run state live in localStorage — cleared on browser data wipe, not server-side |
| **Cold starts** | Render free tier sleeps after 15 min inactivity; first request takes 15–30s even with the 12s retry budget |
| **No auth** | All API endpoints under `/api/v1` are publicly accessible — no authentication or rate limiting |
| **RDS exposure** | RDS instance uses public endpoint (not inside a VPC) — acceptable for MVP, must change for production |
| **sessionStorage TTL** | `veloquity_health_ready` is not cleared if the backend goes down after a successful health check — page revisit within the same session would skip the retry loop and fail silently on first API call |
| **MOCK_EVIDENCE clusters** | `MOCK_EVIDENCE` in mockData.ts (4 clusters) does not match the Chat page's `APP_CLUSTERS` (6 clusters) — they are different data structures used for different components |
| **Nova Pro fallback** | If Bedrock is unavailable, the backend returns a hardcoded fallback string; the frontend also has its own `FALLBACK_RESPONSES` map — two independent fallback layers with no coordination |

---

## 5. Key Files Map

| File | What It Does |
|------|-------------|
| `frontend_final/src/pages/Chat.tsx` | Entire chat UI: conversation state, guided 3-question flow, evidence drill-down, health check, dataset routing, fallback logic, keyword detection, optimistic unlock |
| `frontend_final/src/api/mockData.ts` | All mock arrays: `APP_PRODUCT_ITEMS`, `HOSPITAL_ITEMS`, `MOCK_EVIDENCE`, `HOSPITAL_MOCK_DATA`, recommendations, agents, governance events for both datasets |
| `frontend_final/src/utils/uploadState.ts` | localStorage gate: `hasUploadedData()`, `getActiveDataset()`, `addUploadedSource()`, `removeUploadedSource()`, `clearAll()` |
| `frontend_final/src/utils/agentRunState.ts` | localStorage persistence for agent run status: `getAgentRunState()`, `setAgentsDone()`, `hasAgentsRun()` |
| `api/main.py` | FastAPI app entry point: CORS config, route registration for all 6 modules, `/health` endpoint, global exception handler |
| `api/routes/chat.py` | Chat endpoint: fetches live evidence/recommendations/governance from DB, builds system prompt, calls Nova Pro via Bedrock, handles `request.system` override from frontend |
| `api/schemas.py` | All Pydantic request/response models: `ChatRequest` (with `system: str | None`), `ChatResponse`, `EvidenceItem`, `ReasoningRun`, `GovernanceEvent`, etc. |
| `reasoning/agent.py` | 10-step ReAct orchestration: fetch evidence → score → build prompt → call Nova Pro → extract text → parse JSON → record token usage → prepare payload → persist results → return |
| `evidence/clustering.py` | Pure Python greedy cosine clustering — no numpy; O(N×C) single-pass; running mean centroid update; `MIN_COSINE_SIMILARITY` and `MIN_CLUSTER_SIZE` from env vars |
| `infra/cloudformation.yaml` | Complete AWS stack definition: S3, RDS, 4 Lambda functions, EventBridge rules, IAM roles, Secrets Manager, CloudWatch alarms |
| `db/migrations/` | 8 SQL files in order: `001` pgvector extension + uuid-ossp → `002` evidence table (pgvector 1024-dim HNSW) → `003` dedup_index → `004` embedding_cache → `005` staging → `006` governance_log → `007` reasoning_runs → `008` evidence_item_map (UNIQUE(evidence_id, dedup_hash)) |

---

## 6. Environment Variables Quick Reference

| Variable | What Breaks If Missing |
|----------|----------------------|
| `DB_SECRET_ARN` | API cannot connect to database — all DB queries fail; 500 on every data endpoint |
| `AWS_REGION_NAME` | Bedrock, Lambda, S3, Secrets Manager calls fail; defaults to `us-east-1` if unset |
| `AWS_ACCESS_KEY_ID` | All AWS SDK calls fail (Bedrock embeddings, Lambda invocations, S3 reads/writes, Secrets Manager) |
| `AWS_SECRET_ACCESS_KEY` | Same as above — SDK authentication fails entirely |
| `FRONTEND_URL` | CORS blocks all frontend requests; defaults to `*` (allow all) if unset |
| `VITE_API_URL` | Frontend points to `localhost:8002`; all API calls fail in production Vercel deployment |
| `SLACK_WEBHOOK_URL` | Slack digest output silently skipped; optional — no other breakage |
| `REASONING_LAMBDA_NAME` | `/api/v1/agents/reasoning/run` returns 500; on-demand reasoning runs fail |
| `BEDROCK_EMBED_MODEL` | Embedding pipeline defaults to `amazon.titan-embed-text-v2:0`; unset is safe |
| `BEDROCK_LLM_MODEL` | Reasoning agent defaults to `us.amazon.nova-pro-v1:0`; unset is safe |
| `S3_RAW_BUCKET` | Ingestion Lambda cannot write to S3; all ingestion fails at S3 write step |
| `REPORT_BUCKET` | HTML report generation silently fails; governance still runs |
| `EMBEDDING_CACHE_TTL_DAYS` | Embedding cache never expires; cold runs keep growing the cache table |
| `CONFIDENCE_AUTO_REJECT` | Defaults to `0.4` — below this score clusters go to staging |
| `CONFIDENCE_AUTO_ACCEPT` | Defaults to `0.6` — above this score clusters auto-accept to evidence |
| `MIN_CLUSTER_SIZE` | Defaults to `5` — clusters smaller than this are discarded |
| `MIN_COSINE_SIMILARITY` | Defaults to `0.75` — items below this similarity floor start new clusters |
| `STALE_SIGNAL_DAYS` | Defaults to `30` — evidence older than this is flagged stale by governance |
| `SIGNAL_PROMOTION_FREQ` | Defaults to `10` — staging signals reaching this frequency get promoted |
| `CACHE_HIT_RATE_ALERT` | Defaults to `0.40` — embedding cache hit rate below this triggers a cost alert |

---

## 7. Demo Script — 2-Minute Version

**Setup:** Have https://veloquity1.vercel.app open in a browser. Have two CSV files ready (or use the Upload page's "Add" buttons directly).

**Step 1 — Land on the app**
Open https://veloquity1.vercel.app. You'll see the dashboard with all evidence clusters and the pipeline status. Nothing in Chat or Agents works yet — locked behind the upload gate.

**Step 2 — Upload app product data**
Go to Import Sources. Add App Store Reviews + Support Tickets Tickets. Watch the sources appear with item counts (275, 272). The entire app unlocks — clusters populate, agents show run history, chat activates.

**Step 3 — First chat query**
Go to Chat. Ask: "What are the top 3 evidence clusters right now?"
Show the ranked response with confidence scores, user counts, and source attribution. Point out context tags showing what the AI used.

**Step 4 — Guided recommendation flow**
Ask: "How can I fix the first cluster issue?"
Show the 3-question prompt asking about goal, engineering capacity, and constraints. Answer them: "Reduce churn · 2 engineers for 1 sprint · must ship by end of month." Watch the loading sequence ("Querying evidence clusters…" → "Nova Pro is analyzing…"). Show the tailored recommendation.

**Step 5 — Evidence drill-down**
The response has an evidence panel below it. Expand it — show individual user quotes with App Store / Support Tickets source labels. Click "VIEW ALL 94 ITEMS →". Show the EvidenceDrawer with the full corpus of feedback that generated the recommendation.

**Step 6 — Switch to hospital dataset**
Go to Import Sources. Remove the app product sources. Add Patient Portal + Hospital Survey. The dataset switches — clusters change, Chat context changes, Agents show different pipeline metrics.

**Step 7 — Hospital-specific query**
Go to Chat. Ask: "What about the billing cluster?" Show the hospital-specific response: confidence 78%, 58 patients, $3,200 overcharge cases, insurance pre-auth failures, 30-day dispute delays. Evidence drill-down shows patient portal quotes from real-looking dates.

**Step 8 — Agents page**
Go to Agents. Show the 4-agent pipeline diagram with status indicators. Run one agent — watch the button spin and the output box populate with ingestion/embedding/reasoning results. Point out that the same Lambda code ran on both the SaaS dataset and the hospital dataset with zero changes.

**Close:** "Same pipeline. Same confidence formula. Same reasoning agent. Two completely different domains. That's the point."

---

## Mac Migration Session — May 18 2026

### Context
Migrated Veloquity from MSI GF63 (Windows, Git Bash) to MacBook Air M5 (macOS, zsh).
Pipeline was failing silently on the Agents page — agents returned `status: "success"` but
the response body contained mock data or error tracebacks. Chat health check was hitting the
wrong URL and failing immediately before any real network call.

---

### Root Causes Found and Fixed

| # | Issue | File(s) | Impact |
|---|---|---|---|
| 1 | All 4 Lambda zips missing `api/` package | `infra/deploy.sh` | `ModuleNotFoundError: No module named 'api'` on every cold start — all Lambdas failed instantly |
| 2 | `lambda_reasoning.zip` and `lambda_governance.zip` at repo root contained stale Claude Haiku code (`anthropic.claude-3-haiku-20240307-v1:0`) with wrong request format (`anthropic_version`, top-level `max_tokens`, content as string) | repo root artifacts | AISPL blocks Anthropic models; response parsing would also fail even if it got through |
| 3 | `VpcConfig` on `IngestionLambda` and `GovernanceLambda` in CloudFormation | `infra/cloudformation.yaml` | Blocked Secrets Manager access (no NAT/VPC endpoint) → DB credentials unretrievable → both Lambdas timed out at 300s |
| 4 | IAM `bedrock:InvokeModel` Resource ARN only listed `foundation-model/amazon.nova-pro-v1:0` — missing `inference-profile` ARN for cross-region routing | `infra/cloudformation.yaml` | Potential `AccessDeniedException` for `us.amazon.nova-pro-v1:0` invocations |
| 5 | `BUCKET` hardcoded to `"veloquity-reports-dev-082228066878"` (account-specific); `bedrock` client hardcoded `region_name="us-east-1"` ignoring `REGION` var | `lambda_reasoning/handler.py` | S3 writes fail on any other account; bedrock ignores env region |
| 6 | Windows Python path (`"/c/Program Files/Python311/python"`) in 3 places in deploy.sh | `infra/deploy.sh` | `command not found` on macOS — deploy script blocked at parameter-override and migration steps |
| 7 | `vercel.json` (repo root) had placeholder `"VITE_API_URL": "your-render-api-url-here"` — never replaced | `vercel.json` | `fetch("your-render-api-url-here/health")` throws `TypeError` immediately; all health check attempts fail in <1ms; error state shown before backend is ever contacted. **Note:** Vercel reads `frontend_final/vercel.json` (no env section); actual `VITE_API_URL` was set correctly via Vercel dashboard, so the deployed bundle was already hitting the right URL. Root `vercel.json` was fixed for correctness. |
| 8 | Brave browser shields blocking cross-origin `fetch` to `veloquity-api.onrender.com` | Browser | Health check and all API calls silently blocked; Chrome works correctly |

---

### Deploy Script Rebuild (`infra/deploy.sh`)

Old packaging (broken):
```bash
zip -r .build/reasoning.zip reasoning/ lambda_reasoning/  # missing api/ and psycopg2
```

New packaging (all 4 Lambdas):
```bash
# Shared psycopg2-binary install (Linux x86_64 for Lambda runtime)
python3 -m pip install psycopg2-binary \
  --platform manylinux2014_x86_64 --python-version 3.12 --only-binary=:all: \
  -t .build/deps --quiet

# Each zip: deps/ + api/ + Lambda's own package(s) [+ output/ for governance]
build_lambda_zip .build/ingestion.zip  ingestion
build_lambda_zip .build/evidence.zip   evidence
build_lambda_zip .build/governance.zip governance output
build_lambda_zip .build/reasoning.zip  reasoning lambda_reasoning
```

Also replaced Windows Python path with `python3` in parameter-override and migration steps.

---

### Verification

Full pipeline run on real AWS after force-updating all 4 Lambdas:

- **Phase 1 (Ingestion):** `total: 30, duplicates: 30` — seed data already in DB from prior run ✓
- **Phase 2 (Evidence):** `processed: 165, cache_hits: 165, accepted: 4` — fully cached, zero Bedrock cost ✓
- **Phase 3 (Reasoning):** `statusCode: 200`, real UUID `run_id: 771b381d-2786-4453-8149-dc246014828e`, `token_usage: {input_tokens: 1008, output_tokens: 551}`, S3 report written to `reasoning-runs/771b381d....json` ✓

No mock data. No `demo-run-001`. No `mock-reasoning-agent`. Nova Pro ran and returned 4 ranked recommendations.

---

### Branch and Commits

All fixes made on `mac-chs`, verified, then merged to `main`.

Key commits:
- `c9f5e90` — Lambda zip rebuild with `api/` + psycopg2; VpcConfig removed from Ingestion/Governance; IAM inference-profile ARN added; hardcoded BUCKET/region fixed; stale zips deleted; `.gitignore` updated
- `df7c4a7` — Windows Python path replaced with `python3` in deploy.sh
- `398282e` — All 4 Lambda zips bundled with `api/` and psycopg2 (not just reasoning)
- `2c22e5a` — `vercel.json` placeholder URL replaced with actual Render URL

---

### Current State (May 18 2026)

| Component | Status |
|---|---|
| All 4 Lambda functions | Live on AWS, running real code |
| Nova Pro reasoning | Confirmed real token counts, real UUID run_ids |
| CORS | `access-control-allow-origin: https://veloquity1.vercel.app` ✓ |
| Backend URL in bundle | `https://veloquity-api.onrender.com` ✓ |
| Frontend | Live at https://veloquity1.vercel.app — use Chrome (Brave shields block cross-origin fetch) |
| Machine | MacBook Air M5, zsh, SSH auth to GitHub |
