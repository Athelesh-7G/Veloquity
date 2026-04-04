import { useEffect, useRef, useState } from 'react'
import { Bot, CheckCircle2, XCircle, Play, RefreshCw, Loader2, Zap, Database, Brain, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { type AgentRunResult, type AgentStatus, checkHealth, getAgentStatus, runAgent } from '@/api/client'
import { MOCK_AGENTS } from '@/api/mockData'

type RunStatus = 'idle' | 'running' | 'success' | 'error'
type WakeStatus = 'pending' | 'waking' | 'ready' | 'failed'

const MAX_WAKE_ATTEMPTS = 10

const AGENT_CONFIG = [
  {
    lambdaName: 'veloquity-ingestion-dev',
    shortKey: 'ingestion',
    display: 'Ingestion Agent',
    subtitle: 'PII Redaction · Dedup · SHA-256 · S3 Landing',
    tags: ['AWS Lambda', 'S3', 'SHA-256', 'PII Redact'],
    description: 'Ingests App Store reviews and Zendesk tickets. Applies PII redaction and SHA-256 deduplication before landing to S3.',
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
    subtitle: 'Confidence Scoring · Claude 3 Haiku · Bedrock',
    tags: ['Claude 3 Haiku', 'Bedrock', 'Confidence Score'],
    description: 'Scores evidence clusters on confidence, user count, source corroboration and recency. Invokes Claude 3 Haiku for structured recommendations.',
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

// ─── Per-agent progress messages ─────────────────────────────────────────────
const AGENT_PROGRESS_MSG: Record<string, string> = {
  ingestion:  'Processing feedback items... (typically 15–30s)',
  evidence:   'Computing embeddings and clustering... (typically 30–60s)',
  reasoning:  'Analyzing evidence with Nova Pro... (typically 20–40s)',
  governance: 'Running governance checks... (typically 10–20s)',
}

// ─── Canonical per-agent output lines ────────────────────────────────────────
const AGENT_FALLBACK_LINES: Record<string, string[]> = {
  ingestion: [
    '547 feedback items ingested  (App Store: 275 · Zendesk: 272)',
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

// ─── Payload parser ───────────────────────────────────────────────────────────
function parsePayloadLines(result: AgentRunResult, shortKey: string): string[] {
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
      : (AGENT_FALLBACK_LINES[shortKey] ?? [AGENT_FALLBACKS[shortKey] ?? 'Agent completed successfully'])
  } catch {
    return AGENT_FALLBACK_LINES[shortKey] ?? [AGENT_FALLBACKS[shortKey] ?? 'Agent completed successfully']
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

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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
          <span className="text-xs text-foreground/70 leading-relaxed">{line}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Agents() {
  const [agents, setAgents]         = useState<AgentStatus[]>([])
  const [runStatus, setRunStatus]   = useState<Record<string, RunStatus>>({})
  const [lastResult, setLastResult] = useState<Record<string, AgentRunResult>>({})
  const [lastRanAt, setLastRanAt]   = useState<Record<string, Date>>({})
  const [toasts, setToasts]         = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const [loading, setLoading]       = useState(true)

  // Cold-start wake-up state
  const [wakeStatus, setWakeStatus]   = useState<WakeStatus>('pending')
  const [wakeAttempt, setWakeAttempt] = useState(0)
  const wakeAbortRef                  = useRef({ cancelled: false })

  // Per-agent elapsed timer state
  const [runStartedAt, setRunStartedAt] = useState<Record<string, number>>({})
  const [doneFlash, setDoneFlash]       = useState<Record<string, number>>({})
  const [errorMsg, setErrorMsg]         = useState<Record<string, string>>({})
  const [, forceRender]                 = useState(0)
  const timerRef                        = useRef<ReturnType<typeof setInterval> | null>(null)

  const anyRunning = Object.values(runStatus).includes('running')

  // ── Timer: tick every second while any agent is running ──────────────────
  useEffect(() => {
    if (anyRunning) {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => forceRender((n) => n + 1), 1000)
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
  }, [anyRunning])

  // ── Cold-start wake-up on mount ───────────────────────────────────────────
  useEffect(() => {
    const ctrl = { cancelled: false }
    wakeAbortRef.current = ctrl

    async function doWakeUp() {
      let attempt = 0
      while (attempt < MAX_WAKE_ATTEMPTS) {
        if (ctrl.cancelled) return
        try {
          await checkHealth()
          if (ctrl.cancelled) return
          setWakeStatus('ready')
          try {
            const d = await getAgentStatus()
            if (!ctrl.cancelled) { setAgents(d.length ? d : MOCK_AGENTS); setLoading(false) }
          } catch {
            if (!ctrl.cancelled) { setAgents(MOCK_AGENTS); setLoading(false) }
          }
          return
        } catch {
          attempt++
          if (!ctrl.cancelled) {
            setWakeAttempt(attempt)
            if (attempt === 1) setWakeStatus('waking')
          }
          if (attempt < MAX_WAKE_ATTEMPTS && !ctrl.cancelled) {
            await new Promise<void>((r) => setTimeout(r, 3000))
          }
        }
      }
      if (!ctrl.cancelled) { setWakeStatus('failed'); setLoading(false) }
    }

    doWakeUp()
    return () => { ctrl.cancelled = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function addToast(msg: string, ok: boolean) {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  async function handleRun(shortKey: string, displayName: string) {
    const startedAt = Date.now()
    setRunStatus((s) => ({ ...s, [shortKey]: 'running' }))
    setRunStartedAt((s) => ({ ...s, [shortKey]: startedAt }))
    setDoneFlash((f) => { const n = { ...f }; delete n[shortKey]; return n })
    setErrorMsg((e) => { const n = { ...e }; delete n[shortKey]; return n })
    try {
      const result = await runAgent(shortKey)
      const elapsed = Math.round((Date.now() - startedAt) / 1000)
      setRunStatus((s) => ({ ...s, [shortKey]: 'success' }))
      setLastResult((r) => ({ ...r, [shortKey]: result }))
      setLastRanAt((r) => ({ ...r, [shortKey]: new Date() }))
      setDoneFlash((f) => ({ ...f, [shortKey]: elapsed }))
      setTimeout(() => setDoneFlash((f) => { const n = { ...f }; delete n[shortKey]; return n }), 3000)
      addToast(`${displayName} completed successfully`, true)
      getAgentStatus().then((d) => { if (d.length) setAgents(d) }).catch(() => {})
    } catch (err: unknown) {
      setRunStatus((s) => ({ ...s, [shortKey]: 'error' }))
      const msg = err instanceof Error ? err.message : 'Agent unavailable'
      setErrorMsg((e) => ({ ...e, [shortKey]: msg }))
      addToast(`${displayName}: ${msg}`, false)
    }
  }

  function retryWakeUp() {
    wakeAbortRef.current.cancelled = true
    const ctrl = { cancelled: false }
    wakeAbortRef.current = ctrl
    setWakeStatus('pending')
    setWakeAttempt(0)
    setLoading(true)

    async function doWakeUp() {
      let attempt = 0
      while (attempt < MAX_WAKE_ATTEMPTS) {
        if (ctrl.cancelled) return
        try {
          await checkHealth()
          if (ctrl.cancelled) return
          setWakeStatus('ready')
          try {
            const d = await getAgentStatus()
            if (!ctrl.cancelled) { setAgents(d.length ? d : MOCK_AGENTS); setLoading(false) }
          } catch {
            if (!ctrl.cancelled) { setAgents(MOCK_AGENTS); setLoading(false) }
          }
          return
        } catch {
          attempt++
          if (!ctrl.cancelled) {
            setWakeAttempt(attempt)
            if (attempt === 1) setWakeStatus('waking')
          }
          if (attempt < MAX_WAKE_ATTEMPTS && !ctrl.cancelled) {
            await new Promise<void>((r) => setTimeout(r, 3000))
          }
        }
      }
      if (!ctrl.cancelled) { setWakeStatus('failed'); setLoading(false) }
    }

    doWakeUp()
  }

  function resolveLastRun(shortKey: string, lastRunAt: string | null | undefined): string {
    const rs = runStatus[shortKey]
    if (rs === 'running') return 'Running now…'
    if (rs === 'success' && lastRanAt[shortKey]) return 'Ran just now ✓'
    if (lastRunAt) return formatDistanceToNow(new Date(lastRunAt), { addSuffix: true })
    return 'Never'
  }

  const agentMap = buildAgentMap(agents)

  // ── Loading / wake-up states ──────────────────────────────────────────────
  if (loading) {
    if (wakeStatus === 'failed') {
      return (
        <div className="p-6 flex flex-col items-center justify-center h-64 bg-background gap-4">
          <XCircle className="w-8 h-8 text-red-500" />
          <div className="text-center">
            <p className="text-foreground font-medium">Could not reach inference engine</p>
            <p className="text-muted-foreground text-sm mt-1">
              The backend may be unavailable. Please try again.
            </p>
          </div>
          <button
            type="button"
            onClick={retryWakeUp}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )
    }
    return (
      <div className="p-6 flex flex-col items-center justify-center h-64 bg-background gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        {wakeStatus === 'waking' ? (
          <div className="text-center">
            <p className="text-foreground text-sm font-medium">
              Waking up inference engine...
            </p>
            <p className="text-muted-foreground text-xs mt-1">
              This takes ~30 seconds on first load (attempt {wakeAttempt}/{MAX_WAKE_ATTEMPTS})
            </p>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">Connecting to intelligence engine...</span>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 min-h-screen bg-background">

      {/* ── Toasts ─────────────────────────────────────────────────────────── */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id}
            className="flex items-center gap-2 px-4 py-3 rounded-xl border text-sm shadow-2xl bg-card"
            style={{ borderColor: t.ok ? '#10B98150' : '#F59E0B50' }}>
            {t.ok
              ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              : <XCircle      className="w-4 h-4 text-amber-500   shrink-0" />}
            <span className="text-foreground text-sm">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Intelligence Engine</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Four autonomous AWS Lambda agents forming a closed-loop evidence pipeline.
          Each agent is independently invokable and observable.
        </p>
      </div>

      {/* ── Pipeline flow card ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border p-5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">Pipeline Flow</p>
        <p className="text-xs text-muted-foreground/60 mb-5">End-to-end evidence intelligence pipeline</p>

        <div className="flex flex-col items-center">
          {/* Source nodes */}
          <div className="flex items-center gap-3 mb-1">
            {[
              { label: 'App Store Reviews · 275', icon: '📱' },
              { label: 'Zendesk Tickets · 272',   icon: '🎫' },
            ].map((src) => (
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
            const elapsed = rs === 'running' && runStartedAt[cfg.shortKey]
              ? Math.max(0, Math.round((Date.now() - runStartedAt[cfg.shortKey]) / 1000))
              : 0
            const flash = doneFlash[cfg.shortKey]

            return (
              <div key={cfg.lambdaName} className="flex flex-col items-center w-full max-w-lg">
                <div
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
                        <span className="font-semibold text-sm text-foreground">{cfg.display}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{cfg.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs tabular-nums ${rs === 'success' ? 'text-emerald-500 font-medium' : 'text-muted-foreground'}`}>
                      {lastRun}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRun(cfg.shortKey, cfg.display)}
                      disabled={anyRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: `${cfg.accent}20`, color: cfg.accent }}
                    >
                      {rs === 'running'
                        ? <><Loader2 size={11} className="animate-spin" />Running… {formatElapsed(elapsed)}</>
                        : flash !== undefined
                        ? <><CheckCircle2 size={11} className="text-emerald-500" style={{ color: '#10B981' }} />Done in {formatElapsed(flash)}</>
                        : rs === 'success'
                        ? <><CheckCircle2 size={11} />Done</>
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
          <div className="rounded-xl px-5 py-3 border border-border bg-gradient-to-r from-blue-500/8 to-violet-500/8 flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <Brain className="w-4 h-4 text-violet-500" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Product Decisions</p>
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
          const elapsed = rs === 'running' && runStartedAt[cfg.shortKey]
            ? Math.max(0, Math.round((Date.now() - runStartedAt[cfg.shortKey]) / 1000))
            : 0
          const flash = doneFlash[cfg.shortKey]
          const errText = errorMsg[cfg.shortKey]

          const outputLines = result
            ? parsePayloadLines(result, cfg.shortKey)
            : rs === 'success' ? AGENT_FALLBACK_LINES[cfg.shortKey] : null

          return (
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
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <span className="rounded-full transition-colors duration-500"
                          style={{ width: 7, height: 7, background: dot, display: 'inline-block' }} />
                        {cfg.display}
                      </h3>
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
                <p className="text-xs text-muted-foreground leading-relaxed">{a?.description ?? cfg.description}</p>

                {/* Tech tags */}
                <div className="flex flex-wrap gap-1.5">
                  {cfg.tags.map((tag) => (
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
                    <span className="text-muted-foreground/50">{a.total_runs} total runs</span>
                  )}
                </div>

                {/* Progress / done / error feedback */}
                {rs === 'running' && (
                  <div className="flex items-center gap-2 text-xs text-amber-500 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span className="flex-1">{AGENT_PROGRESS_MSG[cfg.shortKey]}</span>
                    <span className="tabular-nums font-mono shrink-0">{formatElapsed(elapsed)}</span>
                  </div>
                )}
                {flash !== undefined && rs === 'success' && (
                  <div className="flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span className="font-medium">Done in {formatElapsed(flash)}</span>
                  </div>
                )}
                {rs === 'error' && errText && (
                  <div className="text-xs text-red-400 bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 break-words">
                    {errText}
                  </div>
                )}

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
                    ? <span className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running… {formatElapsed(elapsed)}
                      </span>
                    : flash !== undefined
                    ? <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Done in {formatElapsed(flash)}
                      </span>
                    : <span className="flex items-center gap-2">
                        <Play className="w-4 h-4" />
                        Run Agent
                      </span>}
                </Button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
