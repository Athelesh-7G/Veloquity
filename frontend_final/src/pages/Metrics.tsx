// =============================================================
// src/pages/Metrics.tsx
// Platform Metrics — real-time pipeline health, model performance,
// agent activity, and cost estimates.
// =============================================================

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  Cpu,
  Bot,
  DollarSign,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Hash,
  Layers,
  Zap,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { getMetrics, type PlatformMetrics } from '@/api/client'
import { useDataMode } from '@/context/DataModeContext'

// ── Demo data ────────────────────────────────────────────────

const DEMO_METRICS: PlatformMetrics = {
  generated_at: new Date().toISOString(),
  data_pipeline: {
    evidence_clusters: { total: 42, active: 38, stale: 3, rejected: 1 },
    feedback_items: { total_mapped: 1247, unique_hashes: 1189, sources: ['appstore', 'zendesk'] },
    embedding_cache: { total_entries: 1189, total_hits: 3421 },
    staging: { total: 87, pending: 24 },
  },
  model_performance: {
    confidence: { avg: 0.724, max: 0.961, min: 0.412 },
    cluster_size: { avg: 32.7, max: 148 },
    thresholds: { auto_accepted: 31, llm_validated: 6, auto_rejected: 5 },
  },
  agent_activity: {
    reasoning_runs: {
      total: 18,
      total_tokens_used: 38400,
      latest_run_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      latest_priority_theme: 'Barcode scanner crashes on ingredient lookup',
    },
    governance: {
      total_events: 74,
      by_type: {
        stale_flagged: 23,
        signal_promoted: 18,
        cost_alert: 4,
        evidence_validated: 29,
      },
    },
    agents: [
      { name: 'ingestion', display_name: 'Ingestion Agent', last_run_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), last_run_status: 'success', total_runs: 42 },
      { name: 'evidence', display_name: 'Evidence Agent', last_run_at: new Date(Date.now() - 90 * 60 * 1000).toISOString(), last_run_status: 'success', total_runs: 38 },
      { name: 'reasoning', display_name: 'Reasoning Agent', last_run_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(), last_run_status: 'success', total_runs: 18 },
      { name: 'governance', display_name: 'Governance Agent', last_run_at: new Date(Date.now() - 18 * 3600 * 1000).toISOString(), last_run_status: 'success', total_runs: 14 },
    ],
  },
  cost_estimates: {
    embedding_cost_usd: 0.035670,
    reasoning_cost_usd: 0.030720,
    total_cost_usd: 0.066390,
    basis: {
      unique_items_embedded: 1189,
      avg_tokens_per_embedding: 150,
      titan_rate_per_token: 0.0000002,
      reasoning_runs: 18,
      avg_tokens_per_run: 2000,
      nova_rate_per_token: 0.0000008,
    },
  },
}

// ── Sub-components ───────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = 'violet',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  sub?: string
  color?: 'violet' | 'blue' | 'emerald' | 'amber' | 'rose'
}) {
  const colors = {
    violet: 'text-violet-400 bg-violet-500/10',
    blue:   'text-blue-400 bg-blue-500/10',
    emerald:'text-emerald-400 bg-emerald-500/10',
    amber:  'text-amber-400 bg-amber-500/10',
    rose:   'text-rose-400 bg-rose-500/10',
  }
  return (
    <div className="bg-[#0F1729] rounded-2xl p-5 border border-white/5 flex items-start gap-4">
      <div className={`p-2.5 rounded-xl ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-violet-400" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  )
}

function AgentRow({
  agent,
}: {
  agent: { name: string; display_name: string; last_run_at: string | null; last_run_status: string; total_runs: number | null }
}) {
  const ok = agent.last_run_status === 'success'
  const relTime = agent.last_run_at
    ? (() => {
        const diff = Date.now() - new Date(agent.last_run_at).getTime()
        if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
        if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
        return `${Math.floor(diff / 86400_000)}d ago`
      })()
    : 'never'

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
      <span className="text-sm text-foreground flex-1">{agent.display_name}</span>
      <span className="text-xs text-muted-foreground">{relTime}</span>
      <span className="text-xs text-muted-foreground w-16 text-right">
        {agent.total_runs ?? 0} runs
      </span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────

export default function Metrics() {
  const { isLive } = useDataMode()
  const [data, setData] = useState<PlatformMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)

  const fetchMetrics = async () => {
    if (!isLive) {
      setData(DEMO_METRICS)
      setLastRefreshed(new Date())
      return
    }
    setLoading(true)
    setError(null)
    try {
      const m = await getMetrics()
      setData(m)
      setLastRefreshed(new Date())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchMetrics() }, [isLive])

  const dp  = data?.data_pipeline
  const mp  = data?.model_performance
  const aa  = data?.agent_activity
  const ce  = data?.cost_estimates

  // Bar chart data for threshold bands
  const thresholdChart = mp
    ? [
        { name: 'Auto-accepted', value: mp.thresholds.auto_accepted,  fill: '#34d399' },
        { name: 'LLM-validated', value: mp.thresholds.llm_validated,  fill: '#818cf8' },
        { name: 'Auto-rejected', value: mp.thresholds.auto_rejected,  fill: '#f87171' },
      ]
    : []

  // Bar chart data for governance events
  const govChart = aa
    ? Object.entries(aa.governance.by_type).map(([k, v]) => ({
        name: k.replace(/_/g, ' '),
        value: v,
        fill: '#818cf8',
      }))
    : []

  return (
    <div className="p-6 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform Metrics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLive ? 'Live pipeline health and cost data' : 'Demo metrics — connect to live backend for real data'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs text-muted-foreground">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <div className="text-center py-16 text-muted-foreground">No data available.</div>
      )}

      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#0F1729] rounded-2xl h-24 animate-pulse border border-white/5" />
          ))}
        </div>
      )}

      {data && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-8"
        >
          {/* ── Section 1: Data Pipeline Health ── */}
          <section>
            <SectionHeader icon={Database} title="Data Pipeline Health" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={Layers}    label="Active clusters"  value={dp?.evidence_clusters.active ?? 0}  sub={`${dp?.evidence_clusters.total ?? 0} total`}    color="violet" />
              <StatCard icon={Hash}      label="Unique items"     value={dp?.feedback_items.unique_hashes ?? 0} sub={`${dp?.feedback_items.total_mapped ?? 0} mapped`} color="blue" />
              <StatCard icon={Zap}       label="Cache entries"    value={dp?.embedding_cache.total_entries ?? 0} sub={`${dp?.embedding_cache.total_hits ?? 0} hits`}  color="emerald" />
              <StatCard icon={Clock}     label="Staging pending"  value={dp?.staging.pending ?? 0}           sub={`${dp?.staging.total ?? 0} total`}              color="amber" />
            </div>
            <div className="mt-3 flex gap-3 flex-wrap">
              {dp?.feedback_items.sources.map((s) => (
                <span key={s} className="px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  {s}
                </span>
              ))}
              {(dp?.evidence_clusters.stale ?? 0) > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {dp?.evidence_clusters.stale} stale clusters
                </span>
              )}
            </div>
          </section>

          {/* ── Section 2: Model Performance ── */}
          <section>
            <SectionHeader icon={Cpu} title="Model Performance" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Confidence stats */}
              <div className="bg-[#0F1729] rounded-2xl p-5 border border-white/5">
                <p className="text-xs text-muted-foreground mb-3">Confidence Score Distribution</p>
                <div className="flex items-end gap-4 mb-4">
                  <div>
                    <p className="text-3xl font-bold text-foreground">{((mp?.confidence.avg ?? 0) * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Average confidence</p>
                  </div>
                  <div className="text-right ml-auto">
                    <p className="text-sm text-emerald-400 font-medium">{((mp?.confidence.max ?? 0) * 100).toFixed(1)}% max</p>
                    <p className="text-sm text-rose-400 font-medium">{((mp?.confidence.min ?? 0) * 100).toFixed(1)}% min</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={thresholdChart} barSize={36}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                    <YAxis hide />
                    <Tooltip
                      contentStyle={{ background: '#0F1729', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {thresholdChart.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cluster size */}
              <div className="bg-[#0F1729] rounded-2xl p-5 border border-white/5">
                <p className="text-xs text-muted-foreground mb-3">Threshold Bands &amp; Cluster Sizes</p>
                <div className="space-y-3">
                  {[
                    { label: 'Auto-accepted (≥0.6)',  value: mp?.thresholds.auto_accepted ?? 0,  color: 'bg-emerald-500' },
                    { label: 'LLM-validated (0.4–0.6)', value: mp?.thresholds.llm_validated ?? 0, color: 'bg-violet-500' },
                    { label: 'Auto-rejected (<0.4)',  value: mp?.thresholds.auto_rejected ?? 0,  color: 'bg-rose-500' },
                  ].map(({ label, value, color }) => {
                    const total = (mp?.thresholds.auto_accepted ?? 0) + (mp?.thresholds.llm_validated ?? 0) + (mp?.thresholds.auto_rejected ?? 0)
                    const pct = total > 0 ? (value / total) * 100 : 0
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="text-foreground font-medium">{value}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                  <div className="pt-2 border-t border-white/5 flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg cluster size</span>
                    <span className="text-foreground font-medium">{mp?.cluster_size.avg ?? 0} users · max {mp?.cluster_size.max ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 3: Agent Activity ── */}
          <section>
            <SectionHeader icon={Bot} title="Agent Activity" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Agent status list */}
              <div className="bg-[#0F1729] rounded-2xl p-5 border border-white/5">
                <p className="text-xs text-muted-foreground mb-3">Agent Status</p>
                {(aa?.agents ?? []).map((a) => (
                  <AgentRow key={a.name} agent={a} />
                ))}
                {aa?.reasoning_runs.latest_priority_theme && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-xs text-muted-foreground mb-1">Latest priority theme</p>
                    <p className="text-xs text-violet-300">{aa.reasoning_runs.latest_priority_theme}</p>
                  </div>
                )}
              </div>

              {/* Governance events */}
              <div className="bg-[#0F1729] rounded-2xl p-5 border border-white/5">
                <p className="text-xs text-muted-foreground mb-1">Governance Events</p>
                <p className="text-2xl font-bold text-foreground mb-3">{aa?.governance.total_events ?? 0}</p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={govChart} barSize={28} layout="vertical">
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip
                      contentStyle={{ background: '#0F1729', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }}
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    />
                    <Bar dataKey="value" fill="#818cf8" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 pt-3 border-t border-white/5 flex justify-between text-xs">
                  <span className="text-muted-foreground">Reasoning runs</span>
                  <span className="text-foreground font-medium">
                    {aa?.reasoning_runs.total ?? 0} · {(aa?.reasoning_runs.total_tokens_used ?? 0).toLocaleString()} tokens
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* ── Section 4: Cost Estimates ── */}
          <section>
            <SectionHeader icon={DollarSign} title="Cost Estimates" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={TrendingUp}  label="Embedding cost"  value={`$${(ce?.embedding_cost_usd ?? 0).toFixed(4)}`} sub="Titan Embed V2"   color="blue" />
              <StatCard icon={Cpu}         label="Reasoning cost"  value={`$${(ce?.reasoning_cost_usd ?? 0).toFixed(4)}`} sub="Nova Pro"         color="violet" />
              <StatCard icon={DollarSign}  label="Total cost"      value={`$${(ce?.total_cost_usd ?? 0).toFixed(4)}`}    sub="All models"      color="emerald" />
              <div className="bg-[#0F1729] rounded-2xl p-5 border border-white/5">
                <p className="text-xs text-muted-foreground mb-2">Cost basis</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Items embedded</span>
                    <span className="text-foreground">{(ce?.basis.unique_items_embedded ?? 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg tokens/item</span>
                    <span className="text-foreground">{ce?.basis.avg_tokens_per_embedding ?? 150}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reasoning runs</span>
                    <span className="text-foreground">{ce?.basis.reasoning_runs ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg tokens/run</span>
                    <span className="text-foreground">{(ce?.basis.avg_tokens_per_run ?? 2000).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Estimates based on published AWS Bedrock pricing. Actual costs may vary with cross-region inference.
            </div>
          </section>
        </motion.div>
      )}
    </div>
  )
}
