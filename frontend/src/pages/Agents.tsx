import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { type AgentRunResult, type AgentStatus, getAgentStatus, runAgent } from '../api/client'
import AgentStatusBadge from '../components/AgentStatusBadge'

type RunStatus = 'idle' | 'running' | 'success' | 'error'

const PIPELINE = ['ingestion', 'evidence', 'reasoning', 'governance']
const PIPELINE_LABELS: Record<string, string> = {
  ingestion:  'Ingestion',
  evidence:   'Evidence Intelligence',
  reasoning:  'Reasoning',
  governance: 'Governance',
}

function statusDot(lastRunAt: string | null): string {
  if (!lastRunAt) return '#EF4444'
  const days = (Date.now() - new Date(lastRunAt).getTime()) / 86_400_000
  if (days <= 7) return '#10B981'
  if (days <= 30) return '#F59E0B'
  return '#EF4444'
}

function PipelineArrow() {
  return (
    <div className="flex flex-col items-center" style={{ height: 28 }}>
      <div style={{ width: 1, flex: 1, background: '#334155' }} />
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid #334155' }} />
    </div>
  )
}

export default function Agents() {
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [runStatus, setRunStatus] = useState<Record<string, RunStatus>>({})
  const [lastResult, setLastResult] = useState<Record<string, AgentRunResult>>({})
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const [loading, setLoading] = useState(true)

  const anyRunning = Object.values(runStatus).includes('running')

  useEffect(() => {
    getAgentStatus().then((d) => { setAgents(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function addToast(msg: string, ok: boolean) {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }

  async function handleRun(name: string) {
    setRunStatus((s) => ({ ...s, [name]: 'running' }))
    try {
      const result = await runAgent(name)
      setRunStatus((s) => ({ ...s, [name]: 'success' }))
      setLastResult((r) => ({ ...r, [name]: result }))
      addToast(`${PIPELINE_LABELS[name]} agent completed successfully`, true)
      // Refresh agent statuses
      getAgentStatus().then(setAgents).catch(() => {})
    } catch (err: unknown) {
      setRunStatus((s) => ({ ...s, [name]: 'error' }))
      const msg = err instanceof Error ? err.message : 'Unknown error'
      addToast(`${PIPELINE_LABELS[name]}: ${msg}`, false)
    }
  }

  const agentMap = Object.fromEntries(agents.map((a) => [a.name, a]))

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading agents…</div>
  }

  return (
    <div className="space-y-8">
      {/* Toast notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-2 px-4 py-3 rounded-lg border text-sm shadow-xl"
            style={{
              background: 'var(--card)',
              borderColor: t.ok ? '#10B981' : '#EF4444',
              color: '#F1F5F9',
            }}
          >
            {t.ok ? <CheckCircle2 size={14} color="#10B981" /> : <XCircle size={14} color="#EF4444" />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Agent Coordination</h2>
        <p className="text-sm text-slate-400 mt-1">
          Four specialized agents form the Veloquity intelligence pipeline.
          Each agent can be triggered independently or via its scheduled EventBridge cron.
        </p>
      </div>

      {/* Pipeline flow — vertical */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <p className="text-xs text-slate-500 mb-5 uppercase tracking-widest">Pipeline Flow</p>
        <div className="flex flex-col items-center gap-0">

          {/* Source nodes */}
          <div className="flex items-center gap-3 mb-1">
            {['App Store Reviews', 'Support Tickets'].map((src) => (
              <div
                key={src}
                className="rounded-lg px-4 py-2 border text-xs font-medium text-slate-400"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                {src}
              </div>
            ))}
          </div>

          {/* Connector from sources */}
          <PipelineArrow />

          {/* Agent nodes */}
          {PIPELINE.map((name, i) => {
            const a = agentMap[name]
            const dot = statusDot(a?.last_run_at ?? null)
            return (
              <div key={name} className="flex flex-col items-center w-full">
                <div
                  className="rounded-lg border px-5 py-3 flex items-center justify-between w-64"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <span className="text-sm font-medium text-slate-200">{PIPELINE_LABELS[name]}</span>
                  <div className="flex items-center gap-2">
                    {a?.last_run_at && (
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true })}
                      </span>
                    )}
                    <span
                      className="rounded-full flex-shrink-0"
                      style={{ width: 9, height: 9, background: dot }}
                    />
                  </div>
                </div>
                {i < PIPELINE.length - 1 && <PipelineArrow />}
              </div>
            )
          })}

          {/* Connector to output */}
          <PipelineArrow />

          {/* Output node */}
          <div
            className="rounded-lg px-4 py-2 border text-xs font-medium text-slate-400"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            Product Recommendations
          </div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid grid-cols-2 gap-4">
        {PIPELINE.map((name) => {
          const a = agentMap[name]
          const status = runStatus[name] ?? 'idle'
          const result = lastResult[name]
          if (!a) return null

          return (
            <div
              key={name}
              className="rounded-xl border p-5 flex flex-col gap-4"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg p-2" style={{ background: 'rgba(59,130,246,0.1)' }}>
                    <Bot size={18} color="#3B82F6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{a.display_name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{a.lambda_function_name}</p>
                  </div>
                </div>
                <AgentStatusBadge status={status} />
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">{a.description}</p>

              <div className="flex items-center gap-4 text-xs text-slate-500">
                {a.last_run_at && (
                  <span>Last run: {formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true })}</span>
                )}
                {a.total_runs != null && <span>{a.total_runs} total runs</span>}
              </div>

              {result && (
                <div
                  className="rounded-lg p-3 text-xs font-mono text-slate-400 overflow-auto max-h-24"
                  style={{ background: 'var(--surface)' }}
                >
                  {JSON.stringify(result.response_payload, null, 2)}
                </div>
              )}

              <button
                onClick={() => handleRun(name)}
                disabled={anyRunning}
                className="mt-auto rounded-lg py-2 text-sm font-medium transition-all duration-150"
                style={{
                  background: anyRunning ? '#1E293B' : 'var(--accent)',
                  color: anyRunning ? '#475569' : '#fff',
                  cursor: anyRunning ? 'not-allowed' : 'pointer',
                  border: 'none',
                }}
              >
                {status === 'running' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-t-transparent spinner" />
                    Running…
                  </span>
                ) : (
                  'Run Agent'
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* Architecture section */}
      <div
        className="rounded-xl border p-6"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Architecture</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          Veloquity operates as a four-agent pipeline. The <strong className="text-slate-300">Ingestion Agent</strong> normalises
          raw feedback from App Store and Support Tickets, applies regex PII redaction, deduplicates by SHA-256 hash, and
          stores cleaned items to S3. The <strong className="text-slate-300">Evidence Intelligence Agent</strong> embeds feedback
          via Amazon Bedrock Titan Embed V2 (1024-dimensional vectors), clusters semantically using greedy cosine similarity,
          scores cluster confidence, and writes accepted clusters to PostgreSQL with full item-level provenance. The{' '}
          <strong className="text-slate-300">Reasoning Agent</strong> fetches active evidence, applies a deterministic
          priority formula (confidence × 0.35 + user count × 0.25 + source corroboration × 0.20 + recency × 0.20),
          then calls Claude 3 Haiku to generate ranked, explainable recommendations. The{' '}
          <strong className="text-slate-300">Governance Agent</strong> runs daily via EventBridge, flags stale evidence,
          promotes high-frequency staging clusters, and monitors embedding cache efficiency. Every governance action
          is written to an immutable audit log.
        </p>
      </div>
    </div>
  )
}
