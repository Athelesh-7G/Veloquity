import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Layers, Search, Plus, MessageSquare, TrendingUp, TrendingDown,
  Users, Merge, Edit2, Trash2, X, ExternalLink, Hash, Shield,
  AlertCircle, ChevronDown, ChevronUp, ArrowUpDown, Minus, AlertTriangle
} from 'lucide-react'
import { hasUploadedData, getActiveDataset } from '@/utils/uploadState'
import { HOSPITAL_THEMES } from '@/api/mockData'

interface ThemeItem {
  id: string
  name: string
  description: string
  feedbackCount: number
  uniqueUsers: number
  confidence: number
  sentiment: 'positive' | 'negative' | 'mixed'
  trend: 'rising' | 'stable' | 'declining'
  keywords: string[]
  color: string
  clusterId: string
  sources: string[]
  representativeQuotes: string[]
  category: 'Technical' | 'Feature' | 'UX'
}

const themes: ThemeItem[] = [
  {
    id: '1', clusterId: 'c1',
    name: 'App crashes on project switch',
    description: 'Fatal crash when navigating between projects — null pointer in project context handler, introduced in v2.4',
    feedbackCount: 138, uniqueUsers: 94, confidence: 91,
    sentiment: 'negative', trend: 'rising',
    keywords: ['crash', 'project switch', 'null pointer', 'v2.4', 'fatal'],
    color: 'bg-red-500', sources: ['App Store', 'Support Tickets'], category: 'Technical',
    representativeQuotes: [
      'Crashes every time I switch between projects — started after v2.4.',
      'Fatal crash on workspace navigation. Null pointer in project context handler.',
      '1 star until this is fixed. Completely unusable for multi-project workflows.',
    ],
  },
  {
    id: '2', clusterId: 'c2',
    name: 'Black screen after latest update',
    description: 'Cold-start async init deadlock post v2.4 — black screen for 15–20s on every launch, iOS and macOS affected',
    feedbackCount: 112, uniqueUsers: 78, confidence: 87,
    sentiment: 'negative', trend: 'rising',
    keywords: ['black screen', 'launch', 'cold start', 'v2.4', 'deadlock'],
    color: 'bg-orange-500', sources: ['App Store', 'Support Tickets'], category: 'Technical',
    representativeQuotes: [
      'Black screen for 15–20 seconds on every cold start since v2.4.',
      'All 12 users on our account hit black screen on launch.',
      'Uninstalled and reinstalled — still happens every morning.',
    ],
  },
  {
    id: '3', clusterId: 'c3',
    name: 'Dashboard load time regression',
    description: 'Load time jumped from 2s to 12s after v2.4 — frontend render cycle change, scales badly with project count',
    feedbackCount: 94, uniqueUsers: 61, confidence: 86,
    sentiment: 'negative', trend: 'stable',
    keywords: ['slow', 'dashboard', 'loading', '12 seconds', 'enterprise'],
    color: 'bg-blue-400', sources: ['App Store', 'Support Tickets'], category: 'Technical',
    representativeQuotes: [
      'Dashboard went from 2s to 12s after v2.4. Backend response times are fine.',
      'Enterprise workspace (200+ projects) takes 12–15 seconds. Scales badly.',
    ],
  },
  {
    id: '4', clusterId: 'c4',
    name: 'No onboarding checklist for new users',
    description: 'Users sign up with no guided setup — no welcome tour, no checklist, each new team member needs a 30-min manual walkthrough',
    feedbackCount: 82, uniqueUsers: 67, confidence: 81,
    sentiment: 'mixed', trend: 'rising',
    keywords: ['onboarding', 'checklist', 'new user', 'setup', 'welcome tour'],
    color: 'bg-blue-500', sources: ['App Store', 'Support Tickets'], category: 'UX',
    representativeQuotes: [
      'Signed up, had no idea where to start. No checklist, no welcome tour.',
      'Every new team member needs a 30-min walkthrough. No in-app onboarding exists.',
    ],
  },
  {
    id: '5', clusterId: 'c5',
    name: 'Export to CSV silently fails',
    description: 'Export shows success toast but produces a 0-byte file — affects datasets over 100 rows, likely server-side timeout',
    feedbackCount: 58, uniqueUsers: 39, confidence: 77,
    sentiment: 'negative', trend: 'declining',
    keywords: ['export', 'CSV', 'silent failure', 'empty file', 'timeout'],
    color: 'bg-violet-500', sources: ['App Store', 'Support Tickets'], category: 'Feature',
    representativeQuotes: [
      'Export shows success toast but file is 0 bytes. Tried Chrome, Safari, Firefox.',
      'Works for <100 rows, silently fails for 5000+. Must be timing out server-side.',
    ],
  },
  {
    id: '6', clusterId: 'c6',
    name: 'Notification delay on mobile',
    description: 'Push notifications arrive 20–40 minutes late on iOS and Android — email unaffected, server-side delivery queue suspected',
    feedbackCount: 37, uniqueUsers: 28, confidence: 72,
    sentiment: 'mixed', trend: 'stable',
    keywords: ['notifications', 'push', 'delay', 'mobile', 'iOS', 'Android'],
    color: 'bg-cyan-500', sources: ['App Store', 'Support Tickets'], category: 'Feature',
    representativeQuotes: [
      'Push notifications arrive 20–40 minutes late. Email is instant but push is broken.',
      'Both iOS and Android affected. Background refresh is on. Latency issue is server-side.',
    ],
  },
]

// ─── Slide-over detail panel ──────────────────────────────────────────────────
function ThemeSlideOver({ theme, onClose }: { theme: ThemeItem; onClose: () => void }) {
  const sentimentColor =
    theme.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-600' :
    theme.sentiment === 'negative' ? 'bg-red-500/10 text-red-600' :
                                     'bg-blue-500/10 text-blue-600'
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl z-50 overflow-y-auto"
      >
        <div className="sticky top-0 bg-background/90 backdrop-blur-xl border-b border-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${theme.color}`} />
            <Badge className={`${sentimentColor} border-0`}>{theme.sentiment}</Badge>
            <Badge variant="secondary" className="text-[10px]">{theme.category}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground leading-snug">{theme.name}</h2>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{theme.description}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Feedback Items', value: theme.feedbackCount, icon: MessageSquare },
              { label: 'Unique Users',   value: theme.uniqueUsers,   icon: Users },
              { label: 'Confidence',     value: `${theme.confidence}%`, icon: Shield },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="p-3 bg-muted/40 rounded-xl text-center">
                <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cluster Confidence</span>
              <span className="font-semibold text-foreground">{theme.confidence}%</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${theme.confidence}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full" />
            </div>
            <p className="text-xs text-muted-foreground">≥ 0.60 auto-accept threshold · Titan Embed V2 cosine cluster</p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />Data Sources
            </h3>
            <div className="flex gap-2">
              {theme.sources.map((s) => (
                <Badge key={s} variant="secondary" className="gap-1.5">
                  <ExternalLink className="w-3 h-3" />{s}
                </Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <Hash className="w-4 h-4" />Keywords
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {theme.keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />Representative Quotes
            </h3>
            <div className="space-y-2">
              {theme.representativeQuotes.map((q, i) => (
                <div key={i} className="p-3 bg-muted/40 rounded-lg border-l-2 border-violet-500/50">
                  <p className="text-sm text-muted-foreground italic">"{q}"</p>
                </div>
              ))}
            </div>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-500/5 to-violet-500/5 border border-border rounded-xl flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Signal Trend</p>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{theme.trend} — last validated 2026-03-10</p>
            </div>
            <Badge className={`border-0 capitalize ${
              theme.trend === 'rising'    ? 'bg-red-500/10 text-red-600' :
              theme.trend === 'declining' ? 'bg-green-500/10 text-green-600' :
                                            'bg-blue-500/10 text-blue-600'
            }`}>{theme.trend}</Badge>
          </div>
          <div className="flex gap-3 pt-2 border-t border-border">
            <Button className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700">
              Link to Evidence
            </Button>
            <Button variant="outline" className="flex-1 bg-transparent">
              <Edit2 className="w-4 h-4 mr-2" />Edit Theme
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Confidence mini-bar ──────────────────────────────────────────────────────
function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 85 ? 'from-emerald-500 to-emerald-400' :
                value >= 75 ? 'from-blue-500 to-violet-500' :
                              'from-orange-500 to-red-400'
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
        />
      </div>
      <span className="text-xs font-semibold text-foreground w-8 text-right tabular-nums">{value}%</span>
    </div>
  )
}

// ─── Trend chip ───────────────────────────────────────────────────────────────
function TrendChip({ trend }: { trend: ThemeItem['trend'] }) {
  if (trend === 'rising')    return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-500">
      <TrendingUp className="w-2.5 h-2.5" />Rising
    </span>
  )
  if (trend === 'declining') return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600">
      <TrendingDown className="w-2.5 h-2.5" />Declining
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-500">
      <Minus className="w-2.5 h-2.5" />Stable
    </span>
  )
}

// ─── Category chip ────────────────────────────────────────────────────────────
function CategoryChip({ category }: { category: ThemeItem['category'] }) {
  const map = {
    Technical: 'bg-blue-500/10 text-blue-600',
    Feature:   'bg-violet-500/10 text-violet-600',
    UX:        'bg-orange-500/10 text-orange-600',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${map[category]}`}>
      {category}
    </span>
  )
}

// ─── Expanded row detail ──────────────────────────────────────────────────────
function ExpandedRow({ theme }: { theme: ThemeItem }) {
  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <td colSpan={8} className="px-0 pb-0">
        <div className="mx-4 mb-4 p-4 bg-muted/30 rounded-xl border border-border grid md:grid-cols-3 gap-4">
          {/* Description */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description</p>
            <p className="text-xs text-foreground leading-relaxed">{theme.description}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {theme.keywords.map((kw) => (
                <Badge key={kw} variant="secondary" className="text-[10px]">{kw}</Badge>
              ))}
            </div>
          </div>
          {/* Quotes */}
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Representative Quotes</p>
            <div className="space-y-1.5">
              {theme.representativeQuotes.slice(0, 2).map((q, i) => (
                <div key={i} className="p-2 bg-background rounded-lg border-l-2 border-violet-500/40">
                  <p className="text-[11px] text-muted-foreground italic leading-snug">"{q}"</p>
                </div>
              ))}
            </div>
          </div>
          {/* Meta + actions */}
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Sources</p>
              <div className="flex gap-1.5">
                {theme.sources.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px] gap-1">
                    <ExternalLink className="w-2.5 h-2.5" />{s}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Cluster ID</p>
              <code className="text-[10px] bg-muted px-2 py-0.5 rounded font-mono text-foreground">{theme.clusterId}</code>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 flex-1">
                Link to Evidence
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent">
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </td>
    </motion.tr>
  )
}

type SortKey = 'feedbackCount' | 'uniqueUsers' | 'confidence' | 'name'
type SortDir = 'asc' | 'desc'

export default function Themes() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()

  const initialThemes: ThemeItem[] = !hasData
    ? []
    : dataset === 'hospital_survey'
      ? (HOSPITAL_THEMES as ThemeItem[])
      : themes

  const [searchQuery, setSearchQuery]   = useState('')
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [activeTheme, setActiveTheme]   = useState<ThemeItem | null>(null)
  const [themeList, setThemeList]       = useState<ThemeItem[]>(initialThemes)
  const [expandedId, setExpandedId]     = useState<string | null>(null)
  const [sortKey, setSortKey]           = useState<SortKey>('feedbackCount')
  const [sortDir, setSortDir]           = useState<SortDir>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = themeList
    .filter((t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1
      if (sortKey === 'name') return mul * a.name.localeCompare(b.name)
      return mul * (a[sortKey] - b[sortKey])
    })

  const totalFeedback  = themeList.reduce((s, t) => s + t.feedbackCount, 0)
  const avgConf        = themeList.length ? Math.round(themeList.reduce((s, t) => s + t.confidence, 0) / themeList.length) : 0
  const risingCount    = themeList.filter((t) => t.trend === 'rising').length
  const maxFeedback    = themeList.length ? Math.max(...themeList.map((t) => t.feedbackCount)) : 1

  const SortBtn = ({ col, label }: { col: SortKey; label: string }) => (
    <button
      onClick={() => handleSort(col)}
      className="flex items-center gap-1 group text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      <ArrowUpDown className={`w-3 h-3 transition-colors ${sortKey === col ? 'text-violet-500' : 'opacity-40 group-hover:opacity-70'}`} />
    </button>
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">Themes</h1>
            {!hasData && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 border">No Data — Upload to Begin</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">Clustered feedback signals · pgvector cosine · Titan Embed V2</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedThemes.length > 1 && (
            <Button variant="outline"><Merge className="w-4 h-4 mr-2" />Merge Selected</Button>
          )}
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 text-white">
            <Plus className="w-4 h-4 mr-2" />Create Theme
          </Button>
        </div>
      </div>

      {/* No-data banner */}
      {!hasData && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Upload feedback data on the <span className="font-medium">Import Sources</span> page to unlock evidence themes
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search themes or keywords..." className="pl-10" value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      {/* Stat pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Themes',    value: themeList.length,               icon: Layers,        grad: 'from-violet-500/5 to-violet-500/10' },
          { label: 'Total Feedback',  value: totalFeedback.toLocaleString(), icon: MessageSquare, grad: 'from-blue-500/5 to-blue-500/10'     },
          { label: 'Avg Confidence',  value: `${avgConf}%`,                  icon: Shield,        grad: 'from-emerald-500/5 to-emerald-500/10'},
          { label: 'Rising Themes',   value: risingCount,                    icon: TrendingUp,    grad: 'from-red-500/5 to-red-500/10'       },
        ].map(({ label, value, icon: Icon, grad }) => (
          <div key={label} className={`p-4 rounded-xl border border-border bg-gradient-to-br ${grad} flex items-center gap-3`}>
            <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Head */}
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="py-3 pl-4 pr-2 w-8">
                  <input type="checkbox"
                    className="rounded border-border"
                    aria-label="Select all themes"
                    checked={selectedThemes.length === filtered.length && filtered.length > 0}
                    onChange={() => setSelectedThemes(
                      selectedThemes.length === filtered.length ? [] : filtered.map((t) => t.id)
                    )}
                  />
                </th>
                <th className="py-3 px-3 text-left w-6"></th>
                <th className="py-3 px-3 text-left">
                  <SortBtn col="name" label="Theme" />
                </th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                <th className="py-3 px-3 text-left">
                  <SortBtn col="feedbackCount" label="Feedback" />
                </th>
                <th className="py-3 px-3 text-left">
                  <SortBtn col="uniqueUsers" label="Users" />
                </th>
                <th className="py-3 px-3 text-left">
                  <SortBtn col="confidence" label="Confidence" />
                </th>
                <th className="py-3 px-3 text-left text-xs font-semibold text-muted-foreground">Trend</th>
                <th className="py-3 pl-3 pr-4 text-right text-xs font-semibold text-muted-foreground">Actions</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody>
              <AnimatePresence>
                {filtered.map((theme, idx) => (
                  <>
                    <motion.tr
                      key={theme.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ delay: idx * 0.04, duration: 0.25 }}
                      className={`border-b border-border/60 transition-colors cursor-pointer
                        ${selectedThemes.includes(theme.id) ? 'bg-violet-500/5' : 'hover:bg-muted/30'}
                        ${expandedId === theme.id ? 'bg-muted/20' : ''}
                      `}
                      onClick={() => setExpandedId(expandedId === theme.id ? null : theme.id)}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox"
                          className="rounded border-border"
                          aria-label={`Select theme: ${theme.name}`}
                          checked={selectedThemes.includes(theme.id)}
                          onChange={() => setSelectedThemes((prev) =>
                            prev.includes(theme.id) ? prev.filter((id) => id !== theme.id) : [...prev, theme.id]
                          )}
                        />
                      </td>

                      {/* Color dot */}
                      <td className="py-3.5 px-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${theme.color}`} />
                      </td>

                      {/* Name */}
                      <td className="py-3.5 px-3 max-w-[220px]">
                        <p className="text-sm font-semibold text-foreground truncate">{theme.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                          {theme.clusterId} · {theme.sources.join(' + ')}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-3">
                        <CategoryChip category={theme.category} />
                      </td>

                      {/* Feedback */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold text-foreground">{theme.feedbackCount}</span>
                        </div>
                        {/* Mini volume bar */}
                        <div className="mt-1 w-16 h-0.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(theme.feedbackCount / maxFeedback) * 100}%` }}
                            transition={{ duration: 0.6, delay: idx * 0.04 }}
                            className="h-full bg-violet-500/60 rounded-full"
                          />
                        </div>
                      </td>

                      {/* Users */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-semibold text-foreground">{theme.uniqueUsers}</span>
                        </div>
                      </td>

                      {/* Confidence */}
                      <td className="py-3.5 px-3 min-w-[130px]">
                        <ConfidenceBar value={theme.confidence} />
                      </td>

                      {/* Trend */}
                      <td className="py-3.5 px-3">
                        <TrendChip trend={theme.trend} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-3 pr-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => setActiveTheme(theme)}>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => setThemeList((prev) => prev.filter((t) => t.id !== theme.id))}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            {expandedId === theme.id
                              ? <ChevronUp className="w-3.5 h-3.5 text-violet-500" />
                              : <ChevronDown className="w-3.5 h-3.5" />
                            }
                          </Button>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expanded inline detail */}
                    <AnimatePresence>
                      {expandedId === theme.id && (
                        <ExpandedRow key={`${theme.id}-expanded`} theme={theme} />
                      )}
                    </AnimatePresence>
                  </>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-14 text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">No themes match your search.</p>
          </div>
        )}

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/10 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {selectedThemes.length > 0
                ? `${selectedThemes.length} of ${filtered.length} selected`
                : `${filtered.length} theme${filtered.length !== 1 ? 's' : ''}`}
            </p>
            {selectedThemes.length > 1 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs bg-transparent">
                  <Merge className="w-3 h-3 mr-1.5" />Merge
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground"
                  onClick={() => setSelectedThemes([])}>
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide-over */}
      {activeTheme && <ThemeSlideOver theme={activeTheme} onClose={() => setActiveTheme(null)} />}
    </div>
  )
}