import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sliders, RotateCcw, Download, CheckCircle2, Clock, XCircle, Zap, Shield, TrendingUp, TrendingDown, Minus, Users, Hash, Layers, ArrowRight, ChevronDown, ChevronUp, AlertTriangle, Sparkles, Target } from 'lucide-react'
import { hasUploadedData } from '@/utils/uploadState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
type Decision = 'prioritize' | 'consider' | 'defer'
type Trend     = 'rising' | 'stable' | 'declining'
type Category  = 'Technical' | 'Feature' | 'UX'

interface Cluster {
  id: string
  name: string
  confidence: number       // 0–100
  uncertainty: number      // ± spread
  feedbackCount: number
  uniqueUsers: number
  sources: string[]
  category: Category
  trend: Trend
  priorityScore: number    // weighted 0–100
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  rationale: string        // PM-facing explanation
  riskFlags: string[]
  tradeoff: string
}

// ─── The 6 Veloquity clusters ─────────────────────────────────────────────────
const CLUSTERS: Cluster[] = [
  {
    id: 'c1',
    name: 'App crashes on project switch',
    confidence: 91, uncertainty: 7,
    feedbackCount: 138, uniqueUsers: 94,
    sources: ['App Store', 'Zendesk'],
    category: 'Technical', trend: 'rising',
    priorityScore: 87,
    effort: 'high', impact: 'high',
    rationale: 'Highest-confidence cluster in the corpus. 138 reports across both sources with reproducible crash logs pointing to a null pointer in the project context handler — introduced in v2.4. 94 unique users affected with rising signal velocity means this is actively damaging retention.',
    riskFlags: ['Active regression since v2.4', 'Rising signal velocity', 'Cross-source corroboration'],
    tradeoff: 'High engineering effort required (context lifecycle refactor), but cost of inaction is measurable churn. Delaying by one sprint risks further 1-star reviews compounding.',
  },
  {
    id: 'c2',
    name: 'Black screen after latest update',
    confidence: 87, uncertainty: 9,
    feedbackCount: 112, uniqueUsers: 78,
    sources: ['App Store', 'Zendesk'],
    category: 'Technical', trend: 'rising',
    priorityScore: 83,
    effort: 'medium', impact: 'high',
    rationale: 'Cold-start async init deadlock introduced in v2.4 — warm restarts work fine. Confirmed on iOS 17.3+, iOS 17.4, and macOS. 78 unique users reporting first-impression failure. Medium effort because the failure mode is isolated to cold-start initialisation path.',
    riskFlags: ['First-impression failure', 'iOS + macOS both affected', 'v2.4 regression'],
    tradeoff: 'Fixing the async init path is self-contained and reversible. Deferring this means every new install encounters a black screen, directly harming acquisition conversion.',
  },
  {
    id: 'c3',
    name: 'Dashboard load time regression',
    confidence: 86, uncertainty: 8,
    feedbackCount: 94, uniqueUsers: 61,
    sources: ['App Store', 'Zendesk'],
    category: 'Technical', trend: 'stable',
    priorityScore: 80,
    effort: 'medium', impact: 'high',
    rationale: 'Objectively measured: 2s → 12s load time post-v2.4. Backend API latency is unchanged — the regression lives in the frontend render cycle. Enterprise workspaces with 200+ projects are hardest hit. Parallel widget fetching likely removed or broken in the last release.',
    riskFlags: ['Enterprise accounts blocked', 'Objectively measurable regression', 'Scales with project count'],
    tradeoff: 'Performance investigation is medium effort. Risk of delaying: enterprise churns first because they feel the pain most acutely. Parallelising widget fetches is a well-understood fix.',
  },
  {
    id: 'c4',
    name: 'No onboarding checklist for new users',
    confidence: 81, uncertainty: 10,
    feedbackCount: 82, uniqueUsers: 67,
    sources: ['App Store', 'Zendesk'],
    category: 'UX', trend: 'rising',
    priorityScore: 76,
    effort: 'medium', impact: 'medium',
    rationale: 'Every new user requires a 30-minute manual walkthrough from an existing team member. Feedback consistently cites absence of a welcome checklist or setup wizard. High unique-user-to-feedback ratio (67/82) means this is broadly felt, not just vocal minorities.',
    riskFlags: ['High onboarding cost per user', 'Competitor gap cited in feedback', 'Affects all new signups'],
    tradeoff: 'Medium effort (5-step interactive checklist), meaningful reduction in onboarding friction and support tickets. Does not address existing user base but compounds positively with every new signup.',
  },
  {
    id: 'c5',
    name: 'Export to CSV silently fails',
    confidence: 77, uncertainty: 11,
    feedbackCount: 58, uniqueUsers: 39,
    sources: ['App Store', 'Zendesk'],
    category: 'Feature', trend: 'declining',
    priorityScore: 70,
    effort: 'low', impact: 'medium',
    rationale: 'Silent failure (success toast + empty file) for datasets >100 rows. Likely a server-side timeout with no fallback or error surfaced to the user. Blocks weekly reporting workflows for data-heavy teams. Declining trend suggests it may already be partially addressed or users found workarounds.',
    riskFlags: ['Silent failure harms trust', 'Blocks reporting workflows', 'No error surfaced to user'],
    tradeoff: 'Low effort fix (add timeout error handling + async download fallback). Declining trend means urgency is lower than crash clusters, but the trust impact of silent failures is disproportionate.',
  },
  {
    id: 'c6',
    name: 'Notification delay on mobile',
    confidence: 72, uncertainty: 13,
    feedbackCount: 37, uniqueUsers: 28,
    sources: ['App Store', 'Zendesk'],
    category: 'Feature', trend: 'stable',
    priorityScore: 63,
    effort: 'medium', impact: 'low',
    rationale: 'Push notifications arriving 20–40 minutes late on both iOS and Android. Email notifications unaffected. Background refresh confirmed on for all reporters. Likely a server-side delivery queue bottleneck. Smallest cluster with stable trend — lowest urgency of the six.',
    riskFlags: ['Server-side queue suspected', 'Team coordination use cases blocked'],
    tradeoff: 'Server-side queue investigation is medium effort with low-to-medium impact. Prioritising this over crash fixes would be a poor allocation. Revisit after c1–c3 are resolved.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const EFFORT_ORDER = { low: 0, medium: 1, high: 2 }
const IMPACT_ORDER = { low: 0, medium: 1, high: 2 }

function getDecision(
  cluster: Cluster,
  confThreshold: number,
  uncertaintyTolerance: number,
  minEvidence: number,
): Decision {
  const upperBound = cluster.confidence + cluster.uncertainty
  if (
    cluster.confidence >= confThreshold &&
    cluster.uncertainty <= uncertaintyTolerance &&
    cluster.feedbackCount >= minEvidence
  ) return 'prioritize'
  if (
    upperBound >= confThreshold &&
    cluster.feedbackCount >= minEvidence * 0.5
  ) return 'consider'
  return 'defer'
}

function decisionMeta(d: Decision) {
  return {
    prioritize: {
      label: 'Prioritize',
      icon: CheckCircle2,
      pill: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30',
      bar:  'bg-emerald-500',
      glow: 'shadow-[0_0_20px_rgba(16,185,129,0.12)]',
      ring: 'ring-emerald-500/30',
      left: 'border-l-4 border-emerald-500',
    },
    consider: {
      label: 'Consider',
      icon: Clock,
      pill: 'bg-amber-500/15 text-amber-500 border border-amber-500/30',
      bar:  'bg-amber-500',
      glow: 'shadow-[0_0_20px_rgba(245,158,11,0.10)]',
      ring: 'ring-amber-500/30',
      left: 'border-l-4 border-amber-500',
    },
    defer: {
      label: 'Defer',
      icon: XCircle,
      pill: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
      bar:  'bg-slate-500',
      glow: '',
      ring: 'ring-slate-500/20',
      left: 'border-l-4 border-slate-600',
    },
  }[d]
}

function trendIcon(t: Trend) {
  if (t === 'rising')   return <TrendingUp   className="w-3.5 h-3.5 text-red-400" />
  if (t === 'declining')return <TrendingDown  className="w-3.5 h-3.5 text-green-400" />
  return                       <Minus         className="w-3.5 h-3.5 text-slate-400" />
}

function effortColor(e: string) {
  return e === 'low' ? 'text-green-400' : e === 'medium' ? 'text-amber-400' : 'text-red-400'
}

function impactColor(i: string) {
  return i === 'high' ? 'text-violet-400' : i === 'medium' ? 'text-blue-400' : 'text-slate-400'
}

// ─── Confidence arc SVG ───────────────────────────────────────────────────────
function ConfidenceArc({ value, uncertainty, size = 72 }: { value: number; uncertainty: number; size?: number }) {
  const r = size * 0.40
  // Place cy so the arc sits in the upper portion; text fits below inside the viewBox
  const cx     = size / 2
  const cy     = size * 0.58          // was 0.72 — moved up so arc + text stay inside
  const svgH   = size * 0.72          // viewBox height — enough room for cy + text below

  const halfCirc = Math.PI * r
  const scoreArc = (value / 100) * halfCirc
  const bandArc  = (Math.min(value + uncertainty, 100) / 100) * halfCirc

  const strokeColor =
    value >= 80 ? '#10b981' :
    value >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <svg width={size} height={svgH} viewBox={`0 0 ${size} ${svgH}`} overflow="visible">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="5" strokeLinecap="round"
      />
      {/* Uncertainty band */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(139,92,246,0.20)" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${bandArc} ${halfCirc}`}
      />
      {/* Score arc */}
      <motion.path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={strokeColor} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={`${scoreArc} ${halfCirc}`}
        initial={{ strokeDasharray: `0 ${halfCirc}` }}
        animate={{ strokeDasharray: `${scoreArc} ${halfCirc}` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
      {/* Value label — centred in the arc bowl */}
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="14" fontWeight="800"
        fill={strokeColor} dominantBaseline="middle">{value}%</text>
      {/* ±uncertainty below */}
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="7.5"
        fill="rgba(148,163,184,0.75)" dominantBaseline="middle">±{uncertainty}%</text>
    </svg>
  )
}

// ─── Scenario result card ─────────────────────────────────────────────────────
function ScenarioCard({
  cluster, decision, rank, delay,
}: {
  cluster: Cluster; decision: Decision; rank: number; delay: number
}) {
  const [expanded, setExpanded] = useState(false)
  const meta = decisionMeta(decision)
  const DecIcon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ delay, duration: 0.35 }}
      layout
      className={cn(
        'bg-[#0F1729] rounded-2xl overflow-hidden transition-all duration-300',
        meta.left, meta.glow,
        expanded && `ring-1 ${meta.ring}`,
      )}
    >
      {/* ── Collapsed row ──────────────────────────────────────────────────── */}
      <button
        className="w-full text-left p-5 hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded((p) => !p)}
      >
        <div className="flex items-start gap-4">
          {/* Rank + arc */}
          <div className="shrink-0 flex flex-col items-center gap-1">
            <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
              <span className="text-xs font-bold text-slate-400">#{rank}</span>
            </div>
            <ConfidenceArc value={cluster.confidence} uncertainty={cluster.uncertainty} size={68} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h3 className="font-semibold text-white leading-snug text-sm">{cluster.name}</h3>
              <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0', meta.pill)}>
                <DecIcon className="w-3.5 h-3.5" />
                {meta.label}
              </div>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 flex-wrap mb-3">
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Hash className="w-3 h-3" />{cluster.feedbackCount} items
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Users className="w-3 h-3" />{cluster.uniqueUsers} users
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                {trendIcon(cluster.trend)}
                <span className="capitalize">{cluster.trend}</span>
              </span>
              <Badge className="text-[10px] border-0 bg-white/5 text-slate-300 font-normal px-1.5 py-0">
                {cluster.category}
              </Badge>
            </div>

            {/* Effort / Impact / Priority pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-[11px] font-medium capitalize', effortColor(cluster.effort))}>
                {cluster.effort} effort
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className={cn('text-[11px] font-medium capitalize', impactColor(cluster.impact))}>
                {cluster.impact} impact
              </span>
              <span className="text-slate-600 text-xs">·</span>
              <span className="text-[11px] text-slate-400">
                Priority score: <span className="text-white font-semibold">{cluster.priorityScore}</span>
              </span>
            </div>
          </div>

          {/* Expand toggle */}
          <div className="shrink-0 mt-1">
            {expanded
              ? <ChevronUp   className="w-4 h-4 text-slate-500" />
              : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </div>
        </div>

        {/* Priority score bar */}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div
              className={meta.bar}
              initial={{ width: 0 }}
              animate={{ width: `${cluster.priorityScore}%` }}
              transition={{ duration: 0.7, delay: delay + 0.2 }}
              style={{ height: '100%', borderRadius: 9999 }}
            />
          </div>
          <span className="text-[10px] text-slate-500 w-16 text-right">
            {cluster.sources.join(' + ')}
          </span>
        </div>
      </button>

      {/* ── Expanded rationale ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">

              {/* Rationale */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-xs font-semibold text-violet-300 uppercase tracking-wide">
                    Reasoning Agent Rationale
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{cluster.rationale}</p>
              </div>

              {/* Tradeoff */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-xs font-semibold text-amber-300 uppercase tracking-wide">
                    Tradeoff Analysis
                  </span>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{cluster.tradeoff}</p>
              </div>

              {/* Risk flags */}
              {cluster.riskFlags.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs font-semibold text-red-300 uppercase tracking-wide">
                      Risk Flags
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cluster.riskFlags.map((flag) => (
                      <span
                        key={flag}
                        className="px-2.5 py-1 rounded-full text-xs bg-red-500/10 text-red-300 border border-red-500/20"
                      >
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Decision context */}
              <div className={cn('p-3 rounded-xl text-xs leading-relaxed', {
                'bg-emerald-500/8 text-emerald-200 border border-emerald-500/15': decision === 'prioritize',
                'bg-amber-500/8 text-amber-200 border border-amber-500/15':   decision === 'consider',
                'bg-slate-500/8 text-slate-300 border border-slate-500/15':   decision === 'defer',
              })}>
                <span className="font-semibold">Why {meta.label}: </span>
                {decision === 'prioritize' && `Confidence (${cluster.confidence}%) clears threshold and uncertainty (±${cluster.uncertainty}%) is within tolerance. ${cluster.feedbackCount} evidence items meets the minimum. All three conditions satisfied — add to sprint backlog.`}
                {decision === 'consider'  && `Upper confidence bound (${cluster.confidence + cluster.uncertainty}%) reaches threshold but point estimate is below. Gather more evidence or lower uncertainty before committing. Keep in planning backlog.`}
                {decision === 'defer'     && `Point estimate (${cluster.confidence}%) or evidence volume (${cluster.feedbackCount} items) does not meet current thresholds. Monitor for signal growth. Re-evaluate next governance cycle.`}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Controls panel ───────────────────────────────────────────────────────────
function ControlSlider({
  label, sub, value, min, max, step, unit, onChange, color,
}: {
  label: string; sub: string; value: number; min: number; max: number
  step: number; unit: string; onChange: (v: number) => void; color: string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
        </div>
        <span className={cn('text-lg font-bold tabular-nums', color)}>
          {unit === '±' ? `±${value}%` : `${value}${unit}`}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min} max={max} step={step}
        className="w-full"
      />
      <div className="flex justify-between text-[10px] text-slate-600">
        <span>{min}{unit === '%' ? '%' : unit === '±' ? '% band' : ' items'}</span>
        <span>{max}{unit === '%' ? '%' : unit === '±' ? '% band' : ' items'}</span>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
const DEFAULT_CONF = 75
const DEFAULT_UNC  = 15
const DEFAULT_EV   = 40

export default function DecisionPlayground() {
  const hasData = hasUploadedData()
  const [confThreshold,  setConfThreshold]  = useState(DEFAULT_CONF)
  const [uncTolerance,   setUncTolerance]   = useState(DEFAULT_UNC)
  const [minEvidence,    setMinEvidence]    = useState(DEFAULT_EV)
  const [exported,       setExported]       = useState(false)

  const reset = () => {
    setConfThreshold(DEFAULT_CONF)
    setUncTolerance(DEFAULT_UNC)
    setMinEvidence(DEFAULT_EV)
  }

  const handleExport = () => {
    setExported(true)
    setTimeout(() => setExported(false), 2500)
  }

  // Compute decisions for all clusters
  const results = useMemo(() =>
    CLUSTERS.map((c) => ({
      cluster: c,
      decision: getDecision(c, confThreshold, uncTolerance, minEvidence),
    })).sort((a, b) => b.cluster.priorityScore - a.cluster.priorityScore),
  [confThreshold, uncTolerance, minEvidence])

  const counts = {
    prioritize: results.filter((r) => r.decision === 'prioritize').length,
    consider:   results.filter((r) => r.decision === 'consider').length,
    defer:      results.filter((r) => r.decision === 'defer').length,
  }

  // Sprint impact estimate
  const sprintItems = results.filter((r) => r.decision === 'prioritize')
  const highImpact  = sprintItems.filter((r) => r.cluster.impact === 'high').length
  const totalUsers  = sprintItems.reduce((s, r) => s + r.cluster.uniqueUsers, 0)

  const displayResults = hasData ? results : []
  const displayCounts = hasData ? counts : { prioritize: 0, consider: 0, defer: 0 }

  return (
  <div className="p-6 min-h-screen bg-background transition-colors">

    {/* Header */}
    <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Decision Playground
        </h1>

        <p className="text-muted-foreground mt-1 text-sm">
          Adjust thresholds to see how confidence levels reshape your roadmap priorities
        </p>
      </div>

      <div className="flex items-center gap-2">
        {hasData
          ? <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0">Demo Data Active</Badge>
          : <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">No Data — Upload to Begin</Badge>
        }
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground gap-2"
          onClick={reset}
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>

        <Button
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 gap-2"
          onClick={handleExport}
        >
          {exported ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Exported!
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export Scenario
            </>
          )}
        </Button>
      </div>
    </div>

    {!hasData && (
      <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
        Upload feedback data on the Import Sources page to see insights
      </div>
    )}

    <div className="grid lg:grid-cols-[380px_1fr] gap-6">

      {/* Left panel */}
      <div className="space-y-5">

        {/* Threshold controls */}
        <div className="bg-white dark:bg-[#0F1729] rounded-2xl p-5 border border-gray-200 dark:border-white/5">

          <div className="flex items-center gap-2 mb-5">
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <Sliders className="w-4 h-4 text-violet-400" />
            </div>

            <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
              Threshold Controls
            </h2>
          </div>

          <div className="space-y-6">

            <ControlSlider
              label="Confidence Threshold"
              sub="Minimum confidence score required to prioritize"
              value={confThreshold}
              min={50}
              max={95}
              step={5}
              unit="%"
              onChange={setConfThreshold}
              color="text-violet-500"
            />

            <ControlSlider
              label="Uncertainty Tolerance"
              sub="Maximum acceptable uncertainty band"
              value={uncTolerance}
              min={5}
              max={30}
              step={5}
              unit="±"
              onChange={setUncTolerance}
              color="text-blue-500"
            />

            <ControlSlider
              label="Minimum Evidence Items"
              sub="Minimum number of feedback items to support a decision"
              value={minEvidence}
              min={10}
              max={120}
              step={10}
              unit=" items"
              onChange={setMinEvidence}
              color="text-amber-500"
            />

          </div>
        </div>

        {/* Scenario summary */}
        <div className="bg-white dark:bg-[#0F1729] rounded-2xl p-5 border border-gray-200 dark:border-white/5">

          <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-4">
            Scenario Summary
          </h2>

          <div className="space-y-3">

            {[
              { label: 'Prioritize', count: displayCounts.prioritize, color: 'bg-emerald-500', textColor: 'text-emerald-500' },
              { label: 'Consider', count: displayCounts.consider, color: 'bg-amber-500', textColor: 'text-amber-500' },
              { label: 'Defer', count: displayCounts.defer, color: 'bg-slate-500', textColor: 'text-slate-500' },
            ].map(({ label, count, color, textColor }) => (

              <div key={label} className="flex items-center gap-3">

                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />

                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">

                  <motion.div
                    className={color}
                    animate={{ width: `${(count / CLUSTERS.length) * 100}%` }}
                    transition={{ duration: 0.5 }}
                    style={{ height: '100%', borderRadius: 9999 }}
                  />

                </div>

                <span className="text-xs text-gray-500 dark:text-slate-400 w-20">
                  {label}
                </span>

                <span className={`text-sm font-bold w-4 text-right ${textColor}`}>
                  {count}
                </span>

              </div>

            ))}

          </div>
        </div>

        {/* Info card */}
        <div className="bg-white dark:bg-[#0F1729] rounded-2xl p-4 border border-gray-200 dark:border-white/5">

          <div className="flex items-start gap-2">

            <Shield className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />

            <div>

              <p className="text-xs font-medium text-violet-500 mb-1">
                How decisions are computed
              </p>

              <p className="text-xs text-gray-600 dark:text-slate-500 leading-relaxed">

                <span className="text-emerald-500 font-medium">Prioritize</span>
                — confidence ≥ threshold, uncertainty ≤ tolerance, items ≥ min.

                {' '}

                <span className="text-amber-500 font-medium">Consider</span>
                — upper bound reaches threshold.

                {' '}

                <span className="text-gray-500 font-medium">Defer</span>
                — neither condition met.

              </p>

            </div>

          </div>

        </div>

      </div>

      {/* Right side results */}
      <div className="space-y-4">

        <div className="flex items-center justify-between mb-1">

          <div className="flex items-center gap-2">

            <ArrowRight className="w-4 h-4 text-gray-500 dark:text-slate-400" />

            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Scenario Results
            </h2>

            <span className="text-xs text-gray-500 dark:text-slate-500">
              — sorted by priority score
            </span>

          </div>

          <span className="text-xs text-gray-500 dark:text-slate-500">
            {CLUSTERS.length} clusters · threshold {confThreshold}%
          </span>

        </div>

        <AnimatePresence mode="popLayout">

          {displayResults.map(({ cluster, decision }, i) => (

            <ScenarioCard
              key={cluster.id}
              cluster={cluster}
              decision={decision}
              rank={i + 1}
              delay={i * 0.04}
            />

          ))}

          {!hasData && displayResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Upload feedback data on the Import Sources page to see insights
            </div>
          )}

        </AnimatePresence>

      </div>

    </div>
  </div>
  )
} 