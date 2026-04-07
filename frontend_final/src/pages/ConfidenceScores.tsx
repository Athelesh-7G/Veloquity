import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { hasUploadedData, getActiveDataset } from '@/utils/uploadState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Scale, Info, TrendingUp, TrendingDown, Minus, AlertTriangle,
  CheckCircle2, BarChart3, RefreshCw, ChevronDown, ChevronUp,
  Layers, Users, Hash, ShieldCheck
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type Trend = 'up' | 'down' | 'stable'

interface ConfidenceMetric {
  id: string
  clusterId: string
  name: string
  score: number                  // 0–100 point estimate
  uncertainty: number            // ± spread
  trend: Trend
  feedbackCount: number
  uniqueUsers: number
  sources: string[]
  category: 'Technical' | 'Feature' | 'UX'
  // Veloquity priority formula components
  w_confidence: number           // 0.35 weight component
  w_userCount: number            // 0.25 weight component (normalised)
  w_sourceCorr: number           // 0.20 weight component
  w_recency: number              // 0.20 weight component
  priorityScore: number          // final weighted score
  factors: string[]
  lastValidated: string
}

// ─── App product clusters (547 items, 6 clusters, avg conf 84%) ──────────────
const APP_INITIAL_METRICS: ConfidenceMetric[] = [
  {
    id: 'ev1', clusterId: 'c1',
    name: 'App crashes on project switch',
    score: 91, uncertainty: 7, trend: 'up',
    feedbackCount: 138, uniqueUsers: 94,
    sources: ['App Store', 'Zendesk'],
    category: 'Technical',
    w_confidence: 91 * 0.35,
    w_userCount:  Math.min(94 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.97 * 0.20 * 100,
    priorityScore: 87,
    factors: ['Cross-source corroboration (App Store + Zendesk)', 'High unique user count (94)', 'Regression introduced in v2.4', 'Null pointer reproducible in crash logs'],
    lastValidated: '2026-03-10',
  },
  {
    id: 'ev2', clusterId: 'c2',
    name: 'Black screen after latest update',
    score: 87, uncertainty: 9, trend: 'up',
    feedbackCount: 112, uniqueUsers: 78,
    sources: ['App Store', 'Zendesk'],
    category: 'Technical',
    w_confidence: 87 * 0.35,
    w_userCount:  Math.min(78 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.96 * 0.20 * 100,
    priorityScore: 83,
    factors: ['Cold-start only — warm restart works', 'Likely async init deadlock post v2.4', 'Both iOS and macOS affected', 'Cross-source corroboration'],
    lastValidated: '2026-03-10',
  },
  {
    id: 'ev3', clusterId: 'c3',
    name: 'Dashboard load time regression',
    score: 86, uncertainty: 8, trend: 'stable',
    feedbackCount: 94, uniqueUsers: 61,
    sources: ['App Store', 'Zendesk'],
    category: 'Technical',
    w_confidence: 86 * 0.35,
    w_userCount:  Math.min(61 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.95 * 0.20 * 100,
    priorityScore: 80,
    factors: ['2s → 12s load time measured objectively', 'Scales with project count (enterprise impact)', 'Frontend render cycle changed in v2.4', 'Not a backend issue — API latency unchanged'],
    lastValidated: '2026-03-10',
  },
  {
    id: 'ev4', clusterId: 'c4',
    name: 'No onboarding checklist for new users',
    score: 81, uncertainty: 10, trend: 'up',
    feedbackCount: 82, uniqueUsers: 67,
    sources: ['App Store', 'Zendesk'],
    category: 'UX',
    w_confidence: 81 * 0.35,
    w_userCount:  Math.min(67 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.93 * 0.20 * 100,
    priorityScore: 76,
    factors: ['High new-user drop-off signal', 'Team onboarding cost: 30 min per user', 'Feature absent since product launch', 'Competitor benchmarks cited in feedback'],
    lastValidated: '2026-03-09',
  },
  {
    id: 'ev5', clusterId: 'c5',
    name: 'Export to CSV silently fails',
    score: 77, uncertainty: 11, trend: 'down',
    feedbackCount: 58, uniqueUsers: 39,
    sources: ['App Store', 'Zendesk'],
    category: 'Feature',
    w_confidence: 77 * 0.35,
    w_userCount:  Math.min(39 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.91 * 0.20 * 100,
    priorityScore: 70,
    factors: ['Silent failure — no error surfaced to user', 'Affects large datasets (>100 rows)', 'Likely server-side timeout with no fallback', 'Blocks weekly reporting workflows'],
    lastValidated: '2026-03-09',
  },
  {
    id: 'ev6', clusterId: 'c6',
    name: 'Notification delay on mobile',
    score: 72, uncertainty: 13, trend: 'stable',
    feedbackCount: 37, uniqueUsers: 28,
    sources: ['App Store', 'Zendesk'],
    category: 'Feature',
    w_confidence: 72 * 0.35,
    w_userCount:  Math.min(28 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.88 * 0.20 * 100,
    priorityScore: 63,
    factors: ['20–40 min push latency on iOS and Android', 'Email notifications unaffected', 'Device background refresh confirmed on', 'Server-side delivery queue suspected'],
    lastValidated: '2026-03-08',
  },
]

// ─── Hospital clusters (310 items, 4 clusters, avg conf 81%) ──────────────────
const HOSPITAL_INITIAL_METRICS: ConfidenceMetric[] = [
  {
    id: 'hev1', clusterId: 'hc1',
    name: 'Extended Emergency Wait Times',
    score: 91, uncertainty: 8, trend: 'up',
    feedbackCount: 98, uniqueUsers: 87,
    sources: ['Patient Portal', 'Hospital Survey'],
    category: 'Technical',
    w_confidence: 91 * 0.35,
    w_userCount:  Math.min(87 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.97 * 0.20 * 100,
    priorityScore: 78,
    factors: ['Cross-source corroboration (Portal + Survey)', 'High unique patient count (87)', 'Rising trend — wait times doubling year-over-year', 'Direct patient safety implications'],
    lastValidated: '2026-03-15',
  },
  {
    id: 'hev2', clusterId: 'hc2',
    name: 'Online Appointment Booking Failures',
    score: 84, uncertainty: 9, trend: 'stable',
    feedbackCount: 76, uniqueUsers: 71,
    sources: ['Patient Portal', 'Hospital Survey'],
    category: 'Technical',
    w_confidence: 84 * 0.35,
    w_userCount:  Math.min(71 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0.1 * 0.20 * 100,
    w_recency:    0.96 * 0.20 * 100,
    priorityScore: 76,
    factors: ['Portal crash on confirmation screen', 'Double-booking incidents confirmed', 'Stable trend but no improvement observed', 'No confirmation email compounds uncertainty'],
    lastValidated: '2026-03-15',
  },
  {
    id: 'hev3', clusterId: 'hc3',
    name: 'Billing Statement Errors and Confusion',
    score: 78, uncertainty: 10, trend: 'stable',
    feedbackCount: 82, uniqueUsers: 58,
    sources: ['Hospital Survey'],
    category: 'Feature',
    w_confidence: 78 * 0.35,
    w_userCount:  Math.min(58 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0,
    w_recency:    0.95 * 0.20 * 100,
    priorityScore: 71,
    factors: ['Insurance pre-auth not applied at billing', 'Duplicate bills for same stay reported', 'Single-source (survey only) — no portal corroboration', 'Financial harm and legal risk to patients'],
    lastValidated: '2026-03-15',
  },
  {
    id: 'hev4', clusterId: 'hc4',
    name: 'Medical Records Portal Access Issues',
    score: 72, uncertainty: 11, trend: 'down',
    feedbackCount: 54, uniqueUsers: 44,
    sources: ['Patient Portal'],
    category: 'Technical',
    w_confidence: 72 * 0.35,
    w_userCount:  Math.min(44 / 50, 1.0) * 0.25 * 100,
    w_sourceCorr: 0,
    w_recency:    0.93 * 0.20 * 100,
    priorityScore: 66,
    factors: ['Password reset loop — 3+ attempts to unlock', 'Android crash on portal app launch', 'Decreasing trend — likely partially addressed', 'Medication list data sync errors persist'],
    lastValidated: '2026-03-14',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getScoreColor(score: number) {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

function getScoreStroke(score: number) {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#f59e0b'
  return '#ef4444'
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up')     return <TrendingUp   className="w-4 h-4 text-emerald-500" />
  if (trend === 'down')   return <TrendingDown  className="w-4 h-4 text-red-500" />
  return                         <Minus         className="w-4 h-4 text-muted-foreground" />
}

function CategoryBadge({ category }: { category: ConfidenceMetric['category'] }) {
  const map = {
    Technical: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    Feature:   'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    UX:        'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  }
  return <Badge className={`${map[category]} border-0 text-[10px]`}>{category}</Badge>
}

// ─── Circular gauge ───────────────────────────────────────────────────────────
function CircleGauge({
  score, uncertainty, showUncertainty,
}: { score: number; uncertainty: number; showUncertainty: boolean }) {
  const r        = 36
  const circ     = 2 * Math.PI * r         // 226.2
  const scoreArc = (score / 100) * circ
  const bandArc  = (Math.min(score + uncertainty, 100) / 100) * circ

  return (
    <div className="relative w-20 h-20 mx-auto">
      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
        {/* Track */}
        <circle cx="40" cy="40" r={r} stroke="currentColor" strokeWidth="6"
          fill="none" className="text-muted/20" />
        {/* Uncertainty band */}
        {showUncertainty && (
          <circle cx="40" cy="40" r={r} stroke="currentColor" strokeWidth="6"
            fill="none" strokeDasharray={`${bandArc} ${circ}`}
            className="text-violet-400/25" />
        )}
        {/* Score arc */}
        <motion.circle
          cx="40" cy="40" r={r}
          stroke={getScoreStroke(score)}
          strokeWidth="6" fill="none"
          strokeDasharray={`${scoreArc} ${circ}`}
          initial={{ strokeDasharray: `0 ${circ}` }}
          animate={{ strokeDasharray: `${scoreArc} ${circ}` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${getScoreColor(score)}`}>{score}%</span>
      </div>
    </div>
  )
}

// ─── Priority weight breakdown bar ───────────────────────────────────────────
function PriorityBreakdown({ metric }: { metric: ConfidenceMetric }) {
  const segments = [
    { label: 'Confidence ×0.35',     value: metric.w_confidence, color: 'bg-blue-500'   },
    { label: 'User count ×0.25',     value: metric.w_userCount,  color: 'bg-violet-500' },
    { label: 'Source corr. ×0.20',   value: metric.w_sourceCorr, color: 'bg-green-500'  },
    { label: 'Recency ×0.20',        value: metric.w_recency,    color: 'bg-orange-500' },
  ]
  const total = segments.reduce((s, x) => s + x.value, 0)

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-foreground">Priority Score Breakdown — {metric.priorityScore}/100</p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {segments.map((seg) => (
          <motion.div
            key={seg.label}
            className={seg.color}
            initial={{ flex: 0 }}
            animate={{ flex: seg.value / total }}
            transition={{ duration: 0.6 }}
          />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${seg.color} shrink-0`} />
            <span className="text-xs text-muted-foreground">{seg.label}</span>
            <span className="text-xs font-medium text-foreground ml-auto">{seg.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Single metric card ───────────────────────────────────────────────────────
function MetricCard({
  metric, showUncertainty, onRecalculate,
}: {
  metric: ConfidenceMetric
  showUncertainty: boolean
  onRecalculate: (id: string) => void
}) {
  const [expanded,    setExpanded]    = useState(false)
  const [recalcing,   setRecalcing]   = useState(false)

  const handleRecalculate = () => {
    setRecalcing(true)
    setTimeout(() => { setRecalcing(false); onRecalculate(metric.id) }, 1600)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-violet-500/30 transition-colors"
    >
      {/* ── Main row ──────────────────────────────────────────────────────── */}
      <div className="p-4 flex items-start gap-5">
        {/* Circle gauge */}
        <div className="shrink-0 text-center w-24">
          <CircleGauge score={metric.score} uncertainty={metric.uncertainty} showUncertainty={showUncertainty} />
          {showUncertainty && (
            <p className="text-xs text-muted-foreground mt-1">±{metric.uncertainty}%</p>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-foreground">{metric.name}</h3>
            <TrendIcon trend={metric.trend} />
            <CategoryBadge category={metric.category} />
          </div>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Hash className="w-3 h-3" />{metric.feedbackCount} items
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />{metric.uniqueUsers} users
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Layers className="w-3 h-3" />{metric.sources.join(' + ')}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="w-3 h-3 text-green-500" />Validated {metric.lastValidated}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {metric.factors.slice(0, 2).map((f, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] font-normal">{f}</Badge>
            ))}
            {metric.factors.length > 2 && (
              <Badge variant="secondary" className="text-[10px] font-normal">
                +{metric.factors.length - 2} more
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex flex-col gap-2 items-end">
          <Button
            variant="outline" size="sm" className="bg-transparent w-28"
            onClick={handleRecalculate} disabled={recalcing}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${recalcing ? 'animate-spin text-violet-500' : ''}`} />
            {recalcing ? 'Running…' : 'Recalculate'}
          </Button>
          <Button
            variant="ghost" size="sm" className="w-28"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded
              ? <><ChevronUp   className="w-3.5 h-3.5 mr-1.5" />Less</>
              : <><ChevronDown className="w-3.5 h-3.5 mr-1.5" />Details</>}
          </Button>
        </div>
      </div>

      {/* ── Expanded panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-border space-y-5">
              <div className="pt-4">
                <PriorityBreakdown metric={metric} />
              </div>

              {/* All factors */}
              <div>
                <p className="text-xs font-medium text-foreground mb-2">All Contributing Factors</p>
                <div className="flex flex-wrap gap-1.5">
                  {metric.factors.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{f}</Badge>
                  ))}
                </div>
              </div>

              {/* Formula note */}
              <div className="p-3 bg-gradient-to-r from-blue-500/5 to-violet-500/5 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">Confidence formula: </span>
                  <code className="bg-muted px-1 rounded">clamp(1.0 - variance × 2.0, 0.0, 1.0)</code>
                  {' '}where variance = mean cosine distance of member vectors from cluster centroid.
                  Priority score = conf×0.35 + users×0.25 + sourceCorr×0.20 + recency×0.20.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfidenceScores() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()
  const [metrics, setMetrics] = useState<ConfidenceMetric[]>(
    dataset === 'hospital_survey' ? HOSPITAL_INITIAL_METRICS : APP_INITIAL_METRICS
  )
  const [showUncertainty, setShowUncertainty] = useState(true)
  const [threshold, setThreshold]         = useState([60])   // default: Veloquity's auto-accept threshold

  // Recalculate: small random jitter simulating re-embedding run
  const handleRecalculate = (id: string) => {
    setMetrics((prev) => prev.map((m) => {
      if (m.id !== id) return m
      const delta = Math.floor(Math.random() * 5) - 2  // ±2
      const newScore = Math.min(100, Math.max(0, m.score + delta))
      return {
        ...m,
        score: newScore,
        w_confidence: newScore * 0.35,
        priorityScore: Math.min(100, Math.max(0, m.priorityScore + delta)),
        lastValidated: new Date().toISOString().split('T')[0],
      }
    }))
  }

  const visible  = hasData ? metrics.filter((m) => m.score >= threshold[0]).sort((a, b) => b.score - a.score) : []
  const avgScore = hasData ? Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length) : 0
  const highConf = hasData ? metrics.filter((m) => m.score >= 80).length : 0
  const needsRev = hasData ? metrics.filter((m) => m.score >= 60 && m.score < 80).length : 0
  const lowConf  = hasData ? metrics.filter((m) => m.score < 60).length : 0

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Confidence Scores</h1>
          <p className="text-muted-foreground mt-1">
            Per-cluster certainty from Titan Embed V2 cosine variance · priority formula breakdown
          </p>
        </div>
        {hasData
          ? <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">Demo Data Active</Badge>
          : <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">No Data — Upload to Begin</Badge>
        }
      </div>

      {!hasData && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
          Upload feedback data on the Import Sources page to see insights
        </div>
      )}

      {/* ── Controls ───────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="show-uncertainty"
                checked={showUncertainty}
                onCheckedChange={setShowUncertainty}
              />
              <Label htmlFor="show-uncertainty">Show uncertainty bands</Label>
            </div>
            <div className="flex items-center gap-4 flex-1 min-w-[220px]">
              <Label className="whitespace-nowrap text-sm">
                Min threshold:
              </Label>
              <Slider
                value={threshold}
                onValueChange={setThreshold}
                min={0} max={100} step={5}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-right">{threshold[0]}%</span>
            </div>
            {threshold[0] !== 60 && (
              <Button
                variant="ghost" size="sm" className="text-xs text-muted-foreground"
                onClick={() => setThreshold([60])}
              >
                Reset to 60% (Veloquity default)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Summary stats ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Avg Confidence',  value: `${avgScore}%`, icon: Scale,         color: 'blue'    },
          { label: 'High Confidence', value: highConf,        icon: CheckCircle2,  color: 'emerald' },
          { label: 'Needs Review',    value: needsRev,        icon: AlertTriangle, color: 'amber'   },
          { label: 'Low Confidence',  value: lowConf,         icon: BarChart3,     color: 'red'     },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-3xl font-bold ${
                    color === 'blue'    ? 'text-foreground'           :
                    color === 'emerald'? 'text-emerald-600 dark:text-emerald-400' :
                    color === 'amber'  ? 'text-amber-600 dark:text-amber-400'    :
                                        'text-red-600 dark:text-red-400'
                  }`}>{value}</p>
                </div>
                <div className={`p-3 rounded-full bg-${color}-500/10`}>
                  <Icon className={`w-5 h-5 text-${color}-600`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Metric cards ───────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Showing {visible.length} of {metrics.length} clusters (threshold: ≥ {threshold[0]}%)
        </p>
        <AnimatePresence>
          {visible.map((metric, i) => (
            <motion.div
              key={metric.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: i * 0.05 }}
            >
              <MetricCard
                metric={metric}
                showUncertainty={showUncertainty}
                onRecalculate={handleRecalculate}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {visible.length === 0 && (
          <div className="text-center py-10 text-muted-foreground">
            <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {hasData
                ? `No clusters meet the ${threshold[0]}% threshold. Lower the slider to see more.`
                : 'Upload feedback data on the Import Sources page to see insights'}
            </p>
          </div>
        )}
      </div>

      {/* ── How it works ───────────────────────────────────────────────────── */}
      <Card className="bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-orange-500/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="w-5 h-5 text-violet-600" />How Veloquity Confidence Scores Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <p>
            Each score is derived from cosine variance across the member embeddings of a pgvector cluster:
          </p>
          <div className="p-3 bg-muted/50 rounded-lg font-mono text-xs">
            distance = 1 - cosine_similarity(member_vector, centroid)<br />
            variance = mean(distances)<br />
            confidence = clamp(1.0 - variance × 2.0, 0.0, 1.0)
          </div>
          <p>The four priority-score weights:</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { w: '0.35', label: 'Confidence score',    note: 'Clustering algorithm certainty'       },
              { w: '0.25', label: 'Unique user count',   note: 'Capped at 50 users = 1.0'             },
              { w: '0.20', label: 'Source corroboration',note: '+0.1 if both App Store + Zendesk'     },
              { w: '0.20', label: 'Recency score',       note: 'Linear decay to 0 over 90 days'       },
            ].map(({ w, label, note }) => (
              <div key={label} className="p-2 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-foreground">×{w}</span>
                  <span className="text-xs font-medium text-foreground">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{note}</p>
              </div>
            ))}
          </div>
          <p className="text-xs">
            Clusters scoring ≥ 0.60 are auto-accepted into evidence. 0.40–0.59 triggers LLM validation
            via <code className="bg-muted px-1 rounded">us.amazon.nova-pro-v1:0</code>.
            Below 0.40 goes to staging.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}