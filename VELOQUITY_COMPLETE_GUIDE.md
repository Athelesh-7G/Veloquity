# Veloquity — Complete Project Guide
### Everything you need to understand this project from zero

---

## Table of Contents

1. What is Veloquity and Why Does it Exist?
2. The Big Picture — How the System is Built
3. The Repository — Every Folder Explained
4. The Database — What Gets Stored and Why
5. The Five Agents — How Each One Works
6. AWS Services — What Each One Does in Veloquity
7. The Frontend — What the User Sees
8. How Deployment Works
9. The Multi-Agent System — How It All Connects
10. Key Design Decisions — Why Things Are Built This Way

---

## Chapter 1: What is Veloquity and Why Does it Exist?

### The Problem It Solves

Every software product receives thousands of pieces of customer feedback every month — reviews on the App Store, support tickets through Zendesk, comments across social media. A product manager at a growing company might have 5,000 pieces of raw feedback sitting in different systems, and no realistic way to read all of them. Even if they could read them all, they would struggle to see the patterns: are ten separate complaints about "loading time" actually the same underlying problem? Which issues are felt by the most users? Which ones should be fixed first? Veloquity solves this problem by automatically reading all that feedback, finding the patterns in it, and telling product managers exactly what to fix and why.

### Who Uses It and What They Get

A product manager (PM) opens the Veloquity dashboard and sees a list of prioritised recommendations — not just "people are unhappy with performance," but a ranked list like: "Fix crash on checkout (affects 234 users, high confidence, corroborated across App Store and Zendesk) — recommended action: investigate memory leak in payment flow." Instead of spending days reading feedback and guessing at priorities, the PM gets a clear, evidence-backed action list within minutes.

### The Single Core Idea

Raw user feedback goes in one end. Intelligent, prioritised product decisions come out the other end. Everything in between — the cleaning, the pattern-finding, the reasoning, the scoring — is handled automatically by a chain of specialised AI agents.

### A Simple Real-World Analogy

Imagine you own a restaurant chain with 50 locations. Every day, each location receives dozens of comment cards from customers. You have a team of five specialists:

1. A **clerk** who collects all the cards, removes duplicates, crosses out personal information, and files them.
2. A **pattern analyst** who reads all the cards and groups similar complaints together: "these 80 cards all mention cold food," "these 40 cards all mention slow service."
3. A **strategist** who looks at all the groups and decides: "fixing the cold food problem will satisfy the most customers the fastest — do that first."
4. A **quality controller** who checks every week that old complaint groups are still relevant and haven't gone away on their own.
5. An **assistant** who sits at your desk and answers any questions you have about the complaints.

Veloquity is that team of five, except they never sleep, they process thousands of cards in minutes, and they use AI to understand what the feedback actually means.

---

## Chapter 2: The Big Picture — How the System is Built

### The Pieces and How They Connect

```
  Your Browser
      |
      | (visits a URL)
      v
  +-----------+
  |  Frontend |   <-- The website you see (React app on Vercel)
  +-----------+
      |
      | (asks for data via HTTP requests)
      v
  +-----------+
  | Backend   |   <-- The server that handles logic (FastAPI on Render)
  |   API     |
  +-----------+
      |
      | (reads/writes data, calls AI models)
      v
  +---------------------------+
  |     AWS Cloud Services    |
  |                           |
  |  Lambda Functions         |  <-- The AI agents that process feedback
  |  Bedrock (AI Models)      |  <-- The AI that understands language
  |  S3 (File Storage)        |  <-- Where raw files are kept
  |  RDS PostgreSQL           |  <-- The main database
  |  Secrets Manager          |  <-- Where passwords are stored safely
  +---------------------------+
```

### What Each Piece Does (One Sentence Each)

- **Frontend**: Draws the user interface in your browser and shows you charts, evidence clusters, and recommendations.
- **Backend API**: Receives requests from the frontend, runs business logic, and talks to the database and AWS services.
- **Lambda Functions**: Five separate AI programs that run in the cloud and process feedback, find patterns, reason about priorities, and maintain quality.
- **Amazon Bedrock**: A service that gives Veloquity access to powerful AI models without needing to train any AI from scratch.
- **Amazon S3**: A cloud file cabinet where raw feedback items are stored as individual files.
- **RDS PostgreSQL**: The main database where structured data — evidence clusters, recommendations, audit logs — is stored and queried.
- **Secrets Manager**: A secure vault that holds passwords and credentials so they never need to be written in the code.

### Why Is Each Piece Separate?

This is one of the most important questions to understand. Why not just write one big program that does everything?

**Reliability**: If the AI reasoning process crashes, the website can still show the data it already has. Separate pieces fail independently.

**Scalability**: If 1,000 pieces of feedback arrive at once, you can run more Lambda functions in parallel without slowing down the website. You can't do that if everything is one program.

**Cost**: Lambda functions only cost money while they are running. A function that processes feedback for 30 seconds costs a tiny fraction of what a server running 24 hours a day costs.

**Maintenance**: A bug in the evidence clustering code only requires updating that one piece. You don't need to redeploy the entire system.

### What "Cloud" Means Here

"Cloud" simply means that the computers running Veloquity are owned by Amazon (AWS) and rented on demand, rather than being physical machines you own and maintain. AWS handles power, cooling, backups, and hardware failures. Veloquity just uploads code and pays for what it uses.

---

## Chapter 3: The Repository — Every Folder Explained

A repository is just a folder that contains all the code for a project, tracked by Git so you can see the history of every change. Here is every folder in Veloquity explained in plain English.

### veloquity/ (the root folder)

This is the top-level folder containing everything. Think of it as the project's home. It contains all the sub-folders described below, plus key configuration files like `render.yaml`, `vercel.json`, and `requirements.txt`. If you deleted this entire folder, the project would cease to exist.

---

### api/

This folder contains the backend web server — the program that listens for requests from the browser and responds with data.

**Why it exists separately**: The backend server is a completely different type of program from the AI agents. It runs 24/7 as a web server, while agents run only when triggered. Mixing them would make both harder to understand and deploy.

**What breaks if deleted**: The entire website stops working. No data can be fetched, no agents can be triggered, no chat works.

**Real-world analogy**: This is like the front desk of an office. Visitors (the browser) come here, ask questions, and the desk clerk fetches information from the back rooms (the database and agents).

#### api/routes/

Inside `api/`, this sub-folder contains one file per group of related web endpoints. An "endpoint" is a specific URL the browser can ask — like `/api/v1/evidence` to get evidence clusters, or `/api/v1/chat` to send a message to the AI assistant.

There are six route files:
- `evidence.py` — serves evidence cluster data
- `recommendations.py` — serves the AI's prioritised recommendations
- `agents.py` — lets you trigger and check the status of agents
- `governance.py` — serves audit log and governance statistics
- `chat.py` — handles the AI chat assistant
- `constraints.py` — lets you read and update decision constraints

**Why routes are in their own folder**: Keeping each group of endpoints in its own file means the codebase stays organised as it grows. Finding "the code that handles chat" is easy when you know it lives in `routes/chat.py`.

---

### db/

This folder contains everything related to the database — the scripts that create the database tables and the sample data to test with.

**Why it exists separately**: Database setup scripts are not application code. They run once when setting up a new environment. Keeping them separate makes it obvious what they are.

**What breaks if deleted**: You would not be able to set up the database tables in a new environment. The existing database in AWS would still work, but you could not recreate it.

#### db/migrations/

A migration is a SQL script that makes a specific change to the database — like creating a new table. Migrations are numbered (001, 002, ...) and run in order.

**Why migrations instead of creating tables manually?**

Imagine you create a table by hand in your local database, but then your colleague needs to set up their own copy of the project. They would need to know exactly which tables to create and in what order. Migrations solve this by being a written record of every database change, in order, that anyone can replay. It is like a recipe: follow the steps and you always get the same kitchen.

---

### evidence/

This folder contains Phase 2 of the pipeline: the Evidence Intelligence Agent. It takes raw feedback items from S3, converts them into AI embeddings (numerical representations of meaning), groups similar items together, and decides how confident it is in each group.

**Why it exists separately**: This is a discrete processing stage with its own logic (embedding, clustering, confidence scoring). It is deployed as its own AWS Lambda function.

**What breaks if deleted**: No new evidence clusters would ever be created. Raw feedback would pile up in S3 with no analysis.

**Real-world analogy**: This is like a research analyst who reads all the complaint cards and sorts them into labelled piles: "these all seem to be about the same thing."

---

### governance/

This folder contains Phase 5: the Governance Agent. It runs automatically every day to check whether old evidence is still relevant, promote patterns that have become common enough to take seriously, monitor costs, and write an audit log of everything it does.

**Why it exists separately**: Governance is a scheduled maintenance task — like a nightly cleanup job. It has completely different logic from the analysis pipeline.

**What breaks if deleted**: Evidence clusters would never go stale. Low-confidence patterns would never get promoted. The audit log would stop being written.

**Real-world analogy**: This is the quality control manager who comes in every morning to archive old reports, promote pending cases, and check that the operation is running efficiently.

---

### infra/

This folder contains the infrastructure code — the instructions that tell AWS what cloud resources to create (databases, Lambda functions, S3 buckets, security rules).

**Why it exists separately**: Infrastructure configuration is not application logic. It is the description of the environment the application runs in.

**What breaks if deleted**: You could not deploy a new copy of the entire AWS infrastructure. The existing deployed infrastructure would still work.

**Real-world analogy**: This is the architectural blueprint for a building. The building itself (AWS) is already constructed, but without the blueprint you could not build another one.

**What is "infrastructure as code"?**

Normally, setting up cloud infrastructure means clicking through web interfaces and making manual decisions. Infrastructure as code means writing those decisions down in a file (here: `cloudformation.yaml`) so they can be repeated exactly, reviewed for changes, and stored in version control alongside the application code.

---

### ingestion/

This folder contains Phase 1 of the pipeline: the Ingestion Agent. It takes raw feedback from different sources, standardises the format, removes personal information, checks for duplicates, and stores each unique item in S3.

**Why it exists separately**: Ingestion is the entry point of the entire system. Its logic (normalisation, PII redaction, deduplication) is completely different from analysis or reasoning.

**What breaks if deleted**: No new feedback would ever enter the system.

**Real-world analogy**: This is the mailroom. Packages (feedback) arrive in different formats from different couriers (App Store, Zendesk). The mailroom opens them, stamps them with an ID, removes personal details, checks if the same letter arrived before, and files unique ones in the archive.

---

### lambda_reasoning/

This folder contains the entry point for the Reasoning Lambda function. It is a thin wrapper that handles the AWS Lambda event format and calls the actual reasoning logic in the `reasoning/` folder.

**Why it exists separately**: AWS Lambda has a specific way it calls your code (via a `handler` function that receives an `event` and `context`). The reasoning logic itself does not need to know about Lambda specifics. The handler folder keeps the Lambda plumbing separate from the core reasoning logic.

**What breaks if deleted**: The Reasoning Lambda could not be invoked by AWS. The reasoning logic in `reasoning/` would still exist but have no entry point.

---

### reasoning/

This folder contains the core logic of the Reasoning Agent: how it scores evidence, builds the prompt for the AI, calls the AI model, and saves the results.

**Why it exists separately**: This is the intellectual heart of the system — the complex scoring formulas, prompt engineering, and output structuring. Keeping it separate from the Lambda handler means it can be tested and updated independently.

**What breaks if deleted**: No prioritised recommendations would ever be generated.

**Real-world analogy**: This is the strategy consultant's methodology — the frameworks, scoring rubrics, and analytical tools they use to produce their recommendations.

---

### output/

This folder contains code for generating outputs that humans consume directly: an HTML report uploaded to S3 (a web page showing the latest analysis) and a placeholder for Slack notifications.

**Why it exists separately**: Report generation is distinct from data processing. It is purely about presentation.

**What breaks if deleted**: HTML reports would not be generated. The Slack digest would not work when implemented.

---

### tests/

This folder contains automated tests — code that checks that other code works correctly. There are test files for ingestion, the embedding pipeline, and the reasoning agent.

**Why it exists separately**: Tests are not application code. They never run in production. Keeping them in their own folder makes the distinction clear.

**What breaks if deleted**: Nothing in production breaks. But you lose all automated safety checks — bugs introduced by future changes might go undetected.

---

### frontend_final/

This folder contains the user interface — the React application that runs in the browser and shows the dashboard, evidence grid, agent controls, and chat interface.

**Why it exists separately**: The frontend is a completely different type of program (JavaScript running in a browser) from the backend (Python running on a server). They are deployed to different services (Vercel vs Render).

**What breaks if deleted**: Users would have no interface to interact with the system.

#### frontend_final/src/

The `src/` folder (short for "source") contains the actual TypeScript and CSS source files — the code that developers write. There is also a `dist/` folder (not in the repository, generated during build) that contains the compiled output that browsers actually run.

**Why src/ exists**: A convention in JavaScript projects. Source files live in `src/`, output files go in `dist/`. This keeps hand-written code separate from generated code.

#### frontend_final/src/api/

Contains the API client — the code that makes HTTP requests to the backend. Think of it as the phone book: it knows the address of every backend endpoint and how to call each one.

#### frontend_final/src/components/

Contains reusable UI building blocks — buttons, cards, input fields, navigation bars. Instead of writing a "card" from scratch on every page, you build it once here and reuse it everywhere.

#### frontend_final/src/pages/

Contains one file per full page of the application: Dashboard, EvidenceGrid, Agents, Chat, and so on. Each page assembles components together and fetches the data it needs.

#### frontend_final/src/types/

Contains TypeScript type definitions — descriptions of what shape data is expected to have. For example, it might say "an EvidenceItem has an id (text), a theme (text), and a confidence (number between 0 and 1)."

#### frontend_final/src/utils/uploadState.ts

**What it does**: Manages localStorage state for uploaded data sources. Tracks which CSV files have been connected (App Store, Zendesk, Patient Portal, Hospital Survey), their row counts, and which of the two mock datasets is currently active.

**Why it exists**: The frontend needs to know whether any data has been uploaded without making an API call. This utility persists that state in the browser's localStorage so it survives page navigation and refresh. Every page reads `hasUploadedData()` and `getActiveDataset()` to decide whether to show the upload-gate empty state or the full data view.

#### frontend_final/src/utils/agentRunState.ts

**What it does**: Persists agent run timestamps and statuses in localStorage so that "Done X minutes ago" labels on the Agents page survive page navigation.

**Why it exists**: Without this, every time a user navigates away and back to the Agents page, the run timestamps reset to "Never run." With localStorage persistence, the last-run time is preserved for the duration of the browser session, matching the experience of a system that has already been running.

#### frontend_final/src/components/EvidenceDrawer.tsx

**What it does**: A slide-in panel (drawer) that appears from the right side of the screen showing all feedback items for a specific evidence cluster. Items are displayed with source badges (green App Store, blue Zendesk, purple Patient Portal, orange Hospital Survey), star ratings where available, and dates. Includes a CSV download button.

**Why it exists**: Source-to-decision traceability requires that a PM can drill all the way down from a recommendation to individual raw feedback items. The EvidenceDrawer makes this possible directly from the Chat interface — clicking "VIEW ALL X ITEMS" opens the drawer without leaving the page.

---

### .build/

This folder contains compiled artifacts — the zip files that get uploaded to AWS Lambda. When `deploy.sh` runs, it zips up each Lambda folder's Python code and puts the zip files here.

**Why it exists**: AWS Lambda does not run Python files directly from a folder. It needs a zip archive. This folder holds those archives between when they are created and when they are uploaded to S3.

**What breaks if deleted**: Nothing in production breaks (the zips are already uploaded to S3). But the next deploy would need to recreate them.

---

### Special Files Explained

**requirements.txt**: A list of Python libraries (like packages or plug-ins) that the backend needs to install before it can run. Think of it as a shopping list — when setting up a new server, you run `pip install -r requirements.txt` and Python goes and downloads everything on the list.

**package.json**: The JavaScript equivalent of requirements.txt. It lists all the JavaScript libraries the frontend needs. Running `npm install` reads this file and downloads them all.

**.env.example**: A template showing every environment variable the project needs. Environment variables are like settings that you pass to a program when you start it — they keep sensitive values like passwords out of the code. The `.example` file shows the shape without containing real values.

**render.yaml**: Tells Render (the backend hosting service) how to build and run the FastAPI server. Think of it as a note you leave for Render saying "here is my Python app, here is how to start it, here are the settings it needs."

**vercel.json**: Tells Vercel (the frontend hosting service) how to serve the React app. The most important instruction is "if someone visits any URL, send them the main `index.html` file" — this is needed because React handles its own routing inside the browser.

**cloudformation.yaml**: The master blueprint for all AWS infrastructure. One file that describes every Lambda function, every S3 bucket, the RDS database, security rules, and more. AWS CloudFormation reads this file and creates or updates everything accordingly.

**Why JSON for some config files and YAML for others?** JSON is stricter (every comma and bracket must be perfect) and is the native format for JavaScript. YAML allows comments, is less punctuation-heavy, and is more readable for humans writing complex nested configuration like CloudFormation templates. In Veloquity: `parameters.json` is JSON (small, machine-read), `cloudformation.yaml` is YAML (large, human-authored with comments).

---

## Chapter 4: The Database — What Gets Stored and Why

### What PostgreSQL Is

PostgreSQL is a database — a program that stores information in an organised way so you can find it quickly later. Think of it like a giant, organised collection of spreadsheets. Each "spreadsheet" is called a table. Each row in a table is one record. Each column defines one piece of information about that record.

Veloquity runs its PostgreSQL database on Amazon RDS, which means Amazon manages the actual server hardware — backups, updates, and availability.

### What pgvector Is (And Why Normal Databases Can't Do This)

Modern AI models describe the meaning of text using lists of hundreds of numbers called "vectors" or "embeddings." A normal database can store these lists, but it has no fast way to answer the question: "which of these 10,000 stored vectors is most similar to this new one?" Without that, you cannot do AI-powered search or clustering.

`pgvector` is an extension that adds this superpower to PostgreSQL. It adds a special column type (`vector`) and special index types (like HNSW) that make "find the most similar vector" queries fast — milliseconds instead of minutes.

### The 8 Database Tables

#### Table 1: evidence

This is the most important table. It stores finished, validated evidence clusters — groups of similar feedback that the system has decided are worth paying attention to.

Example row:
```
id:                  a3f1-... (a unique ID)
theme:               "App crashes during checkout"
representative_quotes: ["It crashed when I tried to pay", "Keeps closing on payment screen"]
unique_user_count:   234
confidence_score:    0.87
source_lineage:      {"app_store": 0.65, "zendesk": 0.35}
status:              "active"
last_validated_at:   2026-03-20
embedding_vector:    [0.234, -0.112, 0.891, ...] (1024 numbers)
```

#### Table 2: dedup_index

This table keeps a record of every piece of feedback ever seen, identified by a fingerprint (hash). Its main job is to prevent duplicates.

Example row:
```
hash:       "a3f9d2..." (SHA-256 fingerprint of the text)
source:     "app_store"
first_seen: 2026-01-15
frequency:  3  (this exact text appeared 3 times)
```

#### Table 3: embedding_cache

Converting text into AI vectors (embeddings) costs money — it requires calling an AWS AI service for each piece of text. This table caches those results so the same text is never embedded twice.

Example row:
```
content_hash:     "7a2b..." (fingerprint of the text)
model_version:    "amazon.titan-embed-text-v2:0"
embedding_vector: [0.112, 0.445, ...] (1024 numbers)
cached_at:        2026-02-01
```

If the same text appears again (perhaps in a different batch), the system looks here first. If it finds a match, it uses the cached vector for free instead of calling the AI model again.

#### Table 4: low_confidence_staging

When a cluster of feedback is found but the system is not very confident in it (the feedback items are somewhat similar but not clearly the same issue), it goes here instead of into the main `evidence` table. It waits here until either enough similar feedback accumulates (frequency reaches 10) or it is rejected.

Example row:
```
id:               b2c3-...
content_hash:     "ff12..."
source:           "zendesk"
confidence_score: 0.52
frequency:        7   (seen 7 times so far, needs 10 to be promoted)
promoted:         false
```

#### Table 5: governance_log

This is a permanent, append-only record of every automated action the Governance Agent takes — flagging stale evidence, promoting signals, triggering cost alerts.

Example rows:
```
event_type: "stale_flagged"    target: evidence cluster #44    details: {days_stale: 35}
event_type: "signal_promoted"  target: staging entry #91       details: {frequency: 12}
event_type: "cost_alert"       target: null                    details: {cache_hit_rate: 0.31}
```

#### Table 6: reasoning_runs

Every time the Reasoning Agent runs and produces recommendations, the entire output is stored here — what evidence it looked at, what scores it assigned, what the AI said, how many tokens it used.

Example row:
```
id:            run-uuid-...
run_at:        2026-03-22 06:00
evidence_ids:  [cluster1, cluster2, cluster3, ...]
llm_response:  {"recommendations": [...], "reasoning_summary": "..."}
model_id:      "us.amazon.nova-pro-v1:0"
token_usage:   {"inputTokens": 4200, "outputTokens": 800}
status:        "completed"
```

#### Table 7: evidence_item_map

This table is the "source of truth" link between a finished evidence cluster and all the individual raw feedback items that went into it. It answers the question: "which specific user reviews contributed to this cluster?"

Example rows:
```
evidence_id: cluster-uuid-A    dedup_hash: "aa12..."    source: "app_store"    s3_key: "app_store/2026/01/15/item123.json"
evidence_id: cluster-uuid-A    dedup_hash: "bb34..."    source: "zendesk"      s3_key: "zendesk/2026/01/16/ticket456.json"
```

### What Is a Migration File?

A migration file is a numbered SQL script that makes one specific, permanent change to the database structure. Migrations run in order: 001 first, then 002, and so on. Once run, they should never be changed — if you need to modify a table, you add a new migration file with the change.

Why not just create tables manually? Because migrations are reproducible. Anyone setting up the project runs the same migration files in the same order and gets an identical database. It also means every structural change to the database is tracked in version control alongside the code that uses it.

### What Is a Foreign Key?

A foreign key is a column in one table that refers to the ID in another table, creating a link between the two.

Real-world analogy: Imagine a library. The "books" table has a column `author_id`. The "authors" table has an `id`. The `author_id` in books is a foreign key — it points to a specific author in the authors table. If you try to add a book with `author_id = 999` and there is no author with id 999, the database refuses. This prevents orphaned records.

In Veloquity: `evidence_item_map.evidence_id` is a foreign key pointing to `evidence.id`. If an evidence cluster is deleted, all its item map entries are automatically deleted too (`ON DELETE CASCADE`).

### Why Is governance_log Append-Only?

An audit log only has value if you can trust that it has never been modified. If rows could be deleted or updated, a bad actor (or a bug) could erase evidence of their actions. By making the table append-only (the application code only ever inserts new rows, never updates or deletes them), the log becomes a reliable historical record. Even if something goes wrong in the system, you can always look back at exactly what happened and when.

---

## Chapter 5: The Five Agents — How Each One Works

### What Is an "Agent"?

An agent is a program that takes in information, makes decisions, and takes actions — often in a loop. In Veloquity, each agent is a specialised worker that handles one phase of the feedback processing pipeline. Four of the five agents run as AWS Lambda functions (programs that wake up, do their job, and go back to sleep). The fifth lives inside the API server itself.

---

### Ingestion Agent

**What triggers it**: A batch of feedback items is sent to the Lambda function (either directly via API call or via an S3 event when a file lands in a specific bucket).

**Step by step what it does**:

1. Receive a list of raw feedback items (App Store reviews or Zendesk tickets)
2. For each item, normalise it — convert it from its source-specific format into a standard internal format with consistent fields (id, source, text, timestamp, hash)
3. Redact any personal information from the text
4. Compute a SHA-256 fingerprint of the cleaned text
5. Check the database: has this fingerprint been seen before?
   - If yes: increment the frequency counter and skip
   - If no: write the item to S3 and record it in the dedup index
6. Report how many items were written, how many were duplicates, and how many had errors

**What PII Redaction Means and Why It Matters**

PII stands for Personally Identifiable Information — things like email addresses, phone numbers, credit card numbers, and Social Security numbers. If a user writes a review saying "my card ending in 4532 was charged twice" and Veloquity stores that text, it now holds sensitive financial data. PII redaction scans the text and replaces any recognised patterns with `[REDACTED]` before storing anything. This protects users and helps Veloquity comply with privacy laws.

Veloquity does this with regular expressions — pattern-matching rules that look for things like "three digits, dash, two digits, dash, four digits" (a Social Security number) and replace the match. No external service is needed.

**What SHA-256 Deduplication Means — The Fingerprint Analogy**

SHA-256 is a mathematical function that takes any text and produces a unique 64-character string (called a hash or fingerprint). Two identical texts always produce the same hash. Two different texts almost certainly produce different hashes.

It is exactly like a fingerprint: every person has a unique fingerprint, and if you find the same fingerprint twice, you know it is the same person. If the same user submits the same review twice, or if two data feeds accidentally contain the same ticket, their SHA-256 hashes match and the system recognises the duplicate instantly — without reading the text or comparing sentences word by word.

**What S3 Is and Why Files Are Stored There**

S3 (Simple Storage Service) is Amazon's cloud file storage — think of it as a hard drive in the cloud that can hold unlimited files. Veloquity stores each normalised feedback item as an individual JSON file in S3, organised by source and date (e.g., `app_store/2026/01/15/item123.json`).

Why S3 instead of the database? Because S3 is optimised for storing large numbers of files cheaply and reliably. The database is for structured, queryable data. Raw feedback items are just files — they don't need to be queried row by row. Storing them in S3 keeps the database lean and reduces cost.

**What the agent produces**: A set of JSON files in S3 (one per unique feedback item) and corresponding records in the `dedup_index` table.

---

### Evidence Intelligence Agent

**What an "Embedding" Actually Is — The Map Coordinates Analogy**

Imagine you could place any sentence on a map where sentences with similar meanings are geographically close to each other. "The app keeps crashing" and "it closes unexpectedly every time I open it" would be plotted near each other. "Great customer service" would be far away in a different region.

An embedding is essentially the map coordinates for a piece of text. Instead of two coordinates (latitude and longitude), an AI embedding uses 1024 coordinates — 1024 numbers — to describe the precise "location" of a sentence in a vast conceptual space.

**What a Vector Is in Plain English**

A vector is simply a list of numbers. The word "vector" sounds mathematical, but all it means here is: "a list of 1024 numbers that represents the meaning of a sentence." That is all. The AI model (Amazon Titan Embed V2) reads a sentence and outputs a list of 1024 numbers.

**Why 1024 Numbers Can Represent the Meaning of a Sentence**

The AI model was trained on billions of sentences. Through training, it learned that sentences meaning similar things should be assigned similar numbers in similar positions. So "app crashes on payment" might have a high number in position 42 (perhaps that position tracks "negative mobile experience") and a low number in position 856 (perhaps that position tracks "positive sentiment"). The exact values were learned by the model — you don't choose them, the AI figures them out.

**What Cosine Similarity Means — The Compass Direction Analogy**

Cosine similarity measures how similar two vectors are. Think of each vector as an arrow pointing in a direction in space. Two arrows pointing in almost the same direction are very similar (cosine similarity close to 1.0). Two arrows pointing in completely opposite directions are very different (cosine similarity close to -1.0). Two arrows pointing at right angles are unrelated (cosine similarity of 0.0).

"App keeps crashing" and "keeps closing unexpectedly" would have arrows pointing in almost the same direction (similarity ~0.9). "Great customer service" would point in a very different direction (similarity ~0.1 with the crash complaints).

**How Clustering Works — Grouping Similar Complaints**

Veloquity uses a "greedy" clustering algorithm. It works like this: imagine you have 500 arrows (one per feedback item). The algorithm picks up the first arrow and starts a pile. Then it looks at the second arrow: is it pointing in a similar enough direction (cosine similarity above 0.75)? If yes, add it to the first pile. If no, start a new pile. Continue for all 500 arrows.

At the end, you have a set of piles, each representing a group of feedback items that are all saying roughly the same thing. Each pile becomes an evidence cluster.

**What Confidence Score Means and How It Is Calculated**

The confidence score measures how tightly grouped the feedback items in a cluster are. If all the items are saying almost exactly the same thing (arrows very close together), confidence is high. If the cluster has a mix of somewhat-related but quite different feedback, confidence is lower.

Mathematically: it computes how far each item in the cluster is from the cluster's centre (the average direction). If items are spread out, variance is high, confidence is low. The formula is: `1.0 - (variance × 2.0)`, clamped between 0 and 1.

**Why Items Below 0.4 Are Rejected and Above 0.6 Are Accepted**

These are the three bands:
- **0.0 to 0.39**: The cluster is so loosely grouped that it probably is not a real pattern. The system rejects it automatically and sends it to the staging table in case it gets stronger over time.
- **0.40 to 0.59**: The system is not sure. These clusters get sent to the AI (Nova Pro) for a second opinion — the AI reads the items and decides if they are genuinely related.
- **0.60 to 1.00**: The cluster is tight and clearly represents a real pattern. It is accepted automatically without needing an AI review.

The thresholds 0.4 and 0.6 were chosen as reasonable starting points that can be adjusted via environment variables.

**What the Embedding Cache Is and Why It Saves Money**

Every time you ask the AI model to convert text to an embedding, AWS charges a small fee. If the same text appears twice (maybe the same review shows up in two different data feeds), you would be charged twice for the same result.

The embedding cache stores the result (the 1024 numbers) alongside a fingerprint of the text and the model version. Before calling the AI, the system checks the cache. If the fingerprint matches, it uses the stored result for free. This can save meaningful money when processing large volumes of feedback.

---

### Reasoning Agent

**What the ReAct Pattern Means in Plain English**

ReAct stands for "Reason + Act." It is a pattern for AI agents where the agent alternates between thinking about what to do next and actually doing something. In Veloquity's reasoning agent:

1. **Retrieve**: Gather all active evidence clusters from the database
2. **Score**: Calculate a priority score for each cluster (more on this below)
3. **Reason**: Build a detailed prompt and send it to the AI model (Nova Pro)
4. **Act**: Save the AI's recommendations to the database and S3
5. **Return**: The prioritised list of recommendations is now available

**How the Priority Score Is Calculated — The 4 Factors**

Each evidence cluster gets a priority score that determines its rank in the recommendations. The score uses four factors, each contributing a weighted portion of the final score:

1. **Confidence (35% of the score)**: How certain is the system that this cluster represents a real pattern? A cluster with confidence 0.9 ranks higher than one with confidence 0.6. Weight: 0.35.

2. **Unique Users (25% of the score)**: How many individual users are affected? An issue affecting 500 users ranks higher than one affecting 10. The count is divided by 50 to normalise it (so 50 users = a contribution of 0.5 to the score). Weight: 0.25.

3. **Source Corroboration (20% of the score)**: Is the issue showing up in multiple data sources? A problem reported in both App Store reviews and Zendesk tickets is more credible than one appearing in only one place. Weight: 0.20.

4. **Recency (20% of the score)**: Is this issue still being reported recently? An issue last seen 90 days ago scores 0 for recency. An issue seen today scores 1.0. The formula is: `1.0 - (days since last seen / 90)`. Weight: 0.20.

**What the System Prompt Contains and Why It Matters**

The "system prompt" is a set of instructions given to the AI model before the actual data. It tells Nova Pro: who you are, what your job is, what constraints you must respect (e.g., "no breaking API changes," "GDPR compliance"), and what format to produce your output in.

Think of it as the briefing you give a consultant before they start their analysis: "You are a senior product strategist. Our engineering team has medium capacity. Our current sprint is already full. Here are our business priorities. Please produce a structured JSON report with ranked recommendations."

**What Nova Pro Actually Does With All This Information**

The AI receives the system prompt plus a detailed list of all evidence clusters with their scores, quotes, and statistics. It reads all of this and produces a structured JSON response containing: a ranked list of recommendations (each with a theme, recommended action, effort estimate, user impact, trade-off explanation, and risk flags), plus a meta section with overall reasoning summary and cross-cluster insights.

The AI is like a senior consultant who has read all the evidence and written a well-reasoned report — except it does it in seconds.

**What the Agent Produces**

A row in the `reasoning_runs` table containing the full AI response, plus a JSON file in S3 with the complete report. The API's `/recommendations` endpoint reads the latest row from `reasoning_runs` and serves it to the frontend.

---

### Governance Agent

**What "Governance" Means in This Context**

In a system that accumulates data over time, "governance" means the ongoing process of maintaining quality, relevance, and efficiency. Without governance, a feedback intelligence platform would gradually fill up with stale, outdated evidence clusters from months ago, making the recommendations less relevant. The Governance Agent is the automated caretaker.

**What Stale Evidence Is and Why It Needs to Be Removed**

An evidence cluster becomes "stale" when it has not been validated or seen new supporting feedback for more than 30 days. If a cluster about "checkout crashes" was last seen in January and it is now March, it may have already been fixed. Keeping it as "active" evidence would mislead the reasoning agent into recommending fixes for problems that no longer exist.

The Governance Agent queries for evidence clusters not updated in 30 days and marks them as `status = 'stale'`. They are not deleted — just flagged. This way, if the issue resurfaces, the cluster can be reactivated.

**What Signal Promotion Is and Why It Exists**

Low-confidence feedback (clusters below 0.4 confidence) goes to a staging table instead of the main evidence table. But sometimes these weak signals are actually real problems that just have not gathered enough supporting feedback yet. If the same low-confidence cluster keeps appearing — if its `frequency` counter in the staging table reaches 10 — the Governance Agent promotes it to active evidence, treating frequency as a secondary form of validation.

**Why the Audit Log Can Never Be Deleted**

The `governance_log` table records every action the Governance Agent takes — every time it flags evidence as stale, every time it promotes a signal, every time it triggers a cost alert. This log is the history of automated decisions in the system.

If you could delete or edit log entries, you could erase evidence of things that happened: "why did this evidence cluster get marked stale?" "who promoted this signal and when?" Without the log, these questions become unanswerable. The append-only constraint is a guarantee of historical integrity.

**What EventBridge Is and Why the Agent Runs Automatically Every Day**

AWS EventBridge is a scheduler — a service that can trigger other services (like Lambda functions) on a schedule. In Veloquity, EventBridge is configured to trigger the Governance Lambda once a day at 6:00 AM UTC (using the cron expression `cron(0 6 * * ? *)`).

Without a scheduler, someone would have to manually trigger the governance process every day. EventBridge makes the whole thing automatic — set it up once in CloudFormation and it runs forever.

---

### Chat Agent

**How It Is Different From the Other Four Agents**

The Chat Agent is not a scheduled, batch-processing Lambda function. It is a real-time, conversational endpoint inside the FastAPI server. When a user types a question in the chat interface and hits send, the Chat Agent responds immediately — it does not queue a job or wake up a Lambda.

**Why It Lives in the API Instead of Lambda**

Real-time chat needs to respond in under a few seconds. Lambda functions have a "cold start" problem — if a Lambda has not been used recently, it takes a few extra seconds to wake up. For a scheduled daily job, a cold start does not matter. For a chat interface where the user is waiting for a reply, it feels broken.

The FastAPI server is always running and always warm, so chat responses are fast.

**How It Uses Evidence Context to Ground Its Answers**

Before calling the AI, the Chat Agent queries the database for: the latest active evidence clusters, the most recent recommendations, and recent governance events. It assembles all of this into a "system prompt" — a briefing for the AI that says, in effect: "here is everything currently known about this product's feedback. Answer the user's question based on this information."

This is called "grounding" — using real data to anchor the AI's responses. Without grounding, the AI would make up generic answers. With grounding, it says things like: "Based on the evidence, the checkout crash issue affecting 234 users is the highest priority — the reasoning agent scored it 0.88."

**What the Fallback System Does When Bedrock Is Unreachable**

If AWS Bedrock is unavailable (network error, outage, or missing credentials), the Chat Agent does not crash. Instead, it looks at the user's message, identifies keywords, and returns a pre-written fallback response from a hardcoded map. For example, if the message contains "recommendation" or "priority," it returns a canned response about the highest-priority theme. This way, the UI always responds with something useful rather than showing an error.

**Dual Dataset Mode**

The Chat Agent supports two completely separate dataset contexts — app product and hospital survey — selected via `getActiveDataset()` from uploadState. Each dataset has its own system prompt injected into the Nova Pro context, its own set of evidence clusters, its own keyword maps for cluster detection, and its own fallback responses. Switching dataset requires only uploading different CSV files; no code change is needed.

**Guided Recommendation Flow**

When a user asks how to overcome, fix, solve, address, tackle, or resolve a specific issue, the Chat Agent detects this intent using a trigger-word check combined with cluster detection. Instead of immediately calling Nova Pro, it pauses and asks three targeted questions: primary goal (reduce churn, hit Q2 milestone), engineering capacity (1 engineer for 2 weeks, full sprint), and constraints (no backend changes, ship by date X). The user's answers are then assembled into an enriched prompt that produces a specific, actionable plan rather than a generic response. The three-question message intentionally shows no evidence drill-down — only the final recommendation response shows it.

**Evidence Drill-Down**

Every assistant response is followed by an `InlineEvidence` component that shows the most relevant evidence clusters. By default it shows 3 representative quotes per cluster, expandable to 10. A "VIEW ALL X ITEMS" button opens the `EvidenceDrawer` slide-in panel. The count shown on this button uses the official `feedback_item_count` from the cluster definitions — not the length of the filtered sample array — so the number matches what the pipeline actually processed.

**Cold Start Handling**

When the Chat page loads, it immediately pings the backend `/health` endpoint. If the backend is warming up (Render free tier spins down after 15 minutes of inactivity), it retries up to 10 times with 3-second gaps, showing the user a progress message like "Waking up inference engine… (attempt 3/10)." Only after a successful health check does it allow messages to be sent.

---

## Chapter 6: AWS Services — What Each One Does in Veloquity

### AWS Lambda — Functions That Run on Demand

**Simple analogy**: A vending machine. You press a button, it performs one specific action, and it goes back to idle. You only pay while it is dispensing.

**How Veloquity uses it**: Four Lambda functions handle the four automated pipeline stages — ingestion, evidence intelligence, reasoning, and governance. They run only when triggered (either by an event, a schedule, or a manual API call). Between runs, they cost nothing.

**What happens if removed**: All automated processing stops. No new feedback is ingested, no new evidence is created, no recommendations are generated, no governance runs.

---

### Amazon Bedrock — AI Model Access

**Simple analogy**: A library that lets you borrow the world's most powerful AI models without owning them. You pay per page read.

**How Veloquity uses it**: Two models via Bedrock — Titan Embed V2 converts feedback text into vectors; Nova Pro generates reasoning and recommendations. The application calls Bedrock's API, sends text, and receives AI output.

**What happens if removed**: No embeddings (evidence pipeline breaks), no AI reasoning (recommendations stop), no chat responses (falls back to canned answers).

---

### Amazon Nova Pro — The Reasoning Model

**Simple analogy**: The senior consultant who reads all the evidence and writes the strategic recommendation memo.

**How Veloquity uses it**: Nova Pro receives the complete evidence picture (all clusters, scores, quotes) in a structured prompt and produces a JSON-formatted ranked recommendation list with explanations and trade-off notes.

**What happens if removed**: Recommendations cannot be generated. The evidence pipeline still works, but no one tells the PM what to do with it.

---

### Amazon Titan Embed V2 — The Embedding Model

**Simple analogy**: A translator that converts human language into mathematical coordinates that computers can compare.

**How Veloquity uses it**: Every feedback item and every evidence cluster is converted into a 1024-number vector using Titan Embed V2. These vectors are stored in the database and used for cosine-similarity clustering.

**What happens if removed**: The evidence intelligence pipeline breaks entirely. No new clusters can be formed.

---

### Amazon S3 — File Storage

**Simple analogy**: A hard drive in the cloud with unlimited space and no filing cabinet to manage.

**How Veloquity uses it**: Three purposes — storing normalised feedback items (one JSON file per item), storing completed reasoning run reports (JSON), and storing the HTML intelligence report for PMs to read.

**What happens if removed**: Raw feedback items cannot be stored between ingestion and embedding. Reasoning reports have nowhere to go. The HTML report cannot be published.

---

### Amazon RDS PostgreSQL — The Relational Database

**Simple analogy**: The project's central filing system — everything is organised, indexed, and queryable.

**How Veloquity uses it**: Stores all structured data: evidence clusters, deduplication records, embedding cache, staging signals, governance log, reasoning runs, and item provenance maps.

**What happens if removed**: The entire system's memory disappears. No evidence, no history, no recommendations, no audit trail.

---

### AWS Secrets Manager — Credential Storage

**Simple analogy**: A bank safe where the system stores sensitive information (like database passwords) so it never needs to be written down anywhere else.

**How Veloquity uses it**: The database credentials (host, username, password) are stored in a Secrets Manager secret identified by its ARN (a unique address). When the API or Lambda needs to connect to the database, it fetches the credentials from Secrets Manager at runtime.

**What happens if removed**: The application cannot connect to the database. All data becomes inaccessible.

---

### AWS EventBridge — Scheduled Triggers

**Simple analogy**: An alarm clock that, instead of waking you up, triggers an AWS Lambda function.

**How Veloquity uses it**: EventBridge triggers the Governance Lambda once per day at 6:00 AM UTC.

**What happens if removed**: The Governance Agent no longer runs automatically. Evidence clusters accumulate without ever being checked for staleness. Low-confidence signals are never promoted.

---

### AWS CloudFormation — Infrastructure as Code

**Simple analogy**: The architect's blueprint. Not the building itself, but the detailed plan for constructing it.

**How Veloquity uses it**: A single `cloudformation.yaml` file describes every AWS resource — Lambda functions, S3 buckets, RDS database, security groups, IAM roles, EventBridge rules. Running `bash infra/deploy.sh dev` reads this file and creates or updates everything in AWS.

**What happens if removed**: You could not automate the creation of new environments (staging, production). Manual AWS console configuration would be required, and it would be error-prone and unrepeatable.

---

### AWS IAM — Permissions and Roles

**Simple analogy**: The security clearance system. Not everyone gets access to everything — IAM defines exactly who can do what.

**How Veloquity uses it**: Lambda functions have an IAM execution role that grants them only the permissions they need: read/write to specific S3 buckets, call specific Bedrock models, read a specific Secrets Manager secret. Nothing more.

**What happens if removed**: Lambda functions cannot access S3, Bedrock, or the database. Everything breaks immediately.

---

## Chapter 7: The Frontend — What the User Sees

### What React Is in Simple Terms

React is a JavaScript framework for building user interfaces. Instead of writing one massive page of HTML, React lets you break the UI into components — reusable, self-contained pieces like "a card," "a navigation bar," or "a chart." When data changes, React automatically updates only the parts of the screen that need to change, without reloading the whole page.

### What Vite Is and Why It Exists

Vite is a build tool that converts your developer-friendly TypeScript files into browser-runnable JavaScript files. Browsers cannot run TypeScript directly — they only understand plain JavaScript. Vite also runs a local development server so you can see your changes instantly without uploading anything to the internet. Think of Vite as the compiler and the live preview tool.

### What TypeScript Is and Why It Is Used Instead of Plain JavaScript

TypeScript adds a "type system" to JavaScript. A type system means you declare what kind of data a variable holds (a number, a text string, a list, a specific object shape), and the compiler warns you before you run the code if you try to use it the wrong way.

Real-world analogy: JavaScript is like sending an email without spell check. TypeScript adds spell check that also understands the grammar and meaning of your sentences. The extra safety catches bugs before they reach users.

---

### Every Page in the Frontend

#### Dashboard

**What the user sees**: Four large stat cards at the top (total feedback count, number of evidence clusters, average confidence percentage, percentage of feedback analysed), followed by a "Theme Rankings" table showing the top evidence themes sorted by feedback count, followed by a confidence distribution chart.

**What data it shows**: High-level summary statistics, a ranked list of themes, and how evidence is distributed across confidence bands.

**Where the data comes from**: It fetches from the `/api/v1/evidence` endpoint. If the API is unreachable, it falls back to four hardcoded evidence clusters so the dashboard always shows something useful.

---

#### Evidence Grid

**What the user sees**: A grid of expandable cards, one per evidence cluster. Each card shows the theme, confidence score, number of affected users, source breakdown (what percentage came from App Store vs Zendesk), trend indicator, and representative quotes. Clicking a card expands it to show linked feedback items with individual confidence scores.

**What data it shows**: All active evidence clusters with their full detail.

**Where the data comes from**: Fetches from `/api/v1/evidence`. Falls back to six hardcoded evidence clusters if the API is unavailable. The code has a validation guard (`isValidApiItem`) that checks whether the API response has the expected shape — if not, it uses the local fallback data instead.

---

#### Confidence Scores

**What the user sees**: A detailed breakdown of the confidence scoring system — which clusters fall in which confidence bands, and visualisations showing the distribution.

**What data it shows**: Confidence scores across evidence clusters, the three bands (auto-accept, LLM-validate, auto-reject), and statistics about each band.

**Where the data comes from**: Live evidence data from the API, combined with local calculations.

---

#### Agents

**What the user sees**: Four agent cards arranged in a pipeline flow: Ingestion → Evidence → Reasoning → Governance → Product Decisions. Each card shows the agent's name, description, current status (last run time), technical tags (Python, Lambda, etc.), and a "Run Agent" button. Below each card is an "Output" box showing what the agent most recently produced.

**What data it shows**: Live agent status (last run times, run counts) plus the most recent output from each agent.

**Where the data comes from**: The `/api/v1/agents/status` endpoint queries the database for the last time each Lambda function ran. Run counts are also queried from the database. The "Run" button calls `/api/v1/agents/{name}/run` which invokes the actual Lambda function.

---

#### Chat

**What the user sees**: A conversational chat interface with a text input at the bottom. The AI assistant responds to questions about the product's feedback data. There are suggested starter questions shown when the conversation is empty.

**What data it shows**: AI-generated responses grounded in the current evidence, recommendations, and governance data.

**Where the data comes from**: The `/api/v1/chat` endpoint, which queries the database for context and calls Nova Pro via Bedrock.

---

#### Data Studio

**What the user sees**: A data exploration workspace for examining raw feedback patterns, source breakdowns, and trend analysis.

**What data it shows**: Aggregated metrics about the feedback corpus.

**Where the data comes from**: Evidence and statistics endpoints.

---

#### Decision Playground

**What the user sees**: An interactive tool for simulating how different constraint settings (engineering capacity, sprint load, business priorities) would change the prioritisation of recommendations.

**What data it shows**: Recommendations re-scored under different constraint assumptions.

**Where the data comes from**: The constraints endpoint plus local recalculation.

---

#### Scenarios

**What the user sees**: Pre-built analytical scenarios — hypothetical situations ("what if we prioritise performance?") that show how the evidence would be interpreted differently under different strategic lenses.

**What data it shows**: Evidence filtered and re-sorted by scenario-specific rules.

---

### Import Sources Page

**What the user sees**: A full CSV upload system with four upload targets — App Store Reviews, Zendesk Tickets, Patient Portal Reviews, and Hospital Survey Tickets. Each target has a drag-and-drop file zone, a sample CSV download button, and a status badge showing connected/disconnected state.

**What happens when a file is uploaded**: A 14-second phased loading sequence runs through five stages — "Reading source file and validating format," "Running ingestion pipeline (dedup + PII redaction)," "Computing embeddings and clustering evidence," "Generating evidence insights (confidence scoring)," and "Finalising intelligence report." At the end, the source is marked as connected in localStorage and all pages immediately reflect the new data via `getActiveDataset()`.

**Why it exists**: The upload gate ensures users see the zero-state (empty charts, zero counts) until they have actually provided data. This proves the pipeline is genuinely data-driven rather than showing pre-populated numbers. localStorage persistence means connected sources survive navigation and page refresh without re-uploading.

---

### The Dual Dataset Demo System

Two complete mock datasets drive all pages simultaneously, selected by whichever CSV source type the user connects first.

**App Product Complaints** (547 items, 6 clusters, App Store 275 items + Zendesk 272 items):
Six clusters ranked by priority — app crashes on project switch, black screen after latest update, dashboard load regression, missing onboarding checklist, CSV export silent failure, and mobile notification delay. Confidence scores range from 91% down to 72%.

**Patient Hospital Survey** (310 items, 4 clusters, Patient Portal 155 items + Hospital Survey 155 items):
Four clusters — extended emergency wait times, online appointment booking failures, billing statement errors and confusion, and medical records portal access issues. Confidence scores range from 91% down to 72%.

**How the switch works**: `getActiveDataset()` from uploadState.ts returns `'app_product'` or `'hospital_survey'` based on which source types are connected. Every page reads this value and switches its data, metrics, chart values, cluster lists, and system context accordingly. No code change is needed between datasets — the same component renders entirely different domain data.

**Why this matters architecturally**: It proves the domain-agnostic claim. The same pipeline code — the same Lambda functions, the same confidence scoring formula, the same clustering algorithm — handles SaaS product feedback and hospital patient surveys without any domain-specific customisation.

---

### What the Smart Fallback System Is and Why It Exists

Every page that fetches data from the API has a fallback: if the API call fails (network error, backend down, database unavailable), the page automatically switches to locally defined mock data. This means the frontend always renders something sensible instead of showing a blank page or an error message.

Why does this matter? During development, a developer working on the frontend does not need a running backend to see how the UI looks. During a backend outage, users can still navigate the application and see the last-known data structure, even if the numbers are not live. The fallback system makes the frontend resilient and demo-ready at all times.

### What Tailwind CSS Is and Why Styling Is Done This Way

Traditional CSS involves writing a separate stylesheet file with class names like `.card { background: white; border-radius: 8px; padding: 16px; }`. Tailwind flips this: instead of writing CSS, you add utility class names directly to your HTML/JSX elements: `<div class="bg-white rounded-lg p-4">`.

This approach is faster for building UIs because you do not context-switch between files. Every element is styled where it is defined. Veloquity uses Tailwind with a custom set of CSS variables for colours that automatically switch between light and dark mode based on the user's preference.

---

## Chapter 8: How Deployment Works

### What "Deployment" Means in Simple Terms

Deployment is the process of taking code that works on your laptop and making it run on servers that other people can access over the internet. Every time you change the code, you need to deploy again to make the changes live.

### Why There Are Two Deployment Targets

Veloquity has two separate deployments because the frontend and backend are fundamentally different types of programs:

- **Frontend (React app)**: Runs in the user's browser. It is just HTML, CSS, and JavaScript files that need to be served quickly from a web server near the user.
- **Backend (FastAPI server)**: Runs on a server. It needs a Python runtime, database connections, and AWS credentials. It processes requests and returns data.

These two pieces have different requirements, and different hosting services are specialised for each.

### What Vercel Does and Why the Frontend Lives There

Vercel is a hosting platform specialised for frontend web applications. It automatically builds your React app whenever you push code to GitHub and serves it from servers around the world (a "CDN") so it loads quickly for users anywhere. It is free for small projects and handles HTTPS certificates automatically.

The `vercel.json` file tells Vercel two things: redirect all URL paths to `index.html` (because React handles its own routing inside the browser), and inject the backend URL as an environment variable at build time.

### What Render Does and Why the Backend Lives There

Render is a hosting platform for web services — programs that run on servers and respond to HTTP requests. It runs the FastAPI server (`uvicorn main:app --host 0.0.0.0 --port $PORT`) on a Linux server, keeps it running, and gives it a public URL.

The `render.yaml` file tells Render: where the Python code is (`api/`), how to install dependencies (`pip install -r requirements.txt`), how to start the server, and what environment variables to inject.

### What AWS Handles That Vercel and Render Don't

Vercel hosts the frontend. Render hosts the API server. But neither hosts:
- The database (that is RDS in AWS)
- The Lambda functions that process feedback (those live entirely in AWS)
- The AI models (Bedrock is AWS)
- File storage (S3 is AWS)
- Credentials (Secrets Manager is AWS)

The API server on Render is essentially a bridge between the browser and AWS — it receives requests from the frontend and translates them into database queries and Lambda invocations.

### What Happens When You Run the Deploy Script

Running `bash infra/deploy.sh dev` executes five steps:

```
Step 1: Package Lambda code
  → Zips each Lambda folder (ingestion/, evidence/, reasoning+lambda_reasoning/, governance/)
    into .build/*.zip files

Step 2: Upload to S3
  → Creates a deployment S3 bucket if it does not exist
  → Uploads the four zip files to s3://veloquity-deploy-dev-{account}/lambda/

Step 3: Validate CloudFormation template
  → Asks AWS to check cloudformation.yaml for syntax errors
  → Confirms the template is valid before touching anything

Step 4: Deploy CloudFormation stack
  → Creates or updates the entire AWS infrastructure
  → Lambda functions are updated with the new zip files
  → If this is the first deploy, RDS, S3 buckets, IAM roles, etc. are all created

Step 5: Run DB migrations
  → Connects to the RDS database with psql
  → Runs each SQL migration file in order (001 through 008)
  → Creates all tables if they do not exist
```

### What Environment Variables Are and Why They Are Not in the Code

An environment variable is a setting you pass to a program when you start it, from outside the program's code. Think of it like a note you hand to someone before they start work: "by the way, use this door code, connect to this database, use this API key."

Why not put them in the code? Three reasons:
1. **Security**: The database password would be visible to anyone who can read the source code. That includes anyone on GitHub if the repo is public.
2. **Flexibility**: The same code can connect to a development database in one environment and a production database in another, just by changing the environment variable — no code change needed.
3. **Separation of concerns**: Code describes behaviour. Configuration describes the environment the code runs in. They should be separate.

### What the .build/ Folder Is and Why Lambda Needs Zip Files

AWS Lambda does not accept a folder of Python files directly. It requires a zip archive containing all the code and dependencies. The `.build/` folder is where `deploy.sh` deposits the zip files after packaging each Lambda's folder.

After the deploy runs, these zip files are uploaded to S3, and Lambda is pointed to them. The `.build/` folder is temporary — it only matters during the deployment process.

### The SPA Rewrite Rule and Why It Prevents 404 Errors

The `frontend_final/vercel.json` contains a single rewrite rule: all URL paths map to `/index.html`. This is necessary because React Router handles navigation inside the browser. If a user visits `veloquity.vercel.app/chat` directly, Vercel sees a request for `/chat` — a path that does not correspond to any real file in the `dist/` folder. Without the rewrite rule, Vercel would return a 404. The rewrite tells Vercel: "serve `index.html` for every path, and let the JavaScript application figure out what to show."

### Cold Start Handling on Render Free Tier

Render's free tier spins a service down after 15 minutes of inactivity. The first request after a spin-down can take 20-40 seconds while the server wakes up. Veloquity handles this with a health-check retry system on the Agents and Chat pages: on page load, it immediately pings `/health` and retries up to 10 times at 3-second intervals if the server is not yet ready. During this period, the user sees a warming message ("Waking up inference engine… attempt 3/10") rather than a broken interface. Only once the health check succeeds does the page allow interactions.

---

## Chapter 9: The Multi-Agent System — How It All Connects

### What a Multi-Agent System Means in Simple Terms

A multi-agent system is a collection of specialised programs (agents) that each handle one part of a larger task and pass results to each other. Instead of one giant program that does everything, you have multiple smaller programs that cooperate.

Think of it like a well-run kitchen. There is a prep chef (cuts vegetables), a line cook (cooks dishes), a plating chef (presents food), a quality inspector (checks everything), and an expeditor (takes orders and answers questions). Each is specialised. Together, they produce something none could produce alone.

### Why Veloquity Uses 5 Agents Instead of One Big Program

**Specialisation**: Each agent does one thing well. The evidence agent knows everything about embeddings and clustering. The reasoning agent knows everything about scoring and prompting. Neither needs to know about the other's internals.

**Independent scaling**: During a surge of new feedback, you can run many ingestion agents in parallel without touching the reasoning logic.

**Independent updating**: You can improve the confidence scoring algorithm without touching the chat agent.

**Failure isolation**: If the reasoning agent has a bug, the ingestion and evidence pipeline still runs normally. Evidence keeps accumulating. When reasoning is fixed, it can process the backlog.

**Cost efficiency**: Agents only run when needed. The governance agent runs once daily. The reasoning agent runs on demand. You are not paying for a server that runs 24/7 just to do work that takes a few minutes per day.

### The Complete Data Flow — From Feedback to Recommendation

```
1. User submits feedback (App Store review or Zendesk ticket)
   ↓
2. INGESTION AGENT wakes up
   - Normalises the feedback format
   - Removes personal information
   - Checks for duplicates (SHA-256)
   - Stores unique items in S3
   ↓
3. EVIDENCE INTELLIGENCE AGENT runs
   - Reads items from S3
   - Converts each item to a 1024-number vector (via Titan Embed V2)
   - Groups similar vectors into clusters (greedy cosine clustering)
   - Scores confidence for each cluster
   - Auto-accepts (≥0.6), sends to AI validation (0.4–0.59), or rejects (<0.4)
   - Writes accepted clusters to the evidence table in PostgreSQL
   ↓
4. REASONING AGENT runs (on demand or scheduled)
   - Reads all active evidence from the database
   - Scores each cluster: confidence + user count + corroboration + recency
   - Builds a detailed prompt
   - Sends prompt to Nova Pro via Bedrock
   - Nova Pro returns ranked recommendations with explanations
   - Saves results to reasoning_runs table and S3
   ↓
5. GOVERNANCE AGENT runs daily at 6 AM
   - Flags evidence clusters not updated in 30+ days as stale
   - Promotes staging signals that have reached frequency ≥ 10
   - Checks embedding cache hit rate (cost monitoring)
   - Writes all actions to the append-only governance_log table
   ↓
6. PM opens the dashboard
   - Frontend fetches /api/v1/recommendations
   - Sees ranked recommendations backed by specific evidence
   - Can explore evidence grid, run agents manually, or ask the chat assistant
```

### What "Agentic" Means and Why It Matters

"Agentic" means the system takes autonomous action based on data — it is not just a passive query engine. The agents decide what to do (flag this cluster as stale, promote this signal, which recommendations to prioritise) without human instruction on each decision. The human sets the rules and thresholds; the agents apply them continuously and automatically.

This matters because a PM cannot manually review 5,000 feedback items every day. Agentic automation means the system is always up to date, always applying consistent rules, and always ready to show the latest picture.

### Why Each Agent Is a Separate Lambda Function

AWS Lambda allows you to deploy each agent independently (update the reasoning agent without redeploying the governance agent), run them in parallel (multiple ingestion agents can run simultaneously), and pay per execution (a daily governance run that takes 5 seconds costs almost nothing). Keeping them as separate Lambda functions is the architectural decision that makes all of these properties possible.

---

## Chapter 10: Key Design Decisions — Why Things Are Built This Way

### Why pgvector Instead of a Separate Vector Database Like Pinecone

Services like Pinecone are specialised vector databases designed to store and search embeddings. They are excellent tools, but they add another service to manage, another monthly bill, and another integration point where things can go wrong.

Veloquity already needs PostgreSQL for all its relational data (evidence clusters, governance log, reasoning runs). The `pgvector` extension adds vector storage and similarity search directly inside the existing database. One database to manage, one set of credentials, one backup system. For the scale Veloquity operates at (thousands of vectors, not billions), pgvector is more than fast enough.

### Why Nova Pro Instead of Claude

Claude (Anthropic's models) is a very capable AI model, but accessing it through AWS Bedrock in certain regions requires a valid payment method linked to AWS Marketplace subscriptions. This caused `INVALID_PAYMENT_INSTRUMENT` errors during testing in this environment. Amazon Nova Pro is a first-party AWS model that does not go through AWS Marketplace — it is available directly through Bedrock without the payment instrument requirement. For this deployment, Nova Pro is the pragmatic choice that actually works.

Nova Pro also uses a different API format from Claude: instead of `anthropic_version` and `max_tokens` at the top level, it uses `inferenceConfig.maxTokens` and a `system` field as a list of dicts. All code in Veloquity uses this Nova format.

### Why Regex for PII Instead of Amazon Comprehend

Amazon Comprehend is an AWS service that can detect PII using machine learning. It is more accurate than regular expressions for complex cases. However, it costs money per API call, requires network access, adds latency to every ingestion, and introduces a dependency on another external service.

For Veloquity's use case (removing obvious PII patterns like email addresses, phone numbers, and credit card numbers), regular expressions are sufficient, free, fast, and fully offline. The trade-off of slightly lower accuracy for complex PII is acceptable.

### Why the Evidence Lambda Runs Outside VPC But Reasoning Did Not (And What VPC Even Is)

A VPC (Virtual Private Cloud) is a private network inside AWS. Resources inside a VPC can talk to each other but are not directly accessible from the public internet. Putting a Lambda function inside a VPC gives it access to RDS (which is also inside the VPC) but restricts its access to public AWS services like Bedrock and S3.

The Reasoning Lambda was originally placed inside the VPC (probably to give it database access). But Bedrock and S3 are public AWS services that require internet access or VPC endpoints. Without the right VPC configuration, the Reasoning Lambda could not reach Bedrock — breaking its core function. The VpcConfig was removed from the Reasoning Lambda to allow it to reach Bedrock directly. Database access is handled through the connection pool which uses the RDS endpoint (which can be made accessible via RDS's own security group rules).

### Why Confidence Thresholds Are 0.4 and 0.6

These values create a three-band system: reject below 0.4, send to LLM for review between 0.4 and 0.6, auto-accept above 0.6.

The values were chosen as reasonable starting points based on the mathematical properties of cosine similarity clustering. A confidence score of 0.4 means the cluster has meaningful variance — the items are somewhat similar but not clearly the same issue. 0.6 means the items are clearly coherent. These are not magic numbers — they are configurable via the `CONFIDENCE_AUTO_REJECT` and `CONFIDENCE_AUTO_ACCEPT` environment variables and can be tuned as the system processes more feedback and operators learn what threshold values match their quality expectations.

### Why the Reasoning Zip Includes Both reasoning/ and lambda_reasoning/

AWS Lambda looks for a specific handler function in a specific module when it is invoked. CloudFormation configures the Reasoning Lambda with handler `lambda_reasoning.handler.handler`, which means: "in module `lambda_reasoning/handler.py`, find the function named `handler`."

The `lambda_reasoning/handler.py` file imports from the `reasoning/` package (`from reasoning.agent import run_agent`). For that import to work, the `reasoning/` folder must also be present in the Lambda's execution environment. The zip file is that environment. So both folders must be zipped together.

Previously, `deploy.sh` only zipped `reasoning/` which meant `lambda_reasoning/` was missing. The fix was to change the zip command to include both folders.

### Why RDS Is PubliclyAccessible True

In a production deployment, you would typically place RDS inside a VPC and only allow access from within that network — making it not publicly accessible. However, Veloquity's current deployment has `PubliclyAccessible: true` in CloudFormation. This is a development/MVP trade-off: it allows direct database connections from local machines (for running migrations, debugging, and the `run_migrations.py` script), without requiring a VPN or bastion host. In a hardened production environment, this should be changed to `false` with proper VPC networking configured.

### Why governance_log Is Append-Only

An audit log that can be edited is not really an audit log — it is just a table with a timestamp column. The value of an audit log comes entirely from its integrity: the guarantee that it records exactly what happened, in the order it happened, without modification.

Making `governance_log` append-only (enforced by application code that only ever inserts, never updates or deletes) means that even if a bug causes incorrect governance actions, the log faithfully records what occurred. Investigations, debugging, compliance reviews, and postmortems all depend on this guarantee. Once you allow deletion, that guarantee disappears.

### Why Mock Data Exists for the Demo Layer

AISPL (Amazon India) payment restrictions prevent Anthropic Claude models from being accessed via AWS Bedrock on Indian accounts. While the real pipeline uses Nova Pro (a first-party AWS model without this restriction), building a live demo that depends on real Bedrock calls would require the evaluator's AWS account to have the pipeline fully deployed. Mock data in the frontend solves this: it proves the concept visually with realistic data while the real AWS pipeline remains fully functional for actual deployments. The mock data is derived from real cluster structures (confidence formulas, source distributions, item counts) — it is not invented.

### Why Two Completely Different Datasets Exist in One Codebase

Having both an app product dataset and a hospital patient survey dataset in the same codebase proves the domain-agnostic claim in a way that words cannot. An evaluator who uploads App Store reviews and then uploads Hospital Survey tickets sees the same pipeline, the same pipeline code, and the same confidence scoring — producing entirely different insights for an entirely different domain. No keyword lists are domain-specific. No prompts mention products or hospitals. The system is genuinely agnostic.

### Why localStorage Is Used for Demo State Instead of a Backend

The demo layer (upload state, agent run timestamps, dataset selection) needs to work even when the Render backend is spinning up from cold start. localStorage provides instant reads and writes with zero network dependency, making every page load immediate. For the demo use case, persistence within a browser session is sufficient. A production system would use backend state, but for demonstrating the frontend UX, localStorage is correct and appropriate.

### Why the Guided Recommendation Flow Asks Three Questions Before Calling Nova Pro

Generic AI recommendations are easy to produce and easy to ignore. A recommendation that says "fix the crash" is obvious. A recommendation that says "given your goal of reducing Q2 churn, with one engineer for two weeks, and the constraint that you cannot modify the authentication service, here is a four-step plan targeting the crash cluster" is actionable. The three-question gathering step (goal, capacity, constraints) costs the user thirty seconds but produces a recommendation they can actually take to their engineering team. The enriched prompt includes cluster confidence, item count, and user context — giving Nova Pro enough specificity to produce a plan rather than a platitude.

---

*This guide was written from direct reading of the Veloquity source code. Every detail — confidence thresholds, scoring weights, API paths, table schemas, agent behaviours — is derived from the actual implementation, not from documentation or assumptions.*
