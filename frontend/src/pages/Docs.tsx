import { useEffect, useRef, useState } from 'react'

const SECTIONS = [
  { id: 'what-is', title: 'What is Veloquity' },
  { id: 'architecture', title: 'Four-Agent Architecture' },
  { id: 'evidence', title: 'Evidence Intelligence' },
  { id: 'recommendations', title: 'Recommendations' },
  { id: 'governance', title: 'Governance System' },
  { id: 'infrastructure', title: 'Infrastructure' },
  { id: 'decisions', title: 'Key Design Decisions' },
]

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-xl font-semibold text-slate-100 mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        {title}
      </h2>
      <div className="text-sm text-slate-300 leading-7 space-y-4">{children}</div>
    </section>
  )
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre
      className="rounded-lg p-4 text-xs font-mono text-slate-300 overflow-auto my-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {children}
    </pre>
  )
}

export default function Docs() {
  const [activeSection, setActiveSection] = useState('what-is')
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length > 0) setActiveSection(visible[0].target.id)
      },
      { rootMargin: '-20% 0px -70% 0px' }
    )
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="flex gap-8" style={{ maxHeight: 'calc(100vh - 80px)' }}>
      {/* Table of contents */}
      <aside
        className="w-56 flex-shrink-0 sticky top-0 self-start pt-1"
        style={{ maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}
      >
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Contents</p>
        <nav className="space-y-0.5">
          {SECTIONS.map(({ id, title }) => (
            <a
              key={id}
              href={`#${id}`}
              className="block py-1.5 px-3 text-xs rounded-lg transition-all"
              style={{
                color: activeSection === id ? '#93C5FD' : '#64748B',
                background: activeSection === id ? 'rgba(59,130,246,0.1)' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {title}
            </a>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto pr-2">
        <Section id="what-is" title="What is Veloquity">
          <p>
            Veloquity is an agentic evidence intelligence system built on AWS. It solves a problem that affects every
            product team at scale: raw feedback is abundant, but actionable signal is rare. As teams grow and ship more,
            the volume of user feedback — reviews, support tickets, survey responses — grows faster than any team can
            manually process. Important patterns get buried. Critical bugs reported by dozens of users go unnoticed.
            High-confidence signals are treated the same as one-off noise.
          </p>
          <p>
            Veloquity closes this gap by automating the entire path from raw feedback to prioritised, explainable
            recommendations. It ingests feedback from multiple sources, uses semantic AI to extract and cluster
            evidence themes, reasons over those themes with a configurable priority formula, and delivers ranked
            product recommendations that a PM can act on immediately. The system maintains itself autonomously —
            detecting when evidence goes stale, promoting emerging signals, and monitoring its own cost efficiency.
          </p>
        </Section>

        <Section id="architecture" title="Four-Agent Architecture">
          <p>
            Veloquity operates as four specialised Lambda agents, each with a single responsibility. They communicate
            through shared PostgreSQL state rather than direct API calls, which makes each agent independently
            testable and replaceable.
          </p>
          <p>
            The <strong className="text-slate-100">Ingestion Agent</strong> is the system's entry point. It accepts
            raw feedback payloads from App Store reviews and Zendesk tickets, applies PII redaction via deterministic
            regex patterns (covering emails, phone numbers, SSNs, IPs, and credit cards), normalises each item into
            a common schema, computes a SHA-256 hash on the cleaned text for deduplication, and writes unique items
            to S3 with date-partitioned keys. The dedup table tracks how many times identical feedback recurs —
            this frequency count is a primary signal for the Governance Agent.
          </p>
          <p>
            The <strong className="text-slate-100">Evidence Intelligence Agent</strong> transforms raw feedback into
            structured evidence. It reads items from S3, computes 1024-dimensional semantic embeddings via Amazon
            Bedrock Titan Embed V2 (with a PostgreSQL cache to avoid redundant API calls), clusters items using a
            greedy cosine similarity algorithm, scores each cluster's confidence, and routes clusters above threshold
            to the evidence table. Every accepted evidence cluster records which raw feedback items contributed to it
            via the <code className="font-mono text-xs">evidence_item_map</code> table.
          </p>
          <p>
            The <strong className="text-slate-100">Reasoning Agent</strong> operates on confirmed evidence clusters.
            It fetches all active clusters, applies a deterministic priority scoring formula, builds a structured
            prompt with the ranked evidence, and calls Claude 3 Haiku via Bedrock to generate ranked recommendations
            with effort estimates, impact assessments, tradeoff explanations, and risk flags. Every run is persisted
            in the <code className="font-mono text-xs">reasoning_runs</code> table for full reproducibility.
          </p>
          <p>
            The <strong className="text-slate-100">Governance Agent</strong> runs daily at 06:00 UTC via EventBridge.
            Unlike the other agents, it uses pure decision-tree logic with no LLM calls — making it deterministic,
            auditable, and free of per-invocation AI cost. It flags evidence older than 30 days as stale, promotes
            staging clusters whose frequency has exceeded the threshold into active evidence, and monitors the
            embedding cache hit rate. Every governance action is written to an immutable audit log.
          </p>
        </Section>

        <Section id="evidence" title="How Evidence Intelligence Works">
          <p>
            Evidence extraction works in three stages: embedding, clustering, and confidence scoring. Each stage has
            a specific design choice that prioritises correctness and explainability over complexity.
          </p>
          <p>
            <strong className="text-slate-100">Embedding</strong> converts feedback text into 1024-dimensional
            vectors using Amazon Bedrock Titan Embed V2. To minimise API cost, a PostgreSQL cache table keyed on
            <code className="font-mono text-xs"> (content_hash, model_version)</code> stores computed vectors.
            On a second run over the same corpus, cache hit rates reach 100% — zero Bedrock calls. The model version
            is part of the cache key, so upgrading the embedding model automatically invalidates the cache without
            any manual intervention.
          </p>
          <p>
            <strong className="text-slate-100">Clustering</strong> uses a greedy single-pass algorithm rather than
            HNSW approximate nearest-neighbour. For each item, cosine similarity is computed against every existing
            cluster centroid. The item joins the highest-similarity cluster if its score meets the threshold (0.75),
            or seeds a new cluster. The centroid is updated as a running mean after each assignment. Clusters smaller
            than five items are discarded. This O(N×C) approach is deterministic, requires no ML libraries, and
            runs in under one second at MVP scale.
          </p>
          <p>
            <strong className="text-slate-100">Confidence scoring</strong> measures how tight a cluster is.
          </p>
          <CodeBlock>{`For each item vector v in the cluster:
    distance = 1 - cosine_similarity(v, centroid)
variance = mean(distances)
confidence = clamp(1.0 - variance * 2.0, 0.0, 1.0)`}</CodeBlock>
          <p>
            Clusters scoring below 0.40 are auto-rejected to the staging table. Clusters between 0.40 and 0.60
            are validated by a secondary LLM call. Clusters above 0.60 are auto-accepted to the evidence table.
          </p>
        </Section>

        <Section id="recommendations" title="How Recommendations Are Generated">
          <p>
            Before calling the LLM, each evidence cluster is scored by a deterministic priority formula. This
            pre-scoring step is deliberate: it ensures that when a PM asks "why is this ranked first?", the answer
            is a mathematical formula they can inspect and challenge — not an opaque model output.
          </p>
          <CodeBlock>{`priority_score = (
    confidence_score       × 0.35   # cluster quality
    + normalized_user_count × 0.25   # volume (capped at 50 users = 1.0)
    + source_corroboration  × 0.20   # cross-source signal
    + recency_score         × 0.20   # linear decay over 90 days
)`}</CodeBlock>
          <p>
            Source corroboration rewards clusters that appear in both App Store and Zendesk — a theme reported
            by multiple channels is more likely a real product problem than source-specific noise. Recency score
            decays linearly to zero over 90 days, ensuring old signals don't perpetually dominate rankings.
          </p>
          <p>
            The scored evidence is assembled into a structured prompt and sent to Claude 3 Haiku via Amazon Bedrock.
            The model receives the full ranked evidence list plus an explicit JSON schema for its output. It is
            instructed to return only valid JSON with no preamble — the response is parsed directly without
            a secondary extraction step. The output schema includes the recommendation rank, theme, concrete
            recommended action, effort estimate, user impact rating, tradeoff explanation, risk flags, and
            cross-cluster relationships.
          </p>
        </Section>

        <Section id="governance" title="Governance System">
          <p>
            The Governance Agent is responsible for keeping the evidence store accurate and the system cost-efficient
            over time. It runs on a fixed daily schedule and applies three deterministic checks.
          </p>
          <p>
            <strong className="text-slate-100">Stale detection</strong> queries evidence that has not been validated
            in 30 days and updates its status to 'stale'. Stale evidence is excluded from Reasoning Agent queries.
            This prevents outdated signals — bugs fixed in old releases, resolved complaints — from continuing to
            generate recommendations.
          </p>
          <p>
            <strong className="text-slate-100">Signal promotion</strong> promotes low-confidence staging clusters
            whose frequency has crossed the threshold (default: 10 recurrences). A low-confidence cluster that
            appears repeatedly is likely a real pattern that the initial confidence threshold missed. Promotion
            moves it to the active evidence table with a best-effort item map populated from the dedup index.
          </p>
          <p>
            <strong className="text-slate-100">Cost monitoring</strong> computes the embedding cache hit rate
            by comparing embedding cache rows to active evidence rows. If the ratio falls below 40%, an alert
            is written to the governance log. This typically signals that the embedding model was changed (cache
            invalidated) or that a large new batch of unique feedback was ingested without a corresponding
            cache warm-up.
          </p>
        </Section>

        <Section id="infrastructure" title="Infrastructure">
          <p>
            Veloquity is built entirely on AWS managed services. The choices prioritise operational simplicity
            and cost at MVP scale over maximum performance.
          </p>
          <p>
            <strong className="text-slate-100">AWS Lambda</strong> handles all compute. Each agent is a
            separate Lambda function with its own IAM role and minimum permissions. This provides natural
            isolation: a Reasoning Agent failure cannot corrupt ingestion state.
          </p>
          <p>
            <strong className="text-slate-100">Amazon RDS PostgreSQL (t2.micro)</strong> with the pgvector
            extension is the single database for all persistent state — evidence, embeddings, dedup index,
            staging, governance log, and item provenance. Using one database eliminates cross-service query
            complexity and avoids the $172/month floor cost of OpenSearch Serverless.
          </p>
          <p>
            <strong className="text-slate-100">Amazon Bedrock</strong> provides both embedding (Titan Embed V2)
            and reasoning (Claude 3 Haiku). Both are on-demand with no reserved capacity required at MVP scale.
            Using Haiku over Sonnet reduces reasoning cost by roughly 90% with acceptable quality for structured
            recommendation output.
          </p>
          <p>
            <strong className="text-slate-100">Amazon S3</strong> stores raw normalized feedback as
            date-partitioned JSON objects, making the data Athena-queryable without a schema change. The reports
            bucket hosts the daily HTML governance report.
          </p>
          <p>
            <strong className="text-slate-100">AWS Secrets Manager</strong> holds database credentials.
            No credentials are hardcoded in any Lambda function. Rotation is supported without any code change.
          </p>
        </Section>

        <Section id="decisions" title="Key Design Decisions">
          <p>
            Several decisions deviated from the original architectural specification. Each deviation was made for
            a specific, documented reason.
          </p>
          <p>
            <strong className="text-slate-100">Regex PII over AWS Comprehend.</strong> Comprehend charges per
            character. For product feedback at MVP volume, deterministic regex patterns covering the six most
            common PII types are both cheaper and faster, with no network round-trip required.
          </p>
          <p>
            <strong className="text-slate-100">pgvector over OpenSearch Serverless.</strong> OpenSearch Serverless
            has a $172/month minimum cost regardless of usage. pgvector on the existing RDS instance adds $0
            incremental cost while supporting HNSW indexing, temporal queries, and JSONB filtering in one database.
          </p>
          <p>
            <strong className="text-slate-100">PostgreSQL embedding cache over Redis.</strong> A
            <code className="font-mono text-xs"> (content_hash, model_version)</code> lookup table in PostgreSQL
            provides the same functionality as Redis for this access pattern — keyed lookups on immutable data —
            without requiring an additional managed service or VPC endpoint.
          </p>
          <p>
            <strong className="text-slate-100">Deterministic priority scorer before LLM.</strong> The original
            spec called for a ReAct tool-calling loop where the agent dynamically decides which evidence to
            fetch. The deterministic scorer was chosen because it produces an auditable score card: a PM can
            look at a recommendation's rank and see exactly why it ranked above another.
          </p>
          <p>
            <strong className="text-slate-100">No VPC for Lambda functions.</strong> CloudFormation placed
            all Lambda functions in a private VPC for RDS access. The RDS instance has a public endpoint,
            so VPC placement was unnecessary and blocked all outbound calls to Bedrock, Secrets Manager,
            and S3 (no NAT Gateway was provisioned). All Lambdas were moved to default AWS networking.
          </p>
        </Section>
      </div>
    </div>
  )
}
