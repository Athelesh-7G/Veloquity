import { useEffect, useState } from 'react'
import { AlertTriangle, Link } from 'lucide-react'
import { format } from 'date-fns'
import { type ReasoningRun, getRecommendations } from '../api/client'

const RANK_STYLE: Record<number, { bg: string; color: string; label: string }> = {
  1: { bg: '#92400E', color: '#FBBF24', label: '1st' },
  2: { bg: '#374151', color: '#D1D5DB', label: '2nd' },
  3: { bg: '#7C2D12', color: '#FB923C', label: '3rd' },
}

const EFFORT_COLOR: Record<string, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#EF4444',
}

export default function Recommendations() {
  const [run, setRun] = useState<ReasoningRun | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getRecommendations()
      .then(setRun)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading…</div>
  if (error) return <div className="text-red-400 p-4">{error}</div>
  if (!run) return <div className="text-slate-500 p-4">No reasoning runs found.</div>

  const inputTokens = run.token_usage?.input_tokens ?? '—'
  const outputTokens = run.token_usage?.output_tokens ?? '—'

  return (
    <div className="space-y-5">
      {/* Run metadata */}
      <div
        className="rounded-xl border p-4 flex items-center gap-6 text-xs text-slate-400"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <span>Run ID: <span className="font-mono text-slate-300">{run.id.slice(0, 8)}…</span></span>
        <span>{format(new Date(run.run_at), 'PPpp')}</span>
        <span>Model: <span className="text-slate-300">{run.model_id}</span></span>
        <span>{inputTokens} in / {outputTokens} out tokens</span>
      </div>

      {/* Summary card */}
      {(run.reasoning_summary || run.cross_cluster_insight) && (
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Reasoning Summary</h2>
          {run.reasoning_summary && (
            <p className="text-sm text-slate-300 leading-relaxed mb-3">{run.reasoning_summary}</p>
          )}
          {run.cross_cluster_insight && (
            <div
              className="rounded-lg p-3 border text-xs text-slate-400"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <span className="text-slate-500 font-medium">Cross-cluster insight: </span>
              {run.cross_cluster_insight}
            </div>
          )}
          {run.highest_priority_theme && (
            <div className="mt-2 text-xs text-slate-500">
              Highest priority: <span className="text-accent">{run.highest_priority_theme}</span>
            </div>
          )}
        </div>
      )}

      {/* Recommendation cards */}
      {run.recommendations.map((r) => {
        const rankStyle = RANK_STYLE[r.rank] ?? { bg: '#1E3A5F', color: '#3B82F6', label: `#${r.rank}` }
        return (
          <div
            key={r.rank}
            className="rounded-xl border p-5"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
          >
            <div className="flex items-start gap-4">
              <div
                className="rounded-xl w-11 h-11 flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: rankStyle.bg, color: rankStyle.color }}
              >
                #{r.rank}
              </div>
              <div className="flex-1">
                <h3 className="text-base font-semibold text-slate-100">{r.theme}</h3>
                <p className="text-sm text-slate-200 mt-1 font-medium">{r.recommended_action}</p>
                <div className="flex gap-2 mt-2.5">
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: `${EFFORT_COLOR[r.effort_estimate]}18`,
                      color: EFFORT_COLOR[r.effort_estimate],
                    }}
                  >
                    Effort: {r.effort_estimate}
                  </span>
                  <span
                    className="text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: `${EFFORT_COLOR[r.user_impact]}18`,
                      color: EFFORT_COLOR[r.user_impact],
                    }}
                  >
                    Impact: {r.user_impact}
                  </span>
                </div>
              </div>
            </div>

            {r.tradeoff_explanation && (
              <p className="text-xs text-slate-400 mt-3 leading-relaxed pl-15">
                {r.tradeoff_explanation}
              </p>
            )}

            {r.risk_flags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 pl-15">
                {r.risk_flags.map((flag, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
                  >
                    <AlertTriangle size={10} />
                    {flag}
                  </span>
                ))}
              </div>
            )}

            {r.related_clusters.length > 0 && (
              <div className="flex items-center gap-2 mt-3 pl-15">
                <Link size={12} className="text-slate-500" />
                <span className="text-xs text-slate-500">Related: </span>
                {r.related_clusters.map((c) => (
                  <span
                    key={c}
                    className="text-xs px-1.5 py-0.5 rounded font-mono"
                    style={{ background: 'rgba(59,130,246,0.15)', color: '#93C5FD' }}
                  >
                    #{c}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
