import { useEffect, useState } from 'react'
import { type LucideIcon, Activity, Bot, Database, Lightbulb, Shield } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import {
  type AgentStatus,
  type EvidenceItem,
  type GovernanceStats,
  type ReasoningRun,
  getAgentStatus,
  getEvidence,
  getGovernanceStats,
  getRecommendations,
} from '../api/client'
import ConfidenceBar from '../components/ConfidenceBar'

const EFFORT_COLOR: Record<string, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#EF4444',
}

function StatCard({ icon: Icon, label, value, color }: {
  icon: LucideIcon
  label: string
  value: number | string
  color: string
}) {
  return (
    <div
      className="rounded-xl p-5 border flex items-start gap-4"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="rounded-lg p-2.5" style={{ background: `${color}18` }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div className="text-2xl font-bold text-slate-100">{value}</div>
        <div className="text-xs text-slate-400 mt-0.5">{label}</div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [run, setRun] = useState<ReasoningRun | null>(null)
  const [agents, setAgents] = useState<AgentStatus[]>([])
  const [stats, setStats] = useState<GovernanceStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      getEvidence(),
      getRecommendations(),
      getAgentStatus(),
      getGovernanceStats(),
    ]).then(([ev, rec, ag, st]) => {
      if (ev.status === 'fulfilled') setEvidence(ev.value)
      if (rec.status === 'fulfilled') setRun(rec.value)
      if (ag.status === 'fulfilled') setAgents(ag.value)
      if (st.status === 'fulfilled') setStats(st.value)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500">
        Loading dashboard…
      </div>
    )
  }

  const topRecs = run?.recommendations.slice(0, 3) ?? []

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Database}   label="Active Evidence Clusters"   value={evidence.length}                  color="#3B82F6" />
        <StatCard icon={Lightbulb}  label="Total Recommendations"      value={run?.recommendations.length ?? 0} color="#8B5CF6" />
        <StatCard icon={Activity}   label="Feedback Items Processed"   value={stats?.active_evidence ?? 0}      color="#10B981" />
        <StatCard icon={Shield}     label="Governance Events"          value={stats?.total_events ?? 0}         color="#F59E0B" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Latest Recommendations */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Latest Recommendations</h2>
          {topRecs.length === 0 ? (
            <p className="text-xs text-slate-500">No recommendations yet.</p>
          ) : (
            <div className="space-y-3">
              {topRecs.map((r) => (
                <div
                  key={r.rank}
                  className="rounded-lg p-3 border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: '#3B82F620', color: '#3B82F6' }}
                    >
                      {r.rank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">{r.theme}</p>
                      <div className="flex gap-2 mt-1.5">
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${EFFORT_COLOR[r.effort_estimate]}18`, color: EFFORT_COLOR[r.effort_estimate] }}
                        >
                          {r.effort_estimate}
                        </span>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: `${EFFORT_COLOR[r.user_impact]}18`, color: EFFORT_COLOR[r.user_impact] }}
                        >
                          {r.user_impact} impact
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agent Activity */}
        <div
          className="rounded-xl border p-5"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Agent Activity</h2>
          <div className="space-y-3">
            {agents.map((a) => (
              <div
                key={a.name}
                className="flex items-center justify-between py-2 border-b"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center gap-2">
                  <Bot size={14} className="text-slate-400" />
                  <span className="text-sm text-slate-300">{a.display_name}</span>
                </div>
                <div className="text-right">
                  <span
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}
                  >
                    Active
                  </span>
                  {a.last_run_at && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDistanceToNow(new Date(a.last_run_at), { addSuffix: true })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Evidence cluster overview */}
      <div
        className="rounded-xl border p-5"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Evidence Clusters</h2>
        {evidence.length === 0 ? (
          <p className="text-xs text-slate-500">No evidence clusters.</p>
        ) : (
          <div className="space-y-3">
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center gap-4">
                <span
                  className="text-sm text-slate-300 flex-1 truncate"
                  style={{ maxWidth: 300 }}
                >
                  {e.theme}
                </span>
                <div className="flex-1">
                  <ConfidenceBar score={e.confidence_score} height={8} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
