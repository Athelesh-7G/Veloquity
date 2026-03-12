import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  type GovernanceEvent,
  type GovernanceStats,
  getGovernanceLog,
  getGovernanceStats,
} from '../api/client'

const EVENT_STYLE: Record<string, { color: string; bg: string }> = {
  stale_detected:         { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  stale_flagged:          { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  signal_promoted:        { color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
  cost_alert:             { color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   },
  threshold_alert:        { color: '#FB923C', bg: 'rgba(251,146,60,0.12)'  },
  reprocess_triggered:    { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)'  },
  duplicate_pattern_flagged: { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
}

function getNextCron() {
  const now = new Date()
  const next = new Date()
  next.setUTCHours(6, 0, 0, 0)
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1)
  const diff = next.getTime() - now.getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  return `${h}h ${m}m`
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      className="rounded-xl border p-4 text-center"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
    >
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  )
}

export default function Governance() {
  const [stats, setStats] = useState<GovernanceStats | null>(null)
  const [events, setEvents] = useState<GovernanceEvent[]>([])
  const [limit, setLimit] = useState(50)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(getNextCron())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getGovernanceStats(), getGovernanceLog(limit)]).then(([s, e]) => {
      setStats(s)
      setEvents(e)
      setLoading(false)
    })
  }, [limit])

  useEffect(() => {
    const t = setInterval(() => setCountdown(getNextCron()), 60000)
    return () => clearInterval(t)
  }, [])

  if (loading) return <div className="flex items-center justify-center h-64 text-slate-500">Loading…</div>

  return (
    <div className="space-y-6">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-6 gap-3">
          <StatCard label="Total Events"    value={stats.total_events}      color="#3B82F6" />
          <StatCard label="Stale Flagged"   value={stats.stale_flagged}     color="#F59E0B" />
          <StatCard label="Promoted"        value={stats.signals_promoted}  color="#10B981" />
          <StatCard label="Cost Alerts"     value={stats.cost_alerts}       color="#EF4444" />
          <StatCard label="Active Evidence" value={stats.active_evidence}   color="#8B5CF6" />
          <StatCard label="Staging Queue"   value={stats.staging_count}     color="#64748B" />
        </div>
      )}

      {/* EventBridge card */}
      <div
        className="rounded-xl border p-4 flex items-center justify-between"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div>
          <p className="text-sm font-medium text-slate-200">EventBridge Cron Schedule</p>
          <p className="text-xs text-slate-500 mt-0.5">Governance Agent runs daily at 06:00 UTC</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-mono font-semibold" style={{ color: '#10B981' }}>
            Next run in {countdown}
          </div>
          <div className="text-xs text-slate-500 font-mono">cron(0 6 * * ? *)</div>
        </div>
      </div>

      {/* Event log */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <h2 className="text-sm font-semibold text-slate-300">Governance Log</h2>
          <span className="text-xs text-slate-500">{events.length} events</span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No governance events yet.</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Time', 'Event Type', 'Target ID', 'Details'].map((h) => (
                  <th
                    key={h}
                    className="px-5 py-2.5 text-left font-medium text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const style = EVENT_STYLE[ev.event_type] ?? { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' }
                const expanded = expandedId === ev.id
                return (
                  <>
                    <tr
                      key={ev.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                        {format(new Date(ev.actioned_at), 'MM/dd HH:mm')}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full font-medium"
                          style={{ color: style.color, background: style.bg }}
                        >
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-slate-500">
                        {ev.target_id ? ev.target_id.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setExpandedId(expanded ? null : ev.id)}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-200"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                        >
                          {Object.keys(ev.details ?? {}).length === 0 ? '—' : (
                            <>
                              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              {Object.keys(ev.details).slice(0, 2).join(', ')}…
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr key={`${ev.id}-detail`} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td colSpan={4} className="px-5 py-3">
                          <pre
                            className="text-xs text-slate-300 font-mono p-3 rounded-lg overflow-auto"
                            style={{ background: 'var(--surface)' }}
                          >
                            {JSON.stringify(ev.details, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}

        {events.length === limit && (
          <div className="p-4 text-center border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="text-xs text-slate-400 hover:text-slate-200 px-4 py-2 rounded-lg border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', cursor: 'pointer' }}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
