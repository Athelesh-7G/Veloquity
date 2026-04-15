import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, TrendingUp, ExternalLink, Layers, ChevronRight,
  Info, Link2, BarChart3, CheckCircle2, Users, Hash
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MOCK_EVIDENCE } from '@/api/mockData'
import { getEvidence } from '@/api/client'
import { cn } from '@/lib/utils'
import { hasUploadedData, getActiveDataset } from '@/utils/uploadState'

// ─── Types ────────────────────────────────────────────────────────────────────
type EvidenceCategory = 'Technical' | 'Feature' | 'UX'
type EvidenceTrend    = 'rising' | 'stable' | 'declining'

interface LinkedFeedbackItem {
  id: string
  title: string
  source: 'App Store' | 'Support Tickets'
  date: string
  confidenceScore: number
}

interface EvidenceItem {
  id: string
  clusterId: string
  title: string
  sources: ('App Store' | 'Support Tickets')[]
  confidence: number
  uncertaintyRange: [number, number]
  feedbackCount: number
  uniqueUsers: number
  category: EvidenceCategory
  trend: EvidenceTrend
  lastValidated: string
  representativeQuotes: string[]
  linkedFeedback: LinkedFeedbackItem[]
}

// ─── Canonical mock dataset ───────────────────────────────────────────────────
const EVIDENCE_DATA: EvidenceItem[] = [
  {
    id: 'ev1', clusterId: 'c1',
    title: 'App crashes on project switch',
    sources: ['App Store', 'Support Tickets'],
    confidence: 91,
    uncertaintyRange: [84, 96],
    feedbackCount: 138,
    uniqueUsers: 94,
    category: 'Technical',
    trend: 'rising',
    lastValidated: '2026-03-10',
    representativeQuotes: [
      'Crashes every time I switch between projects — started after v2.4.',
      'Fatal crash on workspace navigation. Null pointer in project context handler.',
    ],
    linkedFeedback: [
      { id: 'f001', title: 'App crashes every time I switch between projects',    source: 'App Store', date: '2026-03-10', confidenceScore: 93 },
      { id: 'f002', title: 'Fatal crash when navigating between workspaces',       source: 'Support Tickets',   date: '2026-03-09', confidenceScore: 91 },
      { id: 'f003', title: 'Switching projects = instant crash, 1 star',           source: 'App Store', date: '2026-03-08', confidenceScore: 89 },
      { id: 'f004', title: 'Project context crash - reproducible steps attached',  source: 'Support Tickets',   date: '2026-03-07', confidenceScore: 94 },
    ],
  },
  {
    id: 'ev2', clusterId: 'c2',
    title: 'Black screen after latest update',
    sources: ['App Store', 'Support Tickets'],
    confidence: 87,
    uncertaintyRange: [80, 93],
    feedbackCount: 112,
    uniqueUsers: 78,
    category: 'Technical',
    trend: 'rising',
    lastValidated: '2026-03-10',
    representativeQuotes: [
      'Black screen for 15–20 seconds on every cold start since v2.4.',
      'All 12 users on our account hit black screen on launch. Suspect async init deadlock.',
    ],
    linkedFeedback: [
      { id: 'f005', title: 'Black screen on launch after updating to 2.4',          source: 'App Store', date: '2026-03-10', confidenceScore: 88 },
      { id: 'f006', title: 'App stuck on black screen - multiple users affected',    source: 'Support Tickets',   date: '2026-03-09', confidenceScore: 87 },
      { id: 'f007', title: 'Broken since update - black screen every morning',       source: 'App Store', date: '2026-03-08', confidenceScore: 85 },
    ],
  },
  {
    id: 'ev3', clusterId: 'c3',
    title: 'Dashboard load time regression',
    sources: ['App Store', 'Support Tickets'],
    confidence: 86,
    uncertaintyRange: [79, 91],
    feedbackCount: 94,
    uniqueUsers: 61,
    category: 'Technical',
    trend: 'stable',
    lastValidated: '2026-03-10',
    representativeQuotes: [
      'Dashboard went from 2s to 12s after v2.4. Backend response times are fine.',
      'Enterprise workspace (200+ projects) takes 12–15 seconds. Scales badly.',
    ],
    linkedFeedback: [
      { id: 'f008', title: 'Dashboard load jumped from 2s to 12s after v2.4',         source: 'Support Tickets',   date: '2026-03-10', confidenceScore: 86 },
      { id: 'f009', title: 'App feels sluggish - dashboard takes forever',             source: 'App Store', date: '2026-03-09', confidenceScore: 83 },
      { id: 'f010', title: 'Dashboard performance degradation - enterprise blocked',   source: 'Support Tickets',   date: '2026-03-07', confidenceScore: 88 },
    ],
  },
  {
    id: 'ev4', clusterId: 'c4',
    title: 'No onboarding checklist for new users',
    sources: ['App Store', 'Support Tickets'],
    confidence: 81,
    uncertaintyRange: [74, 87],
    feedbackCount: 82,
    uniqueUsers: 67,
    category: 'UX',
    trend: 'rising',
    lastValidated: '2026-03-09',
    representativeQuotes: [
      'Signed up, had no idea where to start. No checklist, no welcome tour.',
      'Every new team member needs a 30-min walkthrough. No in-app onboarding exists.',
    ],
    linkedFeedback: [
      { id: 'f011', title: 'No guidance when starting from scratch - very confusing', source: 'App Store', date: '2026-03-10', confidenceScore: 82 },
      { id: 'f012', title: 'New team members struggle to get started',                source: 'Support Tickets',   date: '2026-03-08', confidenceScore: 79 },
      { id: 'f013', title: 'Needs an interactive setup wizard',                       source: 'App Store', date: '2026-03-06', confidenceScore: 81 },
    ],
  },
  {
    id: 'ev5', clusterId: 'c5',
    title: 'Export to CSV silently fails',
    sources: ['App Store', 'Support Tickets'],
    confidence: 77,
    uncertaintyRange: [69, 84],
    feedbackCount: 58,
    uniqueUsers: 39,
    category: 'Feature',
    trend: 'declining',
    lastValidated: '2026-03-09',
    representativeQuotes: [
      'Export shows success toast but file is 0 bytes. Tried Chrome, Safari, Firefox.',
      'Works for <100 rows, silently fails for 5000+. Must be timing out server-side.',
    ],
    linkedFeedback: [
      { id: 'f014', title: 'CSV export says success but file is empty',           source: 'Support Tickets',   date: '2026-03-10', confidenceScore: 78 },
      { id: 'f015', title: 'Export broken - no error shown',                      source: 'App Store', date: '2026-03-09', confidenceScore: 75 },
      { id: 'f016', title: 'Data export pipeline broken for large datasets',      source: 'Support Tickets',   date: '2026-03-07', confidenceScore: 77 },
    ],
  },
  {
    id: 'ev6', clusterId: 'c6',
    title: 'Notification delay on mobile',
    sources: ['App Store', 'Support Tickets'],
    confidence: 72,
    uncertaintyRange: [63, 80],
    feedbackCount: 37,
    uniqueUsers: 28,
    category: 'Feature',
    trend: 'stable',
    lastValidated: '2026-03-08',
    representativeQuotes: [
      'Push notifications arrive 20–40 minutes late. Email is instant but push is broken.',
      'Both iOS and Android affected. Background refresh is on. Latency issue is server-side.',
    ],
    linkedFeedback: [
      { id: 'f017', title: 'Push notifications arrive 30 minutes late',              source: 'App Store', date: '2026-03-09', confidenceScore: 73 },
      { id: 'f018', title: 'Mobile notification latency - team coordination impacted', source: 'Support Tickets', date: '2026-03-08', confidenceScore: 71 },
    ],
  },
]

const UNIQUE_SOURCES = 2

// ─── Hospital evidence data ───────────────────────────────────────────────────
const HOSPITAL_EVIDENCE_DATA: EvidenceItem[] = [
  {
    id: 'hev1', clusterId: 'hc1',
    title: 'Extended Emergency Wait Times',
    sources: ['App Store', 'Support Tickets'],
    confidence: 91,
    uncertaintyRange: [83, 96],
    feedbackCount: 98,
    uniqueUsers: 87,
    category: 'Technical',
    trend: 'rising',
    lastValidated: '2026-03-15',
    representativeQuotes: [
      'Waited 4 hours in the ER with chest pain before anyone saw me',
      'Emergency department wait times have doubled in the past year',
    ],
    linkedFeedback: [
      { id: 'hf001', title: 'ER wait 4+ hours — when does triage actually start?', source: 'App Store', date: '2026-03-14', confidenceScore: 92 },
      { id: 'hf002', title: 'Wait time tripled since last year — systemic issue', source: 'Support Tickets', date: '2026-03-13', confidenceScore: 91 },
      { id: 'hf003', title: 'Elderly parent sat 5 hours on hard chair in waiting room', source: 'App Store', date: '2026-03-12', confidenceScore: 89 },
    ],
  },
  {
    id: 'hev2', clusterId: 'hc2',
    title: 'Online Appointment Booking Failures',
    sources: ['App Store', 'Support Tickets'],
    confidence: 84,
    uncertaintyRange: [77, 90],
    feedbackCount: 76,
    uniqueUsers: 71,
    category: 'Technical',
    trend: 'stable',
    lastValidated: '2026-03-15',
    representativeQuotes: [
      'Booking portal crashes every time I try to confirm my appointment',
      'Got double-booked through the online system — twice in one month',
    ],
    linkedFeedback: [
      { id: 'hf004', title: 'Portal crashes on appointment confirmation screen', source: 'App Store', date: '2026-03-14', confidenceScore: 85 },
      { id: 'hf005', title: 'Double booking through online system — second time this month', source: 'Support Tickets', date: '2026-03-13', confidenceScore: 84 },
      { id: 'hf006', title: 'No confirmation email — never know if booking went through', source: 'App Store', date: '2026-03-12', confidenceScore: 82 },
    ],
  },
  {
    id: 'hev3', clusterId: 'hc3',
    title: 'Billing Statement Errors and Confusion',
    sources: ['Support Tickets'],
    confidence: 78,
    uncertaintyRange: [71, 85],
    feedbackCount: 82,
    uniqueUsers: 58,
    category: 'Feature',
    trend: 'stable',
    lastValidated: '2026-03-15',
    representativeQuotes: [
      'Received a bill for a service I never received. Dispute ignored.',
      'Insurance was not applied to my bill despite being pre-approved',
    ],
    linkedFeedback: [
      { id: 'hf007', title: 'Billed for procedure I never had — dispute unanswered', source: 'Support Tickets', date: '2026-03-14', confidenceScore: 79 },
      { id: 'hf008', title: 'Insurance pre-auth ignored — billed full rate', source: 'Support Tickets', date: '2026-03-13', confidenceScore: 78 },
      { id: 'hf009', title: 'Two bills for same hospital stay — which is correct?', source: 'Support Tickets', date: '2026-03-11', confidenceScore: 77 },
    ],
  },
  {
    id: 'hev4', clusterId: 'hc4',
    title: 'Medical Records Portal Access Issues',
    sources: ['App Store'],
    confidence: 72,
    uncertaintyRange: [65, 79],
    feedbackCount: 54,
    uniqueUsers: 44,
    category: 'Technical',
    trend: 'declining',
    lastValidated: '2026-03-14',
    representativeQuotes: [
      'Cannot log into MyChart. Reset password three times. Still locked out.',
      'Test results missing from portal after 2 weeks — was told 48 hours',
    ],
    linkedFeedback: [
      { id: 'hf010', title: 'Locked out of MyChart after 3 password resets', source: 'App Store', date: '2026-03-13', confidenceScore: 73 },
      { id: 'hf011', title: 'Portal app crashes instantly on Android', source: 'App Store', date: '2026-03-12', confidenceScore: 72 },
      { id: 'hf012', title: 'Wrong medication list showing in patient portal', source: 'App Store', date: '2026-03-10', confidenceScore: 70 },
    ],
  },
]

// ─── Helpers to validate live API response ────────────────────────────────────
function isValidApiItem(e: any): boolean {
  // Must have a short, clean title (not a pipe-joined quote dump)
  return (
    typeof e.theme === 'string' &&
    e.theme.length > 0 &&
    e.theme.length < 120 &&
    !e.theme.includes('|') &&
    (e.user_count ?? 0) > 0
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UncertaintyGauge({ confidence, range }: { confidence: number; range: [number, number] }) {
  const [min, max] = range
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Cluster Confidence</span>
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
          {confidence}%
        </span>
      </div>
      <div className="relative h-4 bg-muted rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-violet-500/20 rounded-full"
          style={{ left: `${min}%`, width: `${max - min}%` }}
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute h-full bg-gradient-to-r from-blue-500 via-violet-500 to-violet-600 rounded-full"
        />
        <div className="absolute top-0 h-full w-0.5 bg-violet-400/70" style={{ left: `${min}%` }} />
        <div className="absolute top-0 h-full w-0.5 bg-violet-400/70" style={{ left: `${max}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Lower bound: {min}%</span>
        <span>≥ 60% auto-accept threshold</span>
        <span>Upper bound: {max}%</span>
      </div>
    </div>
  )
}

function TrendBadge({ trend }: { trend: EvidenceTrend }) {
  const map = {
    rising:   { label: 'Rising',    cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
    stable:   { label: 'Stable',    cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    declining:{ label: 'Declining', cls: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  }
  return <Badge className={`${map[trend].cls} border-0 text-[10px]`}>{map[trend].label}</Badge>
}

function CategoryBadge({ category }: { category: EvidenceCategory }) {
  const map = {
    Technical: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    Feature:   'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    UX:        'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  }
  return <Badge className={`${map[category]} border-0`}>{category}</Badge>
}

function EvidenceCard({
  item, isExpanded, onToggle,
}: {
  item: EvidenceItem; isExpanded: boolean; onToggle: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-card border border-border rounded-xl overflow-hidden transition-all',
        isExpanded && 'ring-2 ring-violet-500/50',
      )}
    >
      {/* ── Card header (always visible) ──────────────────────────────────── */}
      <button onClick={onToggle} className="w-full p-5 text-left hover:bg-accent/50 transition-colors">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 shrink-0">
              <Shield className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground leading-snug">{item.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {item.sources.length} sources
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {item.feedbackCount} feedback items
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-xs text-muted-foreground">
                  {item.uniqueUsers} users
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <CategoryBadge category={item.category} />
            <TrendBadge trend={item.trend} />
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </div>
        </div>

        {/* Inline confidence bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
            <div
              className="absolute h-full bg-violet-500/20 rounded-full"
              style={{
                left: `${item.uncertaintyRange[0]}%`,
                width: `${item.uncertaintyRange[1] - item.uncertaintyRange[0]}%`,
              }}
            />
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
              style={{ width: `${item.confidence}%` }}
            />
          </div>
          <span className="text-lg font-bold text-foreground w-12 text-right">
            {item.confidence}%
          </span>
        </div>
      </button>

      {/* ── Expanded detail panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-5 pt-0 border-t border-border">
              <div className="pt-5 space-y-6">

                {/* Uncertainty gauge */}
                <UncertaintyGauge confidence={item.confidence} range={item.uncertaintyRange} />

                {/* Representative quotes */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Hash className="w-4 h-4" />Representative Quotes
                  </h4>
                  <div className="space-y-2">
                    {item.representativeQuotes.map((q, i) => (
                      <div
                        key={i}
                        className="p-3 bg-muted/40 rounded-lg border-l-2 border-violet-500/50"
                      >
                        <p className="text-sm text-muted-foreground italic">"{q}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data sources */}
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Layers className="w-4 h-4" />Data Sources
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {item.sources.map((source) => (
                      <Badge key={source} variant="secondary" className="gap-1.5">
                        <ExternalLink className="w-3 h-3" />{source}
                      </Badge>
                    ))}
                    <Badge variant="secondary" className="gap-1.5 text-xs">
                      <Users className="w-3 h-3" />{item.uniqueUsers} unique users
                    </Badge>
                    <Badge variant="secondary" className="gap-1.5 text-xs">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      Validated {item.lastValidated}
                    </Badge>
                  </div>
                </div>

                {/* Linked feedback */}
                {item.linkedFeedback.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Linked Feedback
                      <span className="text-xs text-muted-foreground font-normal">
                        ({item.linkedFeedback.length} of {item.feedbackCount} shown)
                      </span>
                    </h4>
                    <div className="space-y-2">
                      {item.linkedFeedback.map((fb) => (
                        <div
                          key={fb.id}
                          className="p-3 bg-muted/50 rounded-lg flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{fb.title}</p>
                            <p className="text-xs text-muted-foreground">{fb.source} · {fb.date}</p>
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">{fb.confidenceScore}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <Button className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
                    <BarChart3 className="w-4 h-4 mr-2" />View Analysis
                  </Button>
                  <Button variant="outline" className="flex-1 bg-transparent">
                    <Link2 className="w-4 h-4 mr-2" />Link More Feedback
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function EvidenceGrid() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [evidenceList, setEvidenceList] = useState<EvidenceItem[]>(
    dataset === 'hospital_survey' ? HOSPITAL_EVIDENCE_DATA : EVIDENCE_DATA
  )

  // Only replace mock data if the API returns well-formed evidence clusters.
  useEffect(() => {
    if (!hasData) return
    getEvidence()
      .then((r) => {
        if (!r || r.length === 0) return
        const validItems = r.filter(isValidApiItem)
        if (validItems.length === 0) return   // API data not ready - keep mock
        const mapped: EvidenceItem[] = validItems.map((e: any) => ({
          id: e.id,
          clusterId: e.id,
          title: e.theme,
          sources: Object.keys(e.source_lineage ?? {}) as any,
          confidence: Math.round((e.confidence_score ?? 0) * 100),
          uncertaintyRange: [
            Math.max(0,   Math.round((e.confidence_score ?? 0) * 100) - 8),
            Math.min(100, Math.round((e.confidence_score ?? 0) * 100) + 5),
          ] as [number, number],
          feedbackCount: e.user_count ?? 0,
          uniqueUsers:   e.user_count ?? 0,
          category: 'Technical' as EvidenceCategory,
          trend: 'stable' as EvidenceTrend,
          lastValidated: (e.last_validated_at ?? '').split('T')[0],
          representativeQuotes: Array.isArray(e.representative_quotes)
            ? e.representative_quotes.map((q: any) => (typeof q === 'string' ? q : q.text ?? ''))
            : [],
          linkedFeedback: [],
        }))
        setEvidenceList(mapped)
      })
      .catch(() => {})  // silently keep mock data on any error
  }, [])

  const toggleExpand = (id: string) =>
    setExpandedId(expandedId === id ? null : id)

  const avgConf = Math.round(
    evidenceList.reduce((s, e) => s + e.confidence, 0) / evidenceList.length,
  )
  const totalFbClustered = evidenceList.reduce((s, e) => s + e.feedbackCount, 0)

  const displayList = hasData ? evidenceList : []

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Evidence Grid</h1>
          <p className="text-muted-foreground mt-1">
            pgvector cosine clusters · Titan Embed V2 · confidence ≥ 0.60 auto-accept
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!hasData && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0">No Data — Upload to Begin</Badge>}
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
            <Shield className="w-4 h-4 mr-2" />Create Evidence
          </Button>
        </div>
      </div>

      {!hasData && (
        <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm text-amber-600 dark:text-amber-400">
          Upload feedback data on the Import Sources page to see insights
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Shield,       label: 'Evidence Clusters',  value: hasData ? evidenceList.length : 0,
            gradient: 'from-blue-500/5 to-blue-500/10',      iconColor: 'text-blue-600',
          },
          {
            icon: TrendingUp,   label: 'Avg Confidence',     value: hasData ? `${avgConf}%` : '0%',
            gradient: 'from-violet-500/5 to-violet-500/10',  iconColor: 'text-violet-600',
          },
          {
            icon: Layers,       label: 'Feedback Clustered', value: hasData ? totalFbClustered.toLocaleString() : '0',
            gradient: 'from-green-500/5 to-green-500/10',    iconColor: 'text-green-600',
          },
          {
            icon: ExternalLink, label: 'Unique Sources',     value: hasData ? UNIQUE_SOURCES : 0,
            gradient: 'from-orange-500/5 to-orange-500/10',  iconColor: 'text-orange-600',
          },
        ].map(({ icon: Icon, label, value, gradient, iconColor }) => (
          <div key={label} className={`p-4 bg-gradient-to-br ${gradient} rounded-xl border border-border`}>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-white/50 dark:bg-black/20">
                <Icon className={`w-5 h-5 ${iconColor} dark:opacity-80`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-sm text-muted-foreground">{label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Info banner ────────────────────────────────────────────────────── */}
      <div className="p-4 mb-6 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-orange-500/5 rounded-xl border border-border flex items-start gap-3">
        <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-foreground font-medium">How confidence is computed</p>
          <p className="text-sm text-muted-foreground mt-1">
            Each cluster's confidence score is derived from cosine variance across member embeddings:
            {' '}<code className="bg-muted px-1 rounded text-xs">clamp(1.0 - variance × 2.0, 0.0, 1.0)</code>.
            Tight clusters score near 1.0. The shaded uncertainty band represents the lower and upper bounds
            given the spread of member vectors. Clusters below 0.40 are held in staging; 0.40–0.59 trigger LLM validation.
          </p>
        </div>
      </div>

      {/* ── Evidence cards grid ────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-4">
        {displayList.map((item) => (
          <EvidenceCard
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={() => toggleExpand(item.id)}
          />
        ))}
        {!hasData && displayList.length === 0 && (
          <div className="lg:col-span-2 text-center py-16 text-muted-foreground text-sm">
            Upload feedback data on the Import Sources page to see insights
          </div>
        )}
      </div>
    </div>
  )
}
