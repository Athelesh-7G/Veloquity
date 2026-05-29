import { useEffect, useState } from 'react'
import type React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, TrendingDown, Minus, Database, Shield, ArrowUpRight, ArrowDownRight, CheckCircle2, Wifi } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MOCK_EVIDENCE, HOSPITAL_MOCK_DATA } from '@/api/mockData'
import { getEvidence, fetchLiveEvidence, fetchLiveRecommendations, type EvidenceItem, type ReasoningRun } from '@/api/client'
import { hasUploadedData, getActiveDataset, getLiveMode, setLiveMode, hasActiveSources, getSourceLabel } from '@/utils/uploadState'

// ─── App product numbers ──────────────────────────────────────────────────────
const APP_TOTAL_FEEDBACK    = 547
const APP_EVIDENCE_CLUSTERS = 6
const APP_AVG_CONFIDENCE    = 84
const APP_ANALYZED_PCT      = 91

const APP_VELOQUITY_THEMES = [
  { id: 't1', name: 'App crashes on project switch',         feedbackCount: 138, avgConfidence: 91, trend: 'rising'    },
  { id: 't2', name: 'Black screen after latest update',      feedbackCount: 112, avgConfidence: 87, trend: 'rising'    },
  { id: 't3', name: 'Dashboard load time regression',        feedbackCount:  94, avgConfidence: 85, trend: 'stable'    },
  { id: 't4', name: 'No onboarding checklist for new users', feedbackCount:  82, avgConfidence: 81, trend: 'rising'    },
  { id: 't5', name: 'Export to CSV silently fails',          feedbackCount:  58, avgConfidence: 76, trend: 'declining' },
  { id: 't6', name: 'Notification delay on mobile',          feedbackCount:  37, avgConfidence: 71, trend: 'stable'    },
]

const APP_CONFIDENCE_BUCKETS = [
  { label: '90-100%', count: 153, color: 'bg-green-500'  },
  { label: '70-89%',  count: 235, color: 'bg-blue-500'   },
  { label: '50-69%',  count: 109, color: 'bg-orange-500' },
  { label: '<50%',    count:  50, color: 'bg-red-500'     },
]

// ─── Hospital numbers ─────────────────────────────────────────────────────────
const HOSP_TOTAL_FEEDBACK    = 310
const HOSP_EVIDENCE_CLUSTERS = 4
const HOSP_AVG_CONFIDENCE    = 81
const HOSP_ANALYZED_PCT      = 89

const HOSP_VELOQUITY_THEMES = [
  { id: 'ht1', name: 'Extended Emergency Wait Times',           feedbackCount: 98, avgConfidence: 91, trend: 'rising'   },
  { id: 'ht2', name: 'Online Appointment Booking Failures',     feedbackCount: 76, avgConfidence: 84, trend: 'stable'   },
  { id: 'ht3', name: 'Billing Statement Errors and Confusion',  feedbackCount: 82, avgConfidence: 78, trend: 'stable'   },
  { id: 'ht4', name: 'Medical Records Portal Access Issues',    feedbackCount: 54, avgConfidence: 72, trend: 'declining'},
]

const HOSP_CONFIDENCE_BUCKETS = [
  { label: '90-100%', count:  98, color: 'bg-green-500'  },
  { label: '70-89%',  count: 158, color: 'bg-blue-500'   },
  { label: '50-69%',  count:  54, color: 'bg-orange-500' },
  { label: '<50%',    count:   0, color: 'bg-red-500'     },
]

function StatCard({
  title, value, change, trend, icon: Icon, gradient,
}: {
  title: string
  value: string | number
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: React.ElementType
  gradient: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={`p-5 rounded-xl border border-border bg-gradient-to-br ${gradient} relative overflow-hidden`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
          <Icon className="w-5 h-5 text-foreground" />
        </div>
        {change && (
          <div className="flex items-center gap-1">
            {trend === 'up'   && <ArrowUpRight  className="w-4 h-4 text-green-600" />}
            {trend === 'down' && <ArrowDownRight className="w-4 h-4 text-red-600"  />}
            <span className={`text-sm font-medium ${
              trend === 'up'   ? 'text-green-600' :
              trend === 'down' ? 'text-red-600'   : 'text-muted-foreground'
            }`}>{change}</span>
          </div>
        )}
      </div>
      <p className="text-3xl font-bold text-foreground mb-1">{value}</p>
      <p className="text-sm text-muted-foreground">{title}</p>
    </motion.div>
  )
}

export default function Dashboard() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()
  const isHospital = dataset === 'hospital_survey'

  const TOTAL_FEEDBACK    = isHospital ? HOSP_TOTAL_FEEDBACK    : APP_TOTAL_FEEDBACK
  const EVIDENCE_CLUSTERS = isHospital ? HOSP_EVIDENCE_CLUSTERS : APP_EVIDENCE_CLUSTERS
  const AVG_CONFIDENCE    = isHospital ? HOSP_AVG_CONFIDENCE    : APP_AVG_CONFIDENCE
  const ANALYZED_PCT      = isHospital ? HOSP_ANALYZED_PCT      : APP_ANALYZED_PCT
  const VELOQUITY_THEMES  = isHospital ? HOSP_VELOQUITY_THEMES  : APP_VELOQUITY_THEMES
  const CONFIDENCE_BUCKETS = isHospital ? HOSP_CONFIDENCE_BUCKETS : APP_CONFIDENCE_BUCKETS

  const [evidence, setEvidence] = useState(isHospital ? HOSPITAL_MOCK_DATA : MOCK_EVIDENCE)

  // Live mode state
  const [liveMode, setLiveModeState] = useState(() => getLiveMode())
  const [liveEvidence, setLiveEvidence] = useState<EvidenceItem[] | null>(null)
  const [liveRun, setLiveRun] = useState<ReasoningRun | null>(null)
  const [liveLoading, setLiveLoading] = useState(() => getLiveMode() && hasActiveSources())
  const [liveError, setLiveError] = useState<string | null>(null)

  useEffect(() => {
    if (!hasData) return
    getEvidence()
      .then((r) => { if (r && r.length > 0) setEvidence(r as any) })
      .catch(() => {})
  }, [hasData])

  useEffect(() => {
    if (!liveMode) return
    if (!hasActiveSources()) {
      setLiveEvidence([])
      setLiveRun(null)
      setLiveLoading(false)
      return
    }
    setLiveLoading(true)
    setLiveError(null)
    Promise.all([fetchLiveEvidence(), fetchLiveRecommendations()])
      .then(([ev, run]) => {
        setLiveEvidence(ev)
        setLiveRun(run)
        setLiveLoading(false)
      })
      .catch(err => {
        setLiveError(err.message)
        setLiveLoading(false)
      })
  }, [liveMode])

  const bucketMax = Math.max(...CONFIDENCE_BUCKETS.map((b) => b.count))

  // When live mode is active, derive display values from real API data
  const liveClusters   = liveEvidence?.length ?? 0
  const liveAvgConf    = liveEvidence && liveEvidence.length > 0
    ? Math.round(liveEvidence.reduce((s, e) => s + e.confidence_score * 100, 0) / liveEvidence.length)
    : 0
  // Use item_count (provenance rows in evidence_item_map) when available;
  // falls back to unique_user_count so the stat degrades gracefully.
  const liveTotalUsers = liveEvidence?.reduce(
    (s, e) => s + (e.item_count > 0 ? e.item_count : e.unique_user_count), 0
  ) ?? 0
  const liveRecCount   = liveRun?.recommendations?.length ?? 0

  const displayTotal      = liveMode && liveEvidence ? liveTotalUsers   : hasData ? TOTAL_FEEDBACK    : 0
  const displayClusters   = liveMode && liveEvidence ? liveClusters     : hasData ? EVIDENCE_CLUSTERS : 0
  const displayConfidence = liveMode && liveEvidence ? liveAvgConf      : hasData ? AVG_CONFIDENCE    : 0
  const displayAnalyzed   = liveMode && liveEvidence ? liveRecCount > 0 ? 100 : 0 : hasData ? ANALYZED_PCT : 0

  if (liveMode && !hasActiveSources()) {
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'16px', color:'var(--text-secondary)' }}>
        <div style={{ fontSize:'32px' }}>📂</div>
        <div style={{ fontSize:'16px', fontWeight:600 }}>No sources connected</div>
        <div style={{ fontSize:'13px', textAlign:'center', maxWidth:'300px' }}>Connect feedback sources in Import Sources to enable V1 intelligence mode.</div>
        <a href="/app/import-sources" style={{ padding:'8px 16px', background:'var(--accent-primary)', color:'white', borderRadius:'6px', textDecoration:'none', fontSize:'13px', fontWeight:600 }}>Go to Import Sources</a>
      </div>
    )
  }

  if (liveMode && hasActiveSources() && liveLoading) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh', gap:'12px', color:'#22c55e', fontSize:'14px' }}>
        <span style={{ width:10, height:10, borderRadius:'50%', background:'#22c55e', display:'inline-block', animation:'pulse 1.5s infinite' }} />
        Loading V1 pipeline data…
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your feedback, evidence, and decision metrics
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {!hasData && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">No Data — Upload to Begin</Badge>}
          <button
            onClick={() => {
              const next = !liveMode
              setLiveModeState(next)
              setLiveMode(next)
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid',
              borderColor: liveMode ? '#22c55e' : '#6b7280',
              background: liveMode ? '#052e16' : 'transparent',
              color: liveMode ? '#22c55e' : '#9ca3af',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: liveMode ? '#22c55e' : '#6b7280',
              display: 'inline-block',
            }} />
            {liveMode ? 'V1' : 'V0'}
          </button>
        </div>
      </div>

      {/* Live mode banner */}
      {liveMode && liveLoading && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl border border-green-500/30 bg-green-500/5 text-sm text-green-600 dark:text-green-400">
          <Wifi className="w-4 h-4 animate-pulse shrink-0" />
          Loading V1 pipeline data…
        </div>
      )}
      {liveMode && liveError && (
        <div className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-sm text-red-500">
          V1 pipeline error: {liveError}
        </div>
      )}
      {liveMode && liveEvidence && !liveLoading && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl border border-green-500/40 bg-green-500/8 text-sm text-green-600 dark:text-green-400">
          <Wifi className="w-4 h-4 shrink-0" />
          V1 Intelligence Pipeline — {liveClusters} clusters · {liveTotalUsers} unique users · {liveRecCount} recommendations · model: {liveRun?.model_id}
        </div>
      )}

      {!hasData && !liveMode && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
          Upload feedback data on the Import Sources page, or enable V1 mode to show intelligence pipeline data.
        </div>
      )}

      {/* ── Top 4 Stat Cards ──────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="Total Feedback"
          value={displayTotal.toLocaleString()}
          change={hasData ? '+12%' : undefined}
          trend={hasData ? 'up' : undefined}
          icon={Database}
          gradient="from-blue-500/5 to-blue-500/10"
        />
        <StatCard
          title="Evidence Clusters"
          value={displayClusters}
          change={hasData ? '+2' : undefined}
          trend={hasData ? 'up' : undefined}
          icon={Shield}
          gradient="from-violet-500/5 to-violet-500/10"
        />
        <StatCard
          title="Avg Confidence"
          value={`${displayConfidence}%`}
          change={hasData ? '+3%' : undefined}
          trend={hasData ? 'up' : undefined}
          icon={TrendingUp}
          gradient="from-green-500/5 to-green-500/10"
        />
        <StatCard
          title="Analyzed"
          value={`${displayAnalyzed}%`}
          change={hasData ? '+5%' : undefined}
          trend={hasData ? 'up' : undefined}
          icon={CheckCircle2}
          gradient="from-orange-500/5 to-orange-500/10"
        />
      </div>

      {/* ── Lower Panels ──────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6">

        {/* Theme Rankings */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10">
                <BarChart3 className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="font-semibold text-foreground">Theme Rankings</h2>
            </div>
            <Badge variant="secondary">By confidence</Badge>
          </div>

          <div className="space-y-2">
            {!hasData && !liveMode && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Upload feedback data on the Import Sources page to see insights
              </div>
            )}
            {liveMode && liveEvidence && liveEvidence.map((ev, i) => {
              const confPct = Math.round(ev.confidence_score * 100)
              return (
                <motion.div
                  key={ev.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-500/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-foreground">{i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-sm leading-snug line-clamp-2">{ev.theme.split(' | ')[0]}</p>
                      <p className="text-sm text-muted-foreground">{ev.unique_user_count} unique users · {Object.keys(ev.source_lineage).map(k => getSourceLabel(k)).join(' · ')}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-foreground">{confPct}%</p>
                    <p className="text-xs text-muted-foreground">confidence</p>
                  </div>
                </motion.div>
              )
            })}
            {!liveMode && hasData && VELOQUITY_THEMES.map((theme, i) => {
              const TrendIcon =
                theme.trend === 'rising'    ? TrendingUp  :
                theme.trend === 'declining' ? TrendingDown : Minus
              const trendColor =
                theme.trend === 'rising'    ? 'text-green-600'        :
                theme.trend === 'declining' ? 'text-red-600'          :
                                              'text-muted-foreground'
              return (
                <motion.div
                  key={theme.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-foreground">{i + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{theme.name}</p>
                      <p className="text-sm text-muted-foreground">{theme.feedbackCount} feedback items</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-foreground">{theme.avgConfidence}%</p>
                      <p className="text-xs text-muted-foreground">confidence</p>
                    </div>
                    <div className={`flex items-center gap-1 ${trendColor}`}>
                      <TrendIcon className="w-4 h-4" />
                      <span className="text-sm font-medium capitalize">{theme.trend}</span>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Confidence Distribution */}
        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-orange-500/10">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="font-semibold text-foreground">Confidence Distribution</h2>
          </div>

          {(!hasData && !liveMode) ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Upload feedback data on the Import Sources page to see insights
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {CONFIDENCE_BUCKETS.map((range, i) => (
                  <div key={range.label} className="flex items-center gap-4">
                    <span className="w-16 text-sm text-muted-foreground">{range.label}</span>
                    <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(range.count / bucketMax) * 100}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={`h-full ${range.color} rounded-lg`}
                      />
                    </div>
                    <span className="w-10 text-sm font-medium text-foreground text-right">
                      {range.count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-6">
                {liveMode && liveEvidence
                  ? `Distribution across all ${liveEvidence.reduce((sum, e) => sum + (e.item_count > 0 ? e.item_count : e.unique_user_count), 0).toLocaleString()} feedback items — ${liveEvidence.length} clusters accepted at ≥ 0.60 confidence threshold.`
                  : `Distribution across all ${TOTAL_FEEDBACK.toLocaleString()} feedback items — ${EVIDENCE_CLUSTERS} clusters accepted at ≥ 0.60 confidence threshold.`
                }
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  )
}