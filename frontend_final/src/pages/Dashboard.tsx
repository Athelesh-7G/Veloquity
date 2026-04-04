import { useEffect, useState } from 'react'
import type React from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Database,
  Shield, ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, RefreshCw, Wifi,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MOCK_EVIDENCE, MOCK_RECOMMENDATIONS } from '@/api/mockData'
import { getEvidence, getRecommendations } from '@/api/client'
import { useDataMode, useRefreshCount } from '@/context/DataModeContext'
import { getUploadSummary } from '@/utils/uploadState'

// ─── Mock data ────────────────────────────────────────────────────────────────
const TOTAL_FEEDBACK    = 547
const EVIDENCE_CLUSTERS = 6
const AVG_CONFIDENCE    = 84
const ANALYZED_PCT      = 91

const VELOQUITY_THEMES = [
  { id: 't1', name: 'App crashes on project switch',         feedbackCount: 138, avgConfidence: 91, trend: 'rising'   },
  { id: 't2', name: 'Black screen after latest update',      feedbackCount: 112, avgConfidence: 87, trend: 'rising'   },
  { id: 't3', name: 'Dashboard load time regression',        feedbackCount:  94, avgConfidence: 85, trend: 'stable'   },
  { id: 't4', name: 'No onboarding checklist for new users', feedbackCount:  82, avgConfidence: 81, trend: 'rising'   },
  { id: 't5', name: 'Export to CSV silently fails',          feedbackCount:  58, avgConfidence: 76, trend: 'declining'},
  { id: 't6', name: 'Notification delay on mobile',          feedbackCount:  37, avgConfidence: 71, trend: 'stable'   },
]

const CONFIDENCE_BUCKETS_MOCK = [
  { label: '90-100%', count: 153, color: 'bg-green-500'  },
  { label: '70-89%',  count: 235, color: 'bg-blue-500'   },
  { label: '50-69%',  count: 109, color: 'bg-orange-500' },
  { label: '<50%',    count:  50, color: 'bg-red-500'     },
]

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  title, value, change, trend, icon: Icon, gradient,
}: {
  title: string; value: string | number; change?: string
  trend?: 'up' | 'down' | 'neutral'; icon: React.ElementType; gradient: string
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

// ─── Live data types ──────────────────────────────────────────────────────────
interface LiveTheme {
  id: string; name: string; feedbackCount: number; avgConfidence: number; trend: 'rising' | 'stable' | 'declining'
}

export default function Dashboard() {
  const { isLive }      = useDataMode()
  const refreshCount    = useRefreshCount()

  // live state
  const [liveThemes, setLiveThemes]         = useState<LiveTheme[]>([])
  const [liveTotal, setLiveTotal]           = useState(0)
  const [liveAvgConf, setLiveAvgConf]       = useState(0)
  const [liveClusterCount, setLiveClusterCount] = useState(0)
  const [loadingLive, setLoadingLive]       = useState(false)
  const [liveError, setLiveError]           = useState<string | null>(null)

  const uploadTotal = getUploadSummary()

  useEffect(() => {
    if (!isLive) return
    setLoadingLive(true)
    setLiveError(null)

    Promise.all([getEvidence(), getRecommendations().catch(() => null)]).then(([ev]) => {
      if (!ev || ev.length === 0) {
        setLiveError('No active evidence clusters found. Run the pipeline to generate data.')
        return
      }
      const themes: LiveTheme[] = ev.map((e) => ({
        id: e.id,
        name: e.theme,
        feedbackCount: e.unique_user_count,
        avgConfidence: Math.round(e.confidence_score * 100),
        trend: 'stable' as const,
      }))
      setLiveThemes(themes)
      setLiveClusterCount(ev.length)
      setLiveAvgConf(Math.round(ev.reduce((s, e) => s + e.confidence_score * 100, 0) / ev.length))
      setLiveTotal(ev.reduce((s, e) => s + e.unique_user_count, 0))
    }).catch((e) => {
      setLiveError(e instanceof Error ? e.message : 'Failed to load data')
    }).finally(() => setLoadingLive(false))
  }, [isLive, refreshCount])

  const bucketMax = Math.max(...CONFIDENCE_BUCKETS_MOCK.map((b) => b.count))

  // ── Live data render ────────────────────────────────────────────────────────
  if (isLive) {
    if (loadingLive) {
      return (
        <div className="p-6 flex items-center justify-center min-h-[60vh] gap-3 text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading live data…</span>
        </div>
      )
    }
    if (liveError) {
      return (
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5">
              <Wifi className="w-3 h-3" />Live Data
            </Badge>
          </div>
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4">
            <AlertCircle className="w-10 h-10 text-red-500 opacity-60" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">{liveError}</p>
            <Button variant="outline" size="sm" onClick={() => { setLiveError(null); setLoadingLive(true) }}>
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
          </div>
        </div>
      )
    }

    const liveBuckets = [
      { label: '90-100%', count: liveThemes.filter((t) => t.avgConfidence >= 90).length, color: 'bg-green-500'  },
      { label: '70-89%',  count: liveThemes.filter((t) => t.avgConfidence >= 70 && t.avgConfidence < 90).length, color: 'bg-blue-500' },
      { label: '50-69%',  count: liveThemes.filter((t) => t.avgConfidence >= 50 && t.avgConfidence < 70).length, color: 'bg-orange-500' },
      { label: '<50%',    count: liveThemes.filter((t) => t.avgConfidence < 50).length, color: 'bg-red-500' },
    ]
    const liveBucketMax = Math.max(1, ...liveBuckets.map((b) => b.count))

    return (
      <div className="p-6">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5">
                <Wifi className="w-3 h-3" />Live Data
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">Overview of your uploaded feedback and evidence clusters</p>
          </div>
        </div>

        {uploadTotal > 0 && (
          <div className="flex items-center gap-2 px-4 py-3 mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            Showing results from your {uploadTotal.toLocaleString()} uploaded feedback items
          </div>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard title="Total Feedback"     value={liveTotal.toLocaleString()} icon={Database}      gradient="from-blue-500/5 to-blue-500/10" />
          <StatCard title="Evidence Clusters"  value={liveClusterCount}            icon={Shield}        gradient="from-violet-500/5 to-violet-500/10" />
          <StatCard title="Avg Confidence"     value={`${liveAvgConf}%`}           icon={TrendingUp}    gradient="from-green-500/5 to-green-500/10" />
          <StatCard title="Clusters Active"    value={liveClusterCount}            icon={CheckCircle2}  gradient="from-orange-500/5 to-orange-500/10" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
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
              {liveThemes.map((theme, i) => (
                <motion.div
                  key={theme.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between p-4 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-foreground">{i + 1}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{theme.name}</p>
                      <p className="text-sm text-muted-foreground">{theme.feedbackCount} unique users</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className="font-bold text-foreground">{theme.avgConfidence}%</p>
                    <p className="text-xs text-muted-foreground">confidence</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-card border border-border rounded-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-orange-500/10">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="font-semibold text-foreground">Confidence Distribution</h2>
            </div>
            <div className="space-y-4">
              {liveBuckets.map((range, i) => (
                <div key={range.label} className="flex items-center gap-4">
                  <span className="w-16 text-sm text-muted-foreground">{range.label}</span>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(range.count / liveBucketMax) * 100}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 }}
                      className={`h-full ${range.color} rounded-lg`}
                    />
                  </div>
                  <span className="w-8 text-sm font-medium text-foreground text-right">{range.count}</span>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground mt-6">
              Distribution across {liveClusterCount} active evidence clusters.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Demo data render ────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your feedback, evidence, and decision metrics</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Feedback"   value={TOTAL_FEEDBACK.toLocaleString()} change="+12%" trend="up" icon={Database}     gradient="from-blue-500/5 to-blue-500/10" />
        <StatCard title="Evidence Clusters" value={EVIDENCE_CLUSTERS}              change="+2"   trend="up" icon={Shield}        gradient="from-violet-500/5 to-violet-500/10" />
        <StatCard title="Avg Confidence"   value={`${AVG_CONFIDENCE}%`}           change="+3%"  trend="up" icon={TrendingUp}    gradient="from-green-500/5 to-green-500/10" />
        <StatCard title="Analyzed"         value={`${ANALYZED_PCT}%`}             change="+5%"  trend="up" icon={CheckCircle2}  gradient="from-orange-500/5 to-orange-500/10" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
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
            {VELOQUITY_THEMES.map((theme, i) => {
              const TrendIcon =
                theme.trend === 'rising'    ? TrendingUp  :
                theme.trend === 'declining' ? TrendingDown : Minus
              const trendColor =
                theme.trend === 'rising'    ? 'text-green-600' :
                theme.trend === 'declining' ? 'text-red-600'   : 'text-muted-foreground'
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

        <div className="p-6 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/10 to-orange-500/10">
              <TrendingUp className="w-5 h-5 text-violet-600" />
            </div>
            <h2 className="font-semibold text-foreground">Confidence Distribution</h2>
          </div>
          <div className="space-y-4">
            {CONFIDENCE_BUCKETS_MOCK.map((range, i) => (
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
                <span className="w-10 text-sm font-medium text-foreground text-right">{range.count}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-6">
            Distribution across all {TOTAL_FEEDBACK.toLocaleString()} feedback items —{' '}
            {EVIDENCE_CLUSTERS} clusters accepted at ≥ 0.60 confidence threshold.
          </p>
        </div>
      </div>
    </div>
  )
}
