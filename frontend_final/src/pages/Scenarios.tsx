import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FlaskConical, Plus, Play, Copy, Trash2, ArrowRight,
  CheckCircle2, Clock, XCircle, TrendingUp, TrendingDown,
  Minus, ChevronDown, ChevronUp, BarChart3, Zap, X,
  Shield, Users, Hash, Target, Wifi, List, RefreshCw, AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { getEvidence } from '@/api/client'
import { useDataMode } from '@/context/DataModeContext'
import { EvidenceItemsPanel } from '@/components/EvidenceItemsPanel'

// ─── Shared cluster data (mirrors DecisionPlayground + EvidenceGrid) ──────────
const CLUSTERS = [
  { id: 'c1', name: 'App crashes on project switch',      confidence: 91, uncertainty: 7,  feedbackCount: 138, uniqueUsers: 94,  priorityScore: 87, effort: 'high',   impact: 'high',   trend: 'rising'   },
  { id: 'c2', name: 'Black screen after latest update',   confidence: 87, uncertainty: 9,  feedbackCount: 112, uniqueUsers: 78,  priorityScore: 83, effort: 'medium', impact: 'high',   trend: 'rising'   },
  { id: 'c3', name: 'Dashboard load time regression',     confidence: 86, uncertainty: 8,  feedbackCount: 94,  uniqueUsers: 61,  priorityScore: 80, effort: 'medium', impact: 'high',   trend: 'stable'   },
  { id: 'c4', name: 'No onboarding checklist',            confidence: 81, uncertainty: 10, feedbackCount: 82,  uniqueUsers: 67,  priorityScore: 76, effort: 'medium', impact: 'medium', trend: 'rising'   },
  { id: 'c5', name: 'Export to CSV silently fails',       confidence: 77, uncertainty: 11, feedbackCount: 58,  uniqueUsers: 39,  priorityScore: 70, effort: 'low',    impact: 'medium', trend: 'declining'},
  { id: 'c6', name: 'Notification delay on mobile',       confidence: 72, uncertainty: 13, feedbackCount: 37,  uniqueUsers: 28,  priorityScore: 63, effort: 'medium', impact: 'low',    trend: 'stable'   },
] as const

type ClusterDecision = 'prioritize' | 'consider' | 'defer'

function computeDecision(
  c: typeof CLUSTERS[number],
  confThreshold: number,
  uncTolerance: number,
  minEvidence: number,
  effortCap: 'low' | 'medium' | 'high' | 'any',
): ClusterDecision {
  const effortPass = effortCap === 'any' ||
    (effortCap === 'low' && c.effort === 'low') ||
    (effortCap === 'medium' && (c.effort === 'low' || c.effort === 'medium')) ||
    true // 'high' = no cap
  if (
    c.confidence >= confThreshold &&
    c.uncertainty <= uncTolerance &&
    c.feedbackCount >= minEvidence &&
    effortPass
  ) return 'prioritize'
  if (
    (c.confidence + c.uncertainty) >= confThreshold &&
    c.feedbackCount >= minEvidence * 0.5
  ) return 'consider'
  return 'defer'
}

// ─── Preset scenarios aligned to Veloquity ────────────────────────────────────
interface ScenarioParams {
  confidenceThreshold: number
  uncertaintyTolerance: number
  minEvidence: number
  effortCap: 'low' | 'medium' | 'high' | 'any'
}

interface Scenario {
  id: string
  name: string
  description: string
  params: ScenarioParams
  createdAt: string
  pinned?: boolean
}

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: 's1', pinned: true,
    name: 'Conservative Q2',
    description: 'High confidence only — ship what we know will land. Strict on uncertainty.',
    params: { confidenceThreshold: 85, uncertaintyTolerance: 8, minEvidence: 80, effortCap: 'any' },
    createdAt: '2026-03-09',
  },
  {
    id: 's2',
    name: 'Aggressive Sprint',
    description: 'Lower bar to surface all addressable signals. Maximise user impact per sprint.',
    params: { confidenceThreshold: 70, uncertaintyTolerance: 15, minEvidence: 30, effortCap: 'any' },
    createdAt: '2026-03-08',
  },
  {
    id: 's3',
    name: 'Resource Constrained',
    description: 'Hard cap on effort — only low/medium effort clusters qualify. Perfect for lean sprints.',
    params: { confidenceThreshold: 75, uncertaintyTolerance: 12, minEvidence: 50, effortCap: 'medium' },
    createdAt: '2026-03-07',
  },
  {
    id: 's4',
    name: 'Trust the Signal',
    description: 'Veloquity defaults: 60% threshold, Bedrock-validated clusters only.',
    params: { confidenceThreshold: 60, uncertaintyTolerance: 20, minEvidence: 10, effortCap: 'any' },
    createdAt: '2026-03-06',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function decisionStyle(d: ClusterDecision) {
  return {
    prioritize: { pill: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25', dot: 'bg-emerald-500', bar: 'bg-emerald-500', icon: CheckCircle2, label: 'Prioritize' },
    consider:   { pill: 'bg-amber-500/15   text-amber-400   border border-amber-500/25',   dot: 'bg-amber-500',   bar: 'bg-amber-500',   icon: Clock,        label: 'Consider'   },
    defer:      { pill: 'bg-slate-500/15   text-slate-400   border border-slate-500/20',   dot: 'bg-slate-500',   bar: 'bg-slate-500',   icon: XCircle,      label: 'Defer'      },
  }[d]
}

function trendIcon(t: string) {
  if (t === 'rising')    return <TrendingUp   className="w-3 h-3 text-red-400" />
  if (t === 'declining') return <TrendingDown  className="w-3 h-3 text-green-400" />
  return                        <Minus         className="w-3 h-3 text-slate-400" />
}

function effortColor(e: string) {
  return e === 'low' ? 'text-green-400' : e === 'medium' ? 'text-amber-400' : 'text-red-400'
}

// ─── Mini confidence arc ──────────────────────────────────────────────────────
function MiniArc({ value, size = 44 }: { value: number; size?: number }) {
  const r = size * 0.40
  const cx = size / 2, cy = size * 0.58
  const halfCirc = Math.PI * r
  const scoreArc = (value / 100) * halfCirc
  const color = value >= 80 ? '#10b981' : value >= 60 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} overflow="visible">
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" strokeLinecap="round" />
      <motion.path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${scoreArc} ${halfCirc}`}
        initial={{ strokeDasharray: `0 ${halfCirc}` }}
        animate={{ strokeDasharray: `${scoreArc} ${halfCirc}` }}
        transition={{ duration: 0.7 }} />
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="9" fontWeight="800"
        fill={color} dominantBaseline="middle">{value}%</text>
    </svg>
  )
}

// ─── Scenario results breakdown ───────────────────────────────────────────────
function ScenarioResults({ params, compact = false }: { params: ScenarioParams; compact?: boolean }) {
  const results = useMemo(() =>
    CLUSTERS.map((c) => ({
      cluster: c,
      decision: computeDecision(c, params.confidenceThreshold, params.uncertaintyTolerance, params.minEvidence, params.effortCap),
    })),
  [params])

  const counts = {
    prioritize: results.filter((r) => r.decision === 'prioritize').length,
    consider:   results.filter((r) => r.decision === 'consider').length,
    defer:      results.filter((r) => r.decision === 'defer').length,
  }

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Summary bar */}
        <div className="flex h-2 rounded-full overflow-hidden gap-px">
          {(['prioritize', 'consider', 'defer'] as ClusterDecision[]).map((d) => {
            const s = decisionStyle(d)
            const w = (counts[d] / CLUSTERS.length) * 100
            return w > 0 ? (
              <motion.div key={d} className={s.bar}
                initial={{ flex: 0 }} animate={{ flex: w }}
                transition={{ duration: 0.5 }} style={{ height: '100%' }} />
            ) : null
          })}
        </div>
        {/* Counts */}
        <div className="flex items-center gap-4">
          {(['prioritize', 'consider', 'defer'] as ClusterDecision[]).map((d) => {
            const s = decisionStyle(d)
            const Icon = s.icon
            return (
              <div key={d} className="flex items-center gap-1">
                <Icon className={`w-3.5 h-3.5 ${d === 'prioritize' ? 'text-emerald-500' : d === 'consider' ? 'text-amber-500' : 'text-slate-500'}`} />
                <span className={`text-sm font-bold ${d === 'prioritize' ? 'text-emerald-400' : d === 'consider' ? 'text-amber-400' : 'text-slate-400'}`}>{counts[d]}</span>
                <span className="text-xs text-slate-500 capitalize">{d}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2 mt-3">
      {results.map(({ cluster, decision }) => {
        const s = decisionStyle(decision)
        const Icon = s.icon
        return (
          <div key={cluster.id} className="flex items-center gap-3 p-2.5 bg-white/[0.03] rounded-xl border border-white/5">
            <MiniArc value={cluster.confidence} size={42} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{cluster.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {trendIcon(cluster.trend)}
                <span className={`text-[10px] font-medium capitalize ${effortColor(cluster.effort)}`}>{cluster.effort} effort</span>
                <span className="text-slate-600 text-[10px]">·</span>
                <span className="text-[10px] text-slate-500">{cluster.feedbackCount} items</span>
              </div>
            </div>
            <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0', s.pill)}>
              <Icon className="w-3 h-3" />{s.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Scenario card ────────────────────────────────────────────────────────────
function ScenarioCard({
  scenario, onClone, onDelete, onApply,
}: {
  scenario: Scenario
  onClone: (s: Scenario) => void
  onDelete: (id: string) => void
  onApply: (s: Scenario) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const counts = useMemo(() => {
    const results = CLUSTERS.map((c) => computeDecision(c, scenario.params.confidenceThreshold, scenario.params.uncertaintyTolerance, scenario.params.minEvidence, scenario.params.effortCap))
    return {
      prioritize: results.filter((d) => d === 'prioritize').length,
      consider:   results.filter((d) => d === 'consider').length,
      defer:      results.filter((d) => d === 'defer').length,
    }
  }, [scenario.params])

  const usersUnblocked = useMemo(() =>
    CLUSTERS.filter((c) => computeDecision(c, scenario.params.confidenceThreshold, scenario.params.uncertaintyTolerance, scenario.params.minEvidence, scenario.params.effortCap) === 'prioritize')
      .reduce((s, c) => s + c.uniqueUsers, 0),
  [scenario.params])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F1729] rounded-2xl border border-white/5 overflow-hidden hover:border-violet-500/20 transition-colors"
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-violet-500/15 shrink-0">
              <FlaskConical className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-sm">{scenario.name}</h3>
                {scenario.pinned && (
                  <Badge className="text-[9px] bg-violet-500/20 text-violet-300 border-0 px-1.5">Default</Badge>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{scenario.description}</p>
            </div>
          </div>
          <span className="text-[10px] text-slate-600 shrink-0">{scenario.createdAt}</span>
        </div>

        {/* Parameter pills */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[
            { label: `conf ≥ ${scenario.params.confidenceThreshold}%`,     color: 'bg-violet-500/10 text-violet-300' },
            { label: `±${scenario.params.uncertaintyTolerance}% tolerance`, color: 'bg-blue-500/10 text-blue-300'   },
            { label: `≥ ${scenario.params.minEvidence} items`,              color: 'bg-amber-500/10 text-amber-300' },
            { label: `effort: ${scenario.params.effortCap}`,                color: 'bg-slate-500/10 text-slate-300' },
          ].map(({ label, color }) => (
            <span key={label} className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', color)}>
              {label}
            </span>
          ))}
        </div>

        {/* Compact results */}
        <ScenarioResults params={scenario.params} compact />

        {/* Impact stat */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 p-2 bg-emerald-500/8 rounded-lg border border-emerald-500/15 flex-1">
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-xs text-emerald-300 font-semibold">{usersUnblocked} users unblocked</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 bg-white/3 rounded-lg border border-white/5 flex-1">
            <Target className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs text-slate-300">
              <span className="font-semibold text-violet-300">{counts.prioritize}</span> of {CLUSTERS.length} clusters
            </span>
          </div>
        </div>

        {/* Expand toggle + actions */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <button
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            onClick={() => setExpanded((p) => !p)}
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {expanded ? 'Hide' : 'Show'} cluster breakdown
          </button>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-white px-2"
              onClick={() => onClone(scenario)}>
              <Copy className="w-3 h-3 mr-1" />Clone
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 px-2"
              onClick={() => onDelete(scenario.id)}>
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
            <Button size="sm" className="h-7 text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 px-3"
              onClick={() => onApply(scenario)}>
              <ArrowRight className="w-3 h-3 mr-1" />Apply
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded cluster breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-white/5 pt-4">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">
                Per-cluster decisions under this scenario
              </p>
              <ScenarioResults params={scenario.params} compact={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── New scenario form ────────────────────────────────────────────────────────
function NewScenarioForm({ onAdd, onClose }: { onAdd: (s: Scenario) => void; onClose: () => void }) {
  const [form, setForm] = useState({
    name: '', description: '',
    params: { confidenceThreshold: 75, uncertaintyTolerance: 15, minEvidence: 40, effortCap: 'any' as 'low' | 'medium' | 'high' | 'any' },
  })

  const liveResults = useMemo(() =>
    CLUSTERS.map((c) => ({
      cluster: c,
      decision: computeDecision(c, form.params.confidenceThreshold, form.params.uncertaintyTolerance, form.params.minEvidence, form.params.effortCap),
    })),
  [form.params])

  const counts = {
    prioritize: liveResults.filter((r) => r.decision === 'prioritize').length,
    consider:   liveResults.filter((r) => r.decision === 'consider').length,
    defer:      liveResults.filter((r) => r.decision === 'defer').length,
  }

  const handleAdd = () => {
    if (!form.name.trim()) return
    onAdd({
      id: `s${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim() || 'Custom scenario',
      params: form.params,
      createdAt: new Date().toISOString().split('T')[0],
    })
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-[#0F1729] rounded-2xl border border-violet-500/25 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-500/15">
              <FlaskConical className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm">Create New Scenario</h2>
              <p className="text-xs text-slate-500">Results update live as you adjust parameters</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left: inputs */}
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Scenario Name</Label>
                <Input placeholder="e.g. Q3 Planning" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-sm h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">Description</Label>
                <Input placeholder="Brief strategy description" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="bg-white/5 border-white/10 text-white text-sm h-9" />
              </div>
            </div>

            {[
              { key: 'confidenceThreshold', label: 'Confidence Threshold', min: 50, max: 95, step: 5,  unit: '%',     color: 'text-violet-400' },
              { key: 'uncertaintyTolerance',label: 'Uncertainty Tolerance', min: 5,  max: 30, step: 5,  unit: '±%',    color: 'text-blue-400'   },
              { key: 'minEvidence',          label: 'Min Evidence Items',   min: 10, max: 120, step: 10, unit: ' items', color: 'text-amber-400'  },
            ].map((ctrl) => (
              <div key={ctrl.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-400">{ctrl.label}</Label>
                  <span className={cn('text-sm font-bold tabular-nums', ctrl.color)}>
                    {ctrl.unit === '±%'
                      ? `±${form.params[ctrl.key as keyof typeof form.params]}%`
                      : `${form.params[ctrl.key as keyof typeof form.params]}${ctrl.unit}`}
                  </span>
                </div>
                <Slider
                  value={[form.params[ctrl.key as keyof typeof form.params] as number]}
                  onValueChange={([v]) => setForm({ ...form, params: { ...form.params, [ctrl.key]: v } })}
                  min={ctrl.min} max={ctrl.max} step={ctrl.step}
                />
              </div>
            ))}

            {/* Effort cap toggle */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Effort Cap</Label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high', 'any'] as const).map((opt) => (
                  <button key={opt}
                    onClick={() => setForm({ ...form, params: { ...form.params, effortCap: opt } })}
                    className={cn(
                      'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize',
                      form.params.effortCap === opt
                        ? 'bg-violet-600 border-violet-600 text-white'
                        : 'border-white/10 text-slate-400 hover:border-violet-400',
                    )}
                  >{opt}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: live preview */}
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Live Preview</p>

            {/* Summary counts */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['prioritize', 'consider', 'defer'] as ClusterDecision[]).map((d) => {
                const s = decisionStyle(d)
                const Icon = s.icon
                return (
                  <div key={d} className={cn('p-3 rounded-xl border text-center', {
                    'bg-emerald-500/8 border-emerald-500/20': d === 'prioritize',
                    'bg-amber-500/8   border-amber-500/20':   d === 'consider',
                    'bg-slate-500/8   border-slate-500/15':   d === 'defer',
                  })}>
                    <p className={cn('text-2xl font-bold', {
                      'text-emerald-400': d === 'prioritize',
                      'text-amber-400':   d === 'consider',
                      'text-slate-400':   d === 'defer',
                    })}>{counts[d]}</p>
                    <p className="text-[10px] text-slate-500 capitalize mt-0.5">{d}</p>
                  </div>
                )
              })}
            </div>

            {/* Per-cluster mini results */}
            <div className="space-y-1.5">
              {liveResults.map(({ cluster, decision }) => {
                const s = decisionStyle(decision)
                const Icon = s.icon
                return (
                  <div key={cluster.id} className="flex items-center gap-2 p-2 bg-white/[0.025] rounded-lg">
                    <MiniArc value={cluster.confidence} size={38} />
                    <p className="text-xs text-slate-300 flex-1 truncate">{cluster.name}</p>
                    <div className={cn('flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold shrink-0', s.pill)}>
                      <Icon className="w-2.5 h-2.5" />{s.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-white/5">
          <Button variant="ghost" className="text-slate-400 hover:text-white" onClick={onClose}>Cancel</Button>
          <Button
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
            disabled={!form.name.trim()}
            onClick={handleAdd}
          >
            <Play className="w-4 h-4 mr-2" />Save Scenario
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Comparison table ─────────────────────────────────────────────────────────
function ComparisonTable({ scenarios }: { scenarios: Scenario[] }) {
  // For each scenario, compute decisions for all 6 clusters
  const rows = useMemo(() =>
    scenarios.map((s) => {
      const decisions = CLUSTERS.map((c) => computeDecision(c, s.params.confidenceThreshold, s.params.uncertaintyTolerance, s.params.minEvidence, s.params.effortCap))
      const p = decisions.filter((d) => d === 'prioritize').length
      const c = decisions.filter((d) => d === 'consider').length
      const d = decisions.filter((d) => d === 'defer').length
      const users = CLUSTERS.filter((cl, i) => decisions[i] === 'prioritize').reduce((s, cl) => s + cl.uniqueUsers, 0)
      const efficiency = Math.round((p / CLUSTERS.length) * 100)
      return { scenario: s, p, c, d, users, efficiency, decisions }
    }),
  [scenarios])

 return (
  <div className="bg-white dark:bg-[#0F1729] rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">

    <div className="p-5 border-b border-gray-200 dark:border-white/5">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-violet-500 dark:text-violet-400" />
        <h2 className="font-semibold text-gray-900 dark:text-white text-sm">
          Scenario Comparison
        </h2>
      </div>

      <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">
        Side-by-side outcome across all {CLUSTERS.length} evidence clusters
      </p>
    </div>

    <div className="overflow-x-auto">

      <table className="w-full text-sm">

        <thead>
          <tr className="border-b border-gray-200 dark:border-white/5">

            <th className="py-3 px-4 text-left text-xs text-gray-500 dark:text-slate-500 font-medium">
              Scenario
            </th>

            <th className="py-3 px-4 text-center text-xs text-gray-500 dark:text-slate-500 font-medium">
              Threshold
            </th>

            {/* Per-cluster columns */}
            {CLUSTERS.map((c) => (
              <th
                key={c.id}
                className="py-3 px-2 text-center text-[10px] text-gray-500 dark:text-slate-600 font-normal max-w-[80px]"
              >
                <span className="block truncate max-w-[72px]" title={c.name}>
                  {c.name.split(' ').slice(0, 2).join(' ')}…
                </span>

                <span className="text-[9px] text-gray-400 dark:text-slate-700">
                  {c.confidence}%
                </span>
              </th>
            ))}

            <th className="py-3 px-4 text-center text-xs text-gray-500 dark:text-slate-500 font-medium">
              Users
            </th>

            <th className="py-3 px-4 text-center text-xs text-gray-500 dark:text-slate-500 font-medium">
              Efficiency
            </th>

          </tr>
        </thead>

        <tbody>

          {rows.map(({ scenario, p, c, d, users, efficiency, decisions }) => (

            <tr
              key={scenario.id}
              className="border-b border-gray-200 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
            >

              <td className="py-3 px-4">

                <p className="text-xs font-semibold text-gray-900 dark:text-white">
                  {scenario.name}
                </p>

                <p className="text-[10px] text-gray-500 dark:text-slate-500 mt-0.5 max-w-[160px] truncate">
                  {scenario.description}
                </p>

              </td>

              <td className="py-3 px-4 text-center">

                <span className="text-xs font-bold text-violet-500 dark:text-violet-300">
                  {scenario.params.confidenceThreshold}%
                </span>

              </td>

              {/* Per-cluster decision dots */}
              {decisions.map((dec, i) => {
                const s = decisionStyle(dec)
                const Icon = s.icon

                return (
                  <td key={i} className="py-3 px-2 text-center">
                    <div className="flex justify-center">
                      <Icon
                        className={cn("w-4 h-4", {
                          "text-emerald-500": dec === "prioritize",
                          "text-amber-500": dec === "consider",
                          "text-gray-400 dark:text-slate-600": dec === "defer",
                        })}
                      />
                    </div>
                  </td>
                )
              })}

              <td className="py-3 px-4 text-center">

                <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">
                  {users}
                </span>

              </td>

              <td className="py-3 px-4 text-center">

                <div className="inline-flex items-center gap-1.5">

                  <div className="w-12 h-1.5 bg-gray-200 dark:bg-white/5 rounded-full overflow-hidden">

                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all"
                      style={{ width: `${efficiency}%` } as React.CSSProperties}
                    />

                  </div>

                  <span className="text-xs text-gray-600 dark:text-slate-300 font-medium">
                    {efficiency}%
                  </span>

                </div>

              </td>

            </tr>

          ))}

        </tbody>

      </table>

    </div>

  </div>
)}

// ─── Live evidence cluster card ───────────────────────────────────────────────
interface LiveCluster {
  id: string; name: string; confidence: number; feedbackCount: number
  uniqueUsers: number; status: string
}

function LiveClusterCard({
  cluster, rank, onViewDetails,
}: {
  cluster: LiveCluster; rank: number; onViewDetails: () => void
}) {
  const conf = Math.round(cluster.confidence * 100)
  const color = conf >= 80 ? 'text-emerald-500' : conf >= 60 ? 'text-amber-500' : 'text-red-500'
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0F1729] rounded-2xl border border-white/5 p-5 hover:border-violet-500/20 transition-colors"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-slate-400">#{rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm leading-snug truncate">{cluster.name}</h3>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className={`text-sm font-bold ${color}`}>{conf}%</span>
            <span className="text-xs text-slate-500">{cluster.feedbackCount} users</span>
            <Badge className="text-[10px] bg-white/5 text-slate-300 border-0">{cluster.status}</Badge>
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1 h-8 text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
          onClick={onViewDetails}
        >
          <List className="w-3.5 h-3.5 mr-1.5" />View Details
        </Button>
      </div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Scenarios() {
  const { isLive }    = useDataMode()
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS)
  const [showForm, setShowForm]   = useState(false)
  const [appliedId, setAppliedId] = useState<string | null>(null)

  // Live data state
  const [liveClusters, setLiveClusters] = useState<LiveCluster[]>([])
  const [liveLoading, setLiveLoading]   = useState(false)
  const [liveError, setLiveError]       = useState<string | null>(null)

  // Panel state
  const [panelOpen, setPanelOpen]           = useState(false)
  const [panelClusterId, setPanelClusterId] = useState<string | null>(null)
  const [panelTheme, setPanelTheme]         = useState('')
  const [panelTotal, setPanelTotal]         = useState(0)

  useEffect(() => {
    if (!isLive) return
    setLiveLoading(true)
    setLiveError(null)
    getEvidence()
      .then((ev) => {
        if (!ev || ev.length === 0) { setLiveError('No active evidence clusters found.'); return }
        setLiveClusters(ev.map((e) => ({
          id: e.id, name: e.theme,
          confidence: e.confidence_score,
          feedbackCount: e.unique_user_count,
          uniqueUsers: e.unique_user_count,
          status: e.status,
        })))
      })
      .catch((e) => setLiveError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLiveLoading(false))
  }, [isLive])

  const handleClone = (s: Scenario) => {
    setScenarios((prev) => [
      ...prev,
      { ...s, id: `s${Date.now()}`, name: `${s.name} (copy)`, pinned: false, createdAt: new Date().toISOString().split('T')[0] },
    ])
  }

  const handleDelete = (id: string) => {
    setScenarios((prev) => prev.filter((s) => s.id !== id))
  }

  const handleApply = (s: Scenario) => {
    setAppliedId(s.id)
    setTimeout(() => setAppliedId(null), 2000)
  }

  const handleAdd = (s: Scenario) => {
    setScenarios((prev) => [s, ...prev])
  }

  const openPanel = (c: LiveCluster) => {
    setPanelClusterId(c.id)
    setPanelTheme(c.name)
    setPanelTotal(c.feedbackCount)
    setPanelOpen(true)
  }

 return (
  <div className="p-6 min-h-screen bg-gray-50 dark:bg-[#080D1A] space-y-6 transition-colors">

    {/* Header */}
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Scenarios</h1>
          {isLive && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5">
              <Wifi className="w-3 h-3" />Live Data
            </Badge>
          )}
        </div>
        <p className="text-gray-600 dark:text-slate-400 mt-1 text-sm">
          {isLive
            ? 'Live evidence clusters from your uploaded data'
            : 'Model different prioritization strategies · compare outcomes across all 6 evidence clusters'}
        </p>
      </div>

      {!isLive && (
        <Button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 gap-2"
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Cancel' : 'New Scenario'}
        </Button>
      )}
    </div>

    {/* Live cluster cards */}
    {isLive && (
      <div>
        {liveLoading && (
          <div className="flex items-center gap-3 py-8 text-slate-400">
            <RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm">Loading clusters…</span>
          </div>
        )}
        {liveError && (
          <div className="flex items-center gap-3 py-8 text-red-400">
            <AlertCircle className="w-4 h-4" /><span className="text-sm">{liveError}</span>
          </div>
        )}
        {!liveLoading && !liveError && liveClusters.length > 0 && (
          <div className="grid lg:grid-cols-2 gap-4">
            {liveClusters.map((c, i) => (
              <LiveClusterCard key={c.id} cluster={c} rank={i + 1} onViewDetails={() => openPanel(c)} />
            ))}
          </div>
        )}
      </div>
    )}

    {/* New scenario form (demo only) */}
    {!isLive && (
      <AnimatePresence>
        {showForm && (
          <NewScenarioForm onAdd={handleAdd} onClose={() => setShowForm(false)} />
        )}
      </AnimatePresence>
    )}

    {/* Applied toast */}
    <AnimatePresence>
      {appliedId && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="flex items-center gap-2 p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Scenario applied — thresholds updated in Decision Playground
          </p>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Saved scenarios (demo only) */}
    {!isLive && (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-gray-500 dark:text-slate-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Saved Scenarios</h2>
          <span className="text-xs text-gray-500 dark:text-slate-600">({scenarios.length})</span>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {scenarios.map((scenario, i) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.04 }}
              >
                <ScenarioCard
                  scenario={scenario}
                  onClone={handleClone}
                  onDelete={handleDelete}
                  onApply={handleApply}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {scenarios.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-slate-500">
            <FlaskConical className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No scenarios yet. Create one to start modelling.</p>
          </div>
        )}
      </div>
    )}

    {/* Comparison table (demo only) */}
    {!isLive && scenarios.length > 1 && (
      <ComparisonTable scenarios={scenarios} />
    )}

    {/* Evidence items panel */}
    <EvidenceItemsPanel
      isOpen={panelOpen}
      onClose={() => setPanelOpen(false)}
      clusterId={panelClusterId}
      clusterTheme={panelTheme}
      totalItems={panelTotal}
    />
  </div>
 )
}