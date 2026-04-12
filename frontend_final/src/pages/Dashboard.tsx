import { useEffect, useState } from 'react'
import type React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, TrendingDown, Minus, Database, Shield, ArrowUpRight, ArrowDownRight, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MOCK_EVIDENCE, HOSPITAL_MOCK_DATA } from '@/api/mockData'
import { getEvidence } from '@/api/client'
import { hasUploadedData, getActiveDataset } from '@/utils/uploadState'

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

  useEffect(() => {
    if (!hasData) return
    getEvidence()
      .then((r) => { if (r && r.length > 0) setEvidence(r as any) })
      .catch(() => {})
  }, [hasData])

  const bucketMax = Math.max(...CONFIDENCE_BUCKETS.map((b) => b.count))

  const displayTotal      = hasData ? TOTAL_FEEDBACK    : 0
  const displayClusters   = hasData ? EVIDENCE_CLUSTERS : 0
  const displayConfidence = hasData ? AVG_CONFIDENCE    : 0
  const displayAnalyzed   = hasData ? ANALYZED_PCT      : 0

  return (
    <div className="p-6">
      <div className="mb-8 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Overview of your feedback, evidence, and decision metrics
          </p>
        </div>
        {!hasData && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">No Data — Upload to Begin</Badge>}
      </div>

      {!hasData && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
          Upload feedback data on the Import Sources page to see insights
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
            {!hasData && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Upload feedback data on the Import Sources page to see insights
              </div>
            )}
            {hasData && VELOQUITY_THEMES.map((theme, i) => {
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

          {!hasData ? (
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
                Distribution across all {TOTAL_FEEDBACK.toLocaleString()} feedback items —
                {' '}{EVIDENCE_CLUSTERS} clusters accepted at ≥ 0.60 confidence threshold.
              </p>
            </>
          )}
        </div>

      </div>
    </div>
  )
}