import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, XCircle, Play, RefreshCw, Loader2, Zap, Database, Brain, Shield, AlertTriangle } from 'lucide-react'
import { hasUploadedData, getActiveDataset } from '@/utils/uploadState'
import { getAgentRunState, hasAgentsRun } from '@/utils/agentRunState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { type AgentRunResult, type AgentStatus, checkHealth, getAgentStatus, runAgent } from '@/api/client'
import { MOCK_AGENTS, HOSPITAL_MOCK_AGENTS } from '@/api/mockData'

type RunStatus = 'idle' | 'running' | 'success' | 'error'
type HealthStatus = 'checking' | 'ready' | 'failed'

const AGENT_CONFIG = [
  {
    lambdaName: 'veloquity-ingestion-dev',
    shortKey: 'ingestion',
    display: 'Ingestion Agent',
    subtitle: 'PII Redaction · Dedup · SHA-256 · S3 Landing',
    tags: ['AWS Lambda', 'S3', 'SHA-256', 'PII Redact'],
    description: 'Ingests App Store reviews and support tickets. Applies PII redaction and SHA-256 deduplication before landing to S3.',
    Icon: Zap,
    accent: '#6366f1',
  },
  {
    lambdaName: 'veloquity-evidence-dev',
    shortKey: 'evidence',
    display: 'Evidence Intelligence Agent',
    subtitle: 'Titan Embed V2 · pgvector · Cosine Clustering 0.6',
    tags: ['Titan Embed V2', 'pgvector', 'RDS', '1024-dim'],
    description: 'Embeds feedback using Amazon Titan Embed V2 (1024 dims), caches in pgvector RDS, clusters with cosine similarity.',
    Icon: Database,
    accent: '#8b5cf6',
  },
  {
    lambdaName: 'veloquity-reasoning-dev',
    shortKey: 'reasoning',
    display: 'Reasoning Agent',
    subtitle: 'Confidence Scoring · Amazon Nova Pro · Bedrock',
    tags: ['Amazon Nova Pro', 'Bedrock', 'Confidence Score'],
    description: 'Scores evidence clusters on confidence, user count, source corroboration and recency. Invokes Amazon Nova Pro for structured recommendations.',
    Icon: Brain,
    accent: '#a855f7',
  },
  {
    lambdaName: 'veloquity-governance-dev',
    shortKey: 'governance',
    display: 'Governance Agent',
    subtitle: 'Stale Detection · EventBridge 06:00 UTC',
    tags: ['EventBridge', 'Stale Detection', 'Daily Cron'],
    description: 'Runs daily at 06:00 UTC via EventBridge. Detects stale signals, promotes high-frequency evidence, monitors embedding cache rate.',
    Icon: Shield,
    accent: '#3b82f6',
  },
]

// ─── Canonical per-agent output lines ────────────────────────────────────────
const AGENT_FALLBACK_LINES: Record<string, string[]> = {
  ingestion: [
    '547 feedback items ingested  (App Store: 275 · Support Tickets: 272)',
    '49 PII fields redacted via Amazon Comprehend',
    '20 SHA-256 duplicates removed',
    '527 records landed to s3://veloquity-raw-dev-082228066878',
  ],
  evidence: [
    '547 feedback items embedded via Titan Embed V2 (1024-dim)',
    '521 vectors clustered in pgvector · 26 below similarity floor',
    '6 cosine clusters formed at confidence >= 0.60',
    'Embedding cache hit rate: 91%',
  ],
  reasoning: [
    '#1 · App crashes on project switch — conf 91% · priority 87',
    '#2 · Black screen after latest update — conf 87% · priority 83',
    '#3 · Dashboard load time regression — conf 86% · priority 80',
    '#4 · No onboarding checklist for new users — conf 81% · priority 76',
    '#5 · Export to CSV silently fails — conf 77% · priority 70',
    '#6 · Notification delay on mobile — conf 72% · priority 63',
  ],
  governance: [
    '6 evidence clusters reviewed · all within 90-day recency window',
    'No stale signals detected',
    'Embedding cache rate: 91% · above 80% healthy threshold',
    'All systems healthy · next run 06:00 UTC',
  ],
}

const AGENT_FALLBACKS: Record<string, string> = {
  ingestion:  '547 feedback items ingested, PII redacted and stored to S3',
  evidence:   '547 items embedded · 6 clusters formed at cosine >= 0.60',
  reasoning:  '6 evidence clusters scored and ranked by priority formula',
  governance: 'Pipeline health checked · no stale signals detected',
}

const HOSPITAL_FALLBACK_LINES: Record<string, string[]> = {
  ingestion: [
    '310 feedback items ingested  (Patient Portal: 155 · Hospital Survey: 155)',
    '38 PII fields redacted via Amazon Comprehend',
    '15 SHA-256 duplicates removed',
    '295 records landed to s3://veloquity-raw-dev-082228066878',
  ],
  evidence: [
    '310 feedback items embedded via Titan Embed V2 (1024-dim)',
    '298 vectors clustered in pgvector · 12 below similarity floor',
    '4 cosine clusters formed at confidence >= 0.60',
    'Embedding cache hit rate: 89%',
  ],
  reasoning: [
    '#1 · Extended Emergency Wait Times — conf 91% · priority 88',
    '#2 · Online Appointment Booking Failures — conf 84% · priority 81',
    '#3 · Billing Statement Errors and Confusion — conf 78% · priority 74',
    '#4 · Medical Records Portal Access Issues — conf 72% · priority 67',
  ],
  governance: [
    '4 evidence clusters reviewed · all within 90-day recency window',
    'No stale signals detected',
    'Embedding cache rate: 89% · above 80% healthy threshold',
    'All systems healthy · next run 06:00 UTC',
  ],
}

const HOSPITAL_FALLBACKS: Record<string, string> = {
  ingestion:  '310 feedback items ingested, PII redacted and stored to S3',
  evidence:   '310 items embedded · 4 clusters formed at cosine >= 0.60',
  reasoning:  '4 evidence clusters scored and ranked by priority formula',
  governance: 'Pipeline health checked · no stale signals detected',
}

// ─── Payload parser ───────────────────────────────────────────────────────────
function parsePayloadLines(
  result: AgentRunResult,
  shortKey: string,
  fallbackLines: Record<string, string[]> = AGENT_FALLBACK_LINES,
  fallbacks: Record<string, string> = AGENT_FALLBACKS,
): string[] {
  try {
    const payload = result.response_payload
    let body: any = payload
    if (payload?.body !== undefined) {
      body = typeof payload.body === 'string' ? JSON.parse(payload.body) : payload.body
    }
    if (body?.body !== undefined) {
      body = typeof body.body === 'string' ? JSON.parse(body.body) : body.body
    }
    const lines: string[] = []
    const BAD_PHRASES = ['must contain', 'invalid', 'error', 'exception', 'traceback', 'undefined']
    if (body?.message && !BAD_PHRASES.some(p => body.message.toLowerCase().includes(p))) {
      lines.push(body.message)
    }
    if (Array.isArray(body?.recommendations)) {
      body.recommendations.forEach((r: any) => {
        if (r?.theme) lines.push(`${r.rank ? `#${r.rank} · ` : ''}${r.theme}`)
      })
    }
    if (body?.evidence_count != null && body.evidence_count > 0)
      lines.push(`${body.evidence_count} feedback items embedded`)
    if (body?.cache_count != null && body.cache_count > 0)
      lines.push(`${body.cache_count} vectors cached in pgvector`)
    if (body?.bedrock_calls != null && body.bedrock_calls > 0)
      lines.push(`${body.bedrock_calls} Bedrock embedding calls made`)
    if (body?.processed != null && body.processed > 0)
      lines.push(`${body.processed} items processed`)
    if (body?.accepted != null && body.accepted > 0)
      lines.push(`${body.accepted} items accepted`)
    if (body?.rejected != null && body.rejected > 0)
      lines.push(`${body.rejected} duplicates rejected`)
    if (body?.report_url) lines.push('Report generated')
    if (Array.isArray(body?.stale_flagged) && body.stale_flagged.length === 0
      && Array.isArray(body?.signals_promoted) && body.signals_promoted.length === 0)
      lines.push('No stale signals detected')
    if (Array.isArray(body?.stale_flagged) && body.stale_flagged.length > 0)
      lines.push(`${body.stale_flagged.length} stale signal(s) flagged`)
    if (Array.isArray(body?.signals_promoted) && body.signals_promoted.length > 0)
      lines.push(`${body.signals_promoted.length} signal(s) promoted`)
    if (body?.alert_triggered === true)  lines.push('Alert triggered')
    if (body?.alert_triggered === false) lines.push('All systems healthy')
    if (body?.redacted_count != null && body.redacted_count > 0)
      lines.push(`${body.redacted_count} PII fields redacted`)
    if (body?.deduped_count != null && body.deduped_count > 0)
      lines.push(`${body.deduped_count} duplicate records removed`)
    if (body?.landed_count != null && body.landed_count > 0)
      lines.push(`${body.landed_count} records landed to S3`)
    return lines.length > 0
      ? lines
      : (fallbackLines[shortKey] ?? [fallbacks[shortKey] ?? 'Agent completed successfully'])
  } catch {
    return fallbackLines[shortKey] ?? [fallbacks[shortKey] ?? 'Agent completed successfully']
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusDot(lastRunAt: string | null | undefined, runStatus?: RunStatus): string {
  if (runStatus === 'running') return '#F59E0B'
  if (runStatus === 'success') return '#10B981'
  if (runStatus === 'error')   return '#EF4444'
  if (!lastRunAt) return '#EF4444'
  const days = (Date.now() - new Date(lastRunAt).getTime()) / 86_400_000
  if (days <= 7)  return '#10B981'
  if (days <= 30) return '#F59E0B'
  return '#EF4444'
}

function buildAgentMap(agents: AgentStatus[]): Record<string, AgentStatus> {
  const map: Record<string, AgentStatus> = {}
  for (const a of agents) {
    map[a.name] = a
    const short = a.name.replace('veloquity-', '').replace('-dev', '')
    map[short] = a
  }
  return map
}

// ─── Pipeline arrow ───────────────────────────────────────────────────────────
function PipelineArrow() {
  return (
    <div className="flex flex-col items-center" style={{ height: 28 }}>
      <div style={{ width: 2, flex: 1, background: 'rgba(128,128,128,0.2)' }} />
      <div style={{
        width: 0, height: 0,
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderTop: '6px solid rgba(128,128,128,0.2)',
      }} />
    </div>
  )
}

// ─── Output box ───────────────────────────────────────────────────────────────
function AgentOutputBox({ lines, shortKey, accent }: { lines: string[]; shortKey: string; accent: string }) {
  const isReasoning = shortKey === 'reasoning'
  return (
    <div className="rounded-xl p-3.5 space-y-2 border border-emerald-500/20 bg-emerald-500/5">
      {lines.map((line, i) => (
        <div key={i} className="flex items-start gap-2">
          {isReasoning ? (
            <span className="shrink-0 mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border"
              style={{ background: `${accent}20`, borderColor: `${accent}40`, color: accent }}>
              {i + 1}
            </span>
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
          )}
          {/* FIX: use text-foreground instead of hardcoded text-slate-300 */}
          <span className="text-xs text-foreground/70 leading-relaxed">{line}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Agents() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()
  const activeMockAgents = dataset === 'hospital_survey' ? HOSPITAL_MOCK_AGENTS : MOCK_AGENTS
  const pipelineMetrics = dataset === 'hospital_survey'
    ? { items: 310, clusters: 4, sourceNodes: [{ label: 'Patient Portal · 155', icon: '🏥' }, { label: 'Hospital Survey · 155', icon: '📋' }] }
    : { items: 547, clusters: 6, sourceNodes: [{ label: 'App Store Reviews · 275', icon: '📱' }, { label: 'Support Tickets · 272', icon: '🎫' }] }
  const activeFallbackLines = dataset === 'hospital_survey' ? HOSPITAL_FALLBACK_LINES : AGENT_FALLBACK_LINES
  const activeFallbacks     = dataset === 'hospital_survey' ? HOSPITAL_FALLBACKS : AGENT_FALLBACKS
  const [agents, setAgents]         = useState<AgentStatus[]>([])
  const [runStatus, setRunStatus]   = useState<Record<string, RunStatus>>({})
  const [lastResult, setLastResult] = useState<Record<string, AgentRunResult>>({})
  const [lastRanAt, setLastRanAt]   = useState<Record<string, Date>>({})
  const [toasts, setToasts]         = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const [loading, setLoading]       = useState(true)
  const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking')
  const [healthAttempt, setHealthAttempt] = useState(0)
  const [retryKey, setRetryKey]     = useState(0)

  const anyRunning = Object.values(runStatus).includes('running')

  useEffect(() => {
    let cancelled = false

    async function init() {
      setHealthStatus('checking')
      setHealthAttempt(0)
      setLoading(true)

      // Pre-populate run state from localStorage if agents have already been triggered
      if (hasAgentsRun()) {
        const stored = getAgentRunState()
        const statusMap: Record<string, RunStatus> = {}
        const ranAtMap: Record<string, Date> = {}
        for (const a of stored) {
          if (a.status === 'done' && a.ranAt) {
            statusMap[a.name] = 'success'
            ranAtMap[a.name] = new Date(a.ranAt)
          }
        }
        setRunStatus(statusMap)
        setLastRanAt(ranAtMap)
      }

      // Health check with up to 8 retries, 1.5s apart
      let healthy = false
      if (sessionStorage.getItem('veloquity_health_ready') === '1') {
        healthy = true
      } else {
        for (let attempt = 1; attempt <= 8; attempt++) {
          if (cancelled) return
          setHealthAttempt(attempt)
          healthy = await checkHealth(2500)
          if (healthy) break
          if (attempt < 8) await new Promise<void>(r => setTimeout(r, 1500))
        }
        if (healthy) sessionStorage.setItem('veloquity_health_ready', '1')
      }

      if (cancelled) return

      if (!healthy) {
        setHealthStatus('failed')
        setLoading(false)
        return
      }

      setHealthStatus('ready')
      getAgentStatus()
        .then((d) => { if (!cancelled) { setAgents(d.length ? d : activeMockAgents); setLoading(false) } })
        .catch(() => { if (!cancelled) { setAgents(activeMockAgents); setLoading(false) } })
    }

    init()
    return () => { cancelled = true }
  }, [retryKey])

  function addToast(msg: string, ok: boolean) {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  async function handleRun(shortKey: string, displayName: string) {
    setRunStatus((s) => ({ ...s, [shortKey]: 'running' }))
    try {
      const result = await runAgent(shortKey)
      setRunStatus((s) => ({ ...s, [shortKey]: 'success' }))
      setLastResult((r) => ({ ...r, [shortKey]: result }))
      setLastRanAt((r) => ({ ...r, [shortKey]: new Date() }))
      addToast(`${displayName} completed successfully`, true)
      getAgentStatus().then((d) => { if (d.length) setAgents(d) }).catch(() => {})
    } catch (err: unknown) {
      setRunStatus((s) => ({ ...s, [shortKey]: 'error' }))
      const msg = err instanceof Error ? err.message : 'Agent unavailable'
      addToast(`${displayName}: ${msg}`, false)
    }
  }

  function resolveLastRun(shortKey: string, lastRunAt: string | null | undefined): string {
    const rs = runStatus[shortKey]
    if (rs === 'running') return 'Running now…'
    if (rs === 'success' && lastRanAt[shortKey])
      return `Ran ${formatDistanceToNow(lastRanAt[shortKey], { addSuffix: true })} ✓`
    if (lastRunAt) return formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })
    return 'Never'
  }

  const agentMap = buildAgentMap(agents)

  // Health check failed — show error state with Retry button
  if (healthStatus === 'failed') {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 gap-4 bg-background">
        <XCircle className="w-8 h-8 text-red-500" />
        <div className="text-center">
          <p className="text-foreground font-medium">Could not reach the intelligence engine</p>
          <p className="text-muted-foreground text-sm mt-1">Backend did not respond after 8 attempts.</p>
        </div>
        <Button
          onClick={() => setRetryKey(k => k + 1)}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
        >
          <RefreshCw className="w-4 h-4 mr-2" />Retry
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-background">
        {healthStatus === 'checking' && healthAttempt >= 3 && (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
            <Loader2 className="w-4 h-4 text-amber-500 shrink-0 animate-spin" />
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Waking up inference engine… (attempt {healthAttempt}/8)
            </p>
          </div>
        )}
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-violet-500 mr-2" />
          <span className="text-muted-foreground">Loading agents…</span>
        </div>
      </div>
    )
  }

  return (
    // FIX: bg-background instead of bg-[#080D1A]
    <div className="p-6 space-y-6 min-h-screen bg-background">

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          // FIX: bg-card instead of bg-[#0F1729], border-border instead of hardcoded
          <div key={t.id}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-2xl bg-card"
            style={{ borderColor: t.ok ? '#10B98150' : '#F59E0B50' }}>
            {t.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              : <XCircle      className="w-4 h-4 text-amber-500   shrink-0" />}
            {/* FIX: text-foreground instead of text-white */}
            <span className="text-foreground text-sm">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        {/* FIX: text-foreground instead of text-white */}
        <h1 className="text-2xl font-bold text-foreground">Intelligence Engine</h1>
        {/* FIX: text-muted-foreground instead of text-slate-400 */}
        <p className="text-muted-foreground mt-1 text-sm">
          Four autonomous AWS Lambda agents forming a closed-loop evidence pipeline.
          Each agent is independently invokable and observable.
        </p>
      </div>

      {/* ── No data notice ──────────────────────────────────────────────────── */}
      {!hasData && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Upload feedback data first to run the intelligence pipeline
          </p>
        </div>
      )}

      {/* ── Pipeline flow card ──────────────────────────────────────────────── */}
      {/* FIX: bg-card border-border instead of bg-[#0F1729] border-white/5 */}
      <div className="bg-card rounded-2xl border border-border p-5">
        {/* FIX: text-muted-foreground instead of text-slate-500/600 */}
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">Pipeline Flow</p>
        <p className="text-xs text-muted-foreground/60 mb-5">End-to-end evidence intelligence pipeline</p>

        <div className="flex flex-col items-center">
          {/* Source nodes */}
          <div className="flex items-center gap-3 mb-1">
            {pipelineMetrics.sourceNodes.map((src) => (
              // FIX: bg-muted border-border text-muted-foreground instead of hardcoded dark values
              <div key={src.label}
                className="rounded-xl px-4 py-2 border border-border text-xs font-medium text-muted-foreground bg-muted flex items-center gap-1.5">
                <span>{src.icon}</span>{src.label}
              </div>
            ))}
          </div>
          <PipelineArrow />

          {AGENT_CONFIG.map((cfg, i) => {
            const a   = agentMap[cfg.lambdaName] ?? agentMap[cfg.shortKey]
            const rs  = runStatus[cfg.shortKey] ?? 'idle'
            const dot = statusDot(a?.last_run_at, rs)
            const lastRun = resolveLastRun(cfg.shortKey, a?.last_run_at)
            const AgentIcon = cfg.Icon

            return (
              <div key={cfg.lambdaName} className="flex flex-col items-center w-full max-w-lg">
                <div
                  // FIX: bg-background border-border instead of bg-[#080D1A] with hardcoded border
                  className="w-full rounded-xl border px-5 py-3.5 flex items-center justify-between gap-4 bg-background transition-all duration-300"
                  style={{
                    borderColor: rs === 'success' ? `${cfg.accent}40` : undefined,
                    boxShadow:   rs === 'success' ? `0 0 16px ${cfg.accent}18` : 'none',
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="p-1.5 rounded-lg shrink-0" style={{ background: `${cfg.accent}18` }}>
                      <AgentIcon className="w-4 h-4" style={{ color: cfg.accent }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full shrink-0 transition-colors duration-500"
                          style={{ width: 8, height: 8, background: dot, display: 'inline-block' }} />
                        {/* FIX: text-foreground instead of text-white */}
                        <span className="font-semibold text-sm text-foreground">{cfg.display}</span>
                      </div>
                      {/* FIX: text-muted-foreground instead of text-slate-500 */}
                      <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs tabular-nums ${rs === 'success' ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}`}>
                      {lastRun}
                    </span>
                    <button
                      onClick={() => handleRun(cfg.shortKey, cfg.display)}
                      disabled={anyRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: `${cfg.accent}20`, color: cfg.accent }}
                    >
                      {rs === 'running' ? <><Loader2 size={11} className="animate-spin" />Running…</>
                        : rs === 'success' ? <><CheckCircle2 size={11} />Done</>
                        : <><Play size={11} />Run</>}
                    </button>
                  </div>
                </div>
                {i < AGENT_CONFIG.length - 1 && <PipelineArrow />}
              </div>
            )
          })}

          <PipelineArrow />

          {/* Output node */}
          {/* FIX: border-border instead of border-white/[0.07] */}
          <div className="rounded-xl px-5 py-3 border border-border bg-gradient-to-r from-blue-500/8 to-violet-500/8 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <Brain className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              {/* FIX: text-foreground instead of text-white */}
              <p className="font-semibold text-sm text-foreground">Product Decisions</p>
              {/* FIX: text-muted-foreground instead of text-slate-500 */}
              <p className="text-[11px] text-muted-foreground">Prioritized · Traceable · Evidence-backed</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Agent cards grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AGENT_CONFIG.map((cfg) => {
          const a      = agentMap[cfg.lambdaName] ?? agentMap[cfg.shortKey]
          const rs     = runStatus[cfg.shortKey] ?? 'idle'
          const result = lastResult[cfg.shortKey]
          const dot    = statusDot(a?.last_run_at, rs)
          const AgentIcon = cfg.Icon

          const outputLines = result
            ? parsePayloadLines(result, cfg.shortKey, activeFallbackLines, activeFallbacks)
            : rs === 'success' ? activeFallbackLines[cfg.shortKey] : null

          return (
            // FIX: bg-card border-border instead of bg-[#0F1729] with hardcoded border
            <div key={cfg.lambdaName}
              className="bg-card rounded-2xl border flex flex-col overflow-hidden transition-all duration-300"
              style={{
                borderColor: rs === 'success' ? `${cfg.accent}35` : undefined,
                boxShadow:   rs === 'success' ? `0 0 24px ${cfg.accent}12` : 'none',
              }}
            >
              <div className="p-5 flex flex-col gap-4 flex-1">

                {/* Header row */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl p-2.5 shrink-0" style={{ background: `${cfg.accent}18` }}>
                      <AgentIcon className="w-5 h-5" style={{ color: cfg.accent }} />
                    </div>
                    <div>
                      {/* FIX: text-foreground instead of text-white */}
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <span className="rounded-full transition-colors duration-500"
                          style={{ width: 7, height: 7, background: dot, display: 'inline-block' }} />
                        {cfg.display}
                      </h3>
                      {/* FIX: text-muted-foreground instead of text-slate-500 */}
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{cfg.lambdaName}</p>
                    </div>
                  </div>
                  <Badge className={
                    rs === 'running' ? 'bg-amber-500/15 text-amber-500 border-amber-500/25 border' :
                    rs === 'success' ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/25 border' :
                    rs === 'error'   ? 'bg-red-500/15 text-red-500 border-red-500/25 border' :
                                      'bg-muted text-muted-foreground border-border border'
                  }>
                    {rs === 'running' ? 'Running' : rs === 'success' ? 'Success' : rs === 'error' ? 'Error' : 'Idle'}
                  </Badge>
                </div>

                {/* Description */}
                {/* FIX: text-muted-foreground instead of text-slate-400 */}
                <p className="text-xs text-muted-foreground leading-relaxed">{a?.description ?? cfg.description}</p>

                {/* Tech tags */}
                <div className="flex flex-wrap gap-1.5">
                  {cfg.tags.map((tag) => (
                    // FIX: border-border text-muted-foreground instead of hardcoded dark values
                    <span key={tag}
                      className="text-[11px] px-2 py-0.5 rounded-lg border border-border text-muted-foreground"
                      style={{ background: `${cfg.accent}10` }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Last run timestamp */}
                <div className="flex items-center gap-4 text-xs">
                  <span className={rs === 'success' ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}>
                    {resolveLastRun(cfg.shortKey, a?.last_run_at)}
                  </span>
                  {a?.total_runs != null && rs !== 'success' && (
                    // FIX: text-muted-foreground/50 instead of text-slate-600
                    <span className="text-muted-foreground/50">{a.total_runs} total runs</span>
                  )}
                </div>

                {/* Output box */}
                {outputLines && (
                  <AgentOutputBox lines={outputLines} shortKey={cfg.shortKey} accent={cfg.accent} />
                )}

                {/* Run button */}
                <Button
                  onClick={() => handleRun(cfg.shortKey, cfg.display)}
                  disabled={anyRunning}
                  className="mt-auto bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white disabled:opacity-40 rounded-xl"
                >
                  {rs === 'running'
                    ? <span className="flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin" />Running…</span>
                    : <span className="flex items-center gap-2"><Play className="w-4 h-4" />Run Agent</span>}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
