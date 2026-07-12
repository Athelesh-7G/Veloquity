import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, TrendingUp, TrendingDown, Minus, Calendar, ArrowUpRight, ArrowDownRight, Filter, AlertTriangle, Wifi } from 'lucide-react'
import { hasUploadedData, getActiveDataset, getLiveMode, setLiveMode, hasActiveSources, getSourceLabel } from '@/utils/uploadState'
import { fetchLiveEvidence, fetchLiveStats, type EvidenceItem as ApiEvidenceItem } from '@/api/client'
import { HOSPITAL_CHART_DATA, HOSPITAL_TRENDS_METRICS } from '@/api/mockData'

// ─── Static sparklines per metric (normalised 0–100 for height, last = current) ───
const trendsData = [
  {
    id: '1', name: 'Total Feedback Volume',
    currentValue: 547, previousValue: 488, change: 12.1, trend: 'up' as const,
    unit: '', positiveIsGood: true,
    sparkline: [42, 47, 44, 51, 55, 53, 59, 62, 68, 73, 79, 84, 91, 95, 100],
  },
  {
    id: '2', name: 'Avg Confidence Score',
    currentValue: 84, previousValue: 81, change: 3.7, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [74, 75, 74, 76, 75, 77, 76, 78, 78, 79, 80, 81, 82, 83, 84],
  },
  {
    id: '3', name: 'Evidence Clusters',
    currentValue: 6, previousValue: 6, change: 0, trend: 'stable' as const,
    unit: '', positiveIsGood: true,
    sparkline: [50, 50, 67, 67, 67, 83, 83, 83, 83, 100, 100, 100, 100, 100, 100],
  },
  {
    id: '4', name: 'Analyzed',
    currentValue: 91, previousValue: 86, change: 5.8, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [72, 73, 74, 76, 75, 78, 79, 80, 82, 83, 85, 87, 88, 90, 91],
  },
  {
    id: '5', name: 'Cache Hit Rate',
    currentValue: 91, previousValue: 87, change: 4.6, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [68, 70, 69, 73, 72, 75, 76, 78, 80, 82, 84, 86, 88, 90, 91],
  },
  {
    id: '6', name: 'Avg Cluster Confidence',
    currentValue: 84, previousValue: 81, change: 3.7, trend: 'up' as const,
    unit: '%', positiveIsGood: true,
    sparkline: [73, 74, 73, 75, 74, 76, 75, 77, 78, 79, 80, 81, 82, 83, 84],
  },
]

// ─── Interactive chart: feedback volume by day/week/month ──────────────────────
const CHART_DATA: Record<string, { label: string; appStore: number; supportTickets: number }[]> = {
  '7d': [
    { label: 'Mar 4',  appStore: 18, supportTickets:16 },
    { label: 'Mar 5',  appStore: 22, supportTickets:19 },
    { label: 'Mar 6',  appStore: 17, supportTickets:21 },
    { label: 'Mar 7',  appStore: 25, supportTickets:23 },
    { label: 'Mar 8',  appStore: 28, supportTickets:26 },
    { label: 'Mar 9',  appStore: 31, supportTickets:28 },
    { label: 'Mar 10', appStore: 34, supportTickets:30 },
  ],
  '30d': [
    { label: 'Feb 9',  appStore: 52, supportTickets:48 },
    { label: 'Feb 16', appStore: 61, supportTickets:57 },
    { label: 'Feb 23', appStore: 74, supportTickets:69 },
    { label: 'Mar 1',  appStore: 88, supportTickets:82 },
    { label: 'Mar 10', appStore: 96, supportTickets:91 },
  ],
  '90d': [
    { label: 'Wk 1',  appStore: 28, supportTickets:24 },
    { label: 'Wk 2',  appStore: 33, supportTickets:29 },
    { label: 'Wk 3',  appStore: 38, supportTickets:34 },
    { label: 'Wk 4',  appStore: 42, supportTickets:39 },
    { label: 'Wk 5',  appStore: 47, supportTickets:43 },
    { label: 'Wk 6',  appStore: 53, supportTickets:49 },
    { label: 'Wk 7',  appStore: 58, supportTickets:54 },
    { label: 'Wk 8',  appStore: 64, supportTickets:60 },
    { label: 'Wk 9',  appStore: 70, supportTickets:65 },
    { label: 'Wk 10', appStore: 76, supportTickets:71 },
    { label: 'Wk 11', appStore: 83, supportTickets:78 },
    { label: 'Wk 12', appStore: 96, supportTickets:91 },
  ],
  '1y': [
    { label: 'Apr',   appStore: 38, supportTickets:34 },
    { label: 'May',   appStore: 47, supportTickets:42 },
    { label: 'Jun',   appStore: 55, supportTickets:50 },
    { label: 'Jul',   appStore: 63, supportTickets:58 },
    { label: 'Aug',   appStore: 72, supportTickets:67 },
    { label: 'Sep',   appStore: 80, supportTickets:74 },
    { label: 'Oct',   appStore: 86, supportTickets:80 },
    { label: 'Nov',   appStore: 91, supportTickets:85 },
    { label: 'Dec',   appStore: 96, supportTickets:89 },
    { label: 'Jan',   appStore: 101, supportTickets:94 },
    { label: 'Feb',   appStore: 112, supportTickets:105 },
    { label: 'Mar',   appStore: 118, supportTickets:110 },
  ],
}

const INSIGHTS = [
  {
    icon: TrendingUp, color: 'emerald',
    title: 'Feedback corpus grew 12.1% this period',
    desc: '547 items ingested — App Store (275) and Support Tickets (272). Cross-source corroboration strengthens cluster confidence.',
  },
  {
    icon: TrendingUp, color: 'emerald',
    title: 'Avg cluster confidence rose to 84%',
    desc: 'All 6 clusters exceed the 0.60 auto-accept threshold. Top cluster (app crash) sits at 91% — tightest cosine grouping in the corpus.',
  },
  {
    icon: TrendingDown, color: 'amber',
    title: 'Two rising-trend clusters need sprint attention',
    desc: '"App crashes on project switch" and "Black screen after latest update" both trending up — likely a shared v2.4 regression root cause.',
  },
]

const HOSPITAL_INSIGHTS = [
  {
    icon: TrendingUp, color: 'red',
    title: 'Emergency wait time complaints rising — 98 items ingested',
    desc: 'Highest-confidence cluster (91%) with cross-source corroboration from Patient Portal and Hospital Survey. Trend worsening month-over-month.',
  },
  {
    icon: Minus, color: 'blue',
    title: 'Booking portal failures stable at 76 items',
    desc: '71 unique patients affected by double-booking and portal crash. Session timeout is the primary trigger — appointment sync fix needed.',
  },
  {
    icon: TrendingDown, color: 'emerald',
    title: 'Medical records access issues declining',
    desc: '54 items, trend improving. Android crash and password lockout are discrete engineering fixes — partial remediation likely already in effect.',
  },
]

const EMPTY_TRENDS_METRICS = trendsData.map((t) => ({
  ...t,
  currentValue: 0,
  previousValue: 0,
  change: 0,
  trend: 'stable' as const,
  sparkline: Array(15).fill(50) as number[],
}))

function generateLiveInsights(
  evidence: ApiEvidenceItem[],
  stats: { total_embedded: number; active_clusters: number; mapped_items: number; avg_confidence: number } | null,
) {
  if (!evidence || evidence.length === 0) return []
  const sortedByConf = [...evidence].sort((a, b) => b.confidence_score - a.confidence_score)
  const topCluster = sortedByConf[0]
  const avgConf = Math.round(evidence.reduce((s, e) => s + e.confidence_score * 100, 0) / evidence.length)
  const allSources = new Set<string>()
  evidence.forEach((e) => Object.keys(e.source_lineage || {}).forEach((s) => allSources.add(s)))
  const sourceNames = Array.from(allSources).map((s) => getSourceLabel(s)).join(' and ')
  const totalItems = stats?.total_embedded ?? 0
  const recentCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
  const risingClusters = evidence.filter(
    (e) => e.last_validated_at && new Date(e.last_validated_at) > recentCutoff,
  ).slice(0, 2)

  const insights: { icon: typeof TrendingUp; color: string; title: string; desc: string }[] = []
  insights.push({
    icon: TrendingUp, color: 'emerald',
    title: `Feedback corpus: ${totalItems > 0 ? totalItems : evidence.reduce((s, e) => s + (e.item_count || e.unique_user_count || 0), 0)} items analyzed`,
    desc: `${sourceNames} — ${evidence.length} cluster${evidence.length !== 1 ? 's' : ''} accepted at ≥ 0.60 confidence threshold. Cross-source corroboration strengthens cluster confidence.`,
  })
  insights.push({
    icon: TrendingUp, color: 'blue',
    title: `Avg cluster confidence: ${avgConf}%`,
    desc: `${sortedByConf.filter((e) => e.confidence_score >= 0.60).length} of ${evidence.length} clusters exceed the 0.60 auto-accept threshold. Top cluster "${topCluster?.theme?.split(' | ')[0]?.slice(0, 40)}" sits at ${Math.round((topCluster?.confidence_score || 0) * 100)}%.`,
  })
  if (risingClusters.length > 0) {
    insights.push({
      icon: TrendingDown, color: 'amber',
      title: `${risingClusters.length} cluster${risingClusters.length > 1 ? 's' : ''} validated recently`,
      desc: risingClusters.map((c) => `"${c.theme?.split(' | ')[0]?.slice(0, 35)}" (${Math.round(c.confidence_score * 100)}% conf)`).join(' and ') + ' — actively corroborated across sources.',
    })
  }
  return insights
}

export default function Trends() {
  const hasData = hasUploadedData()
  const dataset = getActiveDataset()
  const [timeRange, setTimeRange] = useState('30d')
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)

  // Live mode
  const [liveMode, setLiveModeState]      = useState(() => getLiveMode())
  const [liveEvidence, setLiveEvidence]   = useState<ApiEvidenceItem[] | null>(null)
  const [liveStats, setLiveStats]         = useState<{ total_embedded: number; active_clusters: number; mapped_items: number; avg_confidence: number } | null>(null)
  const [liveLoading, setLiveLoading]     = useState(() => getLiveMode() && hasActiveSources())
  const [liveError, setLiveError]         = useState<string | null>(null)

  useEffect(() => {
    if (!liveMode) return
    if (!hasActiveSources()) {
      setLiveEvidence([])
      setLiveLoading(false)
      return
    }
    setLiveLoading(true)
    setLiveError(null)
    fetchLiveEvidence()
      .then((ev) => {
        setLiveEvidence(ev)
        // Stats endpoint may not be deployed — derive from evidence on failure
        fetchLiveStats()
          .then((stats) => setLiveStats(stats))
          .catch(() => {
            const totalItems = ev.reduce((s, e) => s + (e.item_count ?? 0), 0)
            const avgConf = ev.length > 0 ? ev.reduce((s, e) => s + e.confidence_score, 0) / ev.length : 0
            setLiveStats({
              total_embedded: totalItems,
              active_clusters: ev.length,
              mapped_items: totalItems,
              avg_confidence: avgConf,
            })
          })
        setLiveLoading(false)
      })
      .catch((err: Error) => { setLiveError(err.message); setLiveLoading(false) })
  }, [liveMode])

  // Derive live metrics from API evidence
  const liveTrendsMetrics = liveEvidence ? [
    {
      id: 'l1', name: 'Evidence Clusters',
      currentValue: liveEvidence.length, previousValue: 0, change: 0, trend: 'stable' as const,
      unit: '', positiveIsGood: true,
      sparkline: Array(15).fill(0).map((_, i) => Math.round((i / 14) * 100)) as number[],
    },
    {
      id: 'l2', name: 'Avg Confidence Score',
      currentValue: liveEvidence.length > 0 ? Math.round(liveEvidence.reduce((s, e) => s + e.confidence_score, 0) / liveEvidence.length * 100) : 0,
      previousValue: 0, change: 0, trend: 'stable' as const,
      unit: '%', positiveIsGood: true,
      sparkline: liveEvidence.map((e) => Math.round(e.confidence_score * 100)).slice(0, 15).concat(Array(Math.max(0, 15 - liveEvidence.length)).fill(50)) as number[],
    },
    {
      id: 'l3', name: 'Total Unique Users',
      currentValue: liveEvidence.reduce((s, e) => s + e.unique_user_count, 0),
      previousValue: 0, change: 0, trend: 'stable' as const,
      unit: '', positiveIsGood: true,
      sparkline: Array(15).fill(50) as number[],
    },
    {
      id: 'l4', name: 'Active Sources',
      currentValue: new Set(liveEvidence.flatMap((e) => Object.keys(e.source_lineage ?? {}))).size,
      previousValue: 0, change: 0, trend: 'stable' as const,
      unit: '', positiveIsGood: true,
      sparkline: Array(15).fill(50) as number[],
    },
  ] : null

  const activeMetrics  = liveMode && liveTrendsMetrics ? liveTrendsMetrics
    : !hasData ? EMPTY_TRENDS_METRICS
    : dataset === 'hospital_survey' ? HOSPITAL_TRENDS_METRICS : trendsData
  const liveInsightList = liveMode && liveEvidence && liveEvidence.length > 0
    ? generateLiveInsights(liveEvidence, liveStats)
    : null
  const activeInsights = liveMode
    ? (liveInsightList ?? [])
    : (!hasData ? [] : dataset === 'hospital_survey' ? HOSPITAL_INSIGHTS : INSIGHTS)
  const activeChartMap = dataset === 'hospital_survey' ? HOSPITAL_CHART_DATA : CHART_DATA
  const src1Label      = dataset === 'hospital_survey' ? 'Patient Portal'  : 'App Store'
  const src2Label      = dataset === 'hospital_survey' ? 'Hospital Survey' : 'Support Tickets'

  const chartData = activeChartMap[timeRange]
  const chartMax  = hasData ? Math.max(...chartData.map((d) => d.appStore + d.supportTickets)) : 100

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
        Loading V1 trend data…
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold text-foreground">Trends</h1>
            {!hasData && !liveMode && <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 border">No Data — Upload to Begin</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">Track key metrics over time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { const n = !liveMode; setLiveModeState(n); setLiveMode(n) }}
            style={{ padding:'6px 14px', borderRadius:'6px', border:'1px solid', borderColor: liveMode ? '#22c55e' : '#6b7280', background: liveMode ? '#052e16' : 'transparent', color: liveMode ? '#22c55e' : '#9ca3af', fontSize:'12px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}
          >
            <span style={{ width:8, height:8, borderRadius:'50%', background: liveMode ? '#22c55e' : '#6b7280', display:'inline-block' }} />
            {liveMode ? 'V1' : 'V0'}
          </button>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline"><Filter className="w-4 h-4 mr-2" />Filter</Button>
        </div>
      </div>

      {liveMode && liveLoading && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-green-500/30 bg-green-500/5 text-sm text-green-600 dark:text-green-400">
          <Wifi className="w-4 h-4 animate-pulse shrink-0" />Loading V1 trend data…
        </div>
      )}
      {liveMode && liveError && (
        <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/5 text-sm text-red-500">V1 pipeline error: {liveError}</div>
      )}
      {liveMode && liveEvidence && !liveLoading && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-green-500/40 bg-green-500/8 text-sm text-green-600 dark:text-green-400">
          <Wifi className="w-4 h-4 shrink-0" />
          V1 Intelligence Pipeline — metrics derived from {liveEvidence.length} real evidence clusters.
        </div>
      )}
      {/* No-data banner */}
      {!hasData && !liveMode && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Upload feedback data on the <span className="font-medium">Import Sources</span> page, or enable V1 mode to unlock trends intelligence
          </p>
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeMetrics.map((trend) => (
          <Card key={trend.id} className="hover:border-violet-500/30 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">{trend.name}</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {trend.currentValue.toLocaleString()}{trend.unit}
                  </p>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
                  trend.trend === 'stable'
                    ? 'bg-muted text-muted-foreground'
                    : trend.change > 0
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-red-500/10 text-red-600'
                }`}>
                  {trend.change > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend.change < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  {trend.change !== 0 ? `${Math.abs(trend.change)}%` : 'Stable'}
                </div>
              </div>

              {/* Sparkline — visible height differences */}
              <div className="flex items-end gap-[3px] h-14 px-0.5">
                {trend.sparkline.map((value, i) => {
                  const minVal = Math.min(...trend.sparkline)
                  const maxVal = Math.max(...trend.sparkline)
                  const range = maxVal - minVal || 1
                  // Map to 20%–100% so even low bars are clearly visible
                  const heightPct = 20 + ((value - minVal) / range) * 80
                  const isLast = i === trend.sparkline.length - 1
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-sm transition-all ${isLast ? 'bg-violet-600' : 'bg-violet-400/50'}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground mt-3">
                vs. previous period:{' '}
                <span className="font-medium text-foreground">
                  {trend.previousValue.toLocaleString()}{trend.unit}
                </span>
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Interactive stacked bar chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LineChart className="w-5 h-5 text-violet-600" />Feedback Volume Over Time
          </CardTitle>
          <CardDescription>
            {dataset === 'hospital_survey'
              ? 'Monthly patient feedback — Patient Portal vs Hospital Survey'
              : 'Daily feedback submissions — App Store vs Support Tickets'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-violet-600" />
              <span className="text-xs text-muted-foreground">{src1Label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-400/70" />
              <span className="text-xs text-muted-foreground">{src2Label}</span>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              {hasData
                ? `Total: ${chartData.reduce((s, d) => s + d.appStore + d.supportTickets, 0)} items`
                : 'No data yet'}
            </span>
          </div>

          {/* Chart area */}
          <div className="relative h-52 bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-orange-500/5 rounded-xl border border-border px-3 pt-2 pb-7 overflow-visible">
            {!hasData ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-muted-foreground/50">No feedback data — upload a CSV to populate this chart</p>
              </div>
            ) : (
              <>
                {/* Horizontal grid lines */}
                {[25, 50, 75].map((pct) => (
                  <div
                    key={pct}
                    className="absolute left-3 right-3 border-t border-border/40 flex items-center"
                    style={{ bottom: `calc(${pct / 100} * (100% - 28px) + 28px)` }}
                  >
                    <span className="text-[8px] text-muted-foreground/50 -translate-y-2 pr-1 absolute -left-1 -translate-x-full">
                      {Math.round((pct / 100) * chartMax)}
                    </span>
                  </div>
                ))}

                {/* Bars */}
                <div className="absolute inset-x-3 bottom-7 top-2 flex items-end gap-1.5">
                  {chartData.map((d, i) => {
                    const total = d.appStore + d.supportTickets
                    const totalH = (total / chartMax) * 100
                    const appH   = (d.appStore / total) * totalH
                    const suppH  = (d.supportTickets  / total) * totalH
                    const isHov  = hoveredBar === i
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col justify-end cursor-pointer group"
                        style={{ height: '100%' }}
                        onMouseEnter={() => setHoveredBar(i)}
                        onMouseLeave={() => setHoveredBar(null)}
                      >
                        {/* Tooltip */}
                        {isHov && (
                          <div className="absolute -translate-x-1/2 left-1/2 bottom-full mb-2 z-20 bg-popover border border-border rounded-lg px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none" style={{ left: `calc(${(i + 0.5) / chartData.length * 100}%)` }}>
                            <p className="text-xs font-semibold text-foreground mb-1">{d.label}</p>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <div className="w-2 h-2 rounded-sm bg-violet-600" />
                              {src1Label}: <span className="font-medium text-foreground">{d.appStore}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                              <div className="w-2 h-2 rounded-sm bg-blue-400/70" />
                              {src2Label}: <span className="font-medium text-foreground">{d.supportTickets}</span>
                            </div>
                            <div className="border-t border-border mt-1 pt-1 text-xs font-semibold text-foreground">Total: {total}</div>
                          </div>
                        )}
                        {/* Stacked bar */}
                        <div className={`w-full flex flex-col justify-end rounded-t-sm overflow-hidden transition-opacity ${isHov ? 'opacity-100' : 'opacity-80'}`} style={{ height: `${totalH}%` }}>
                          <motion.div
                            className="w-full bg-blue-400/70"
                            initial={{ height: 0 }}
                            animate={{ height: `${suppH / totalH * 100}%` }}
                            transition={{ duration: 0.5, delay: i * 0.04 }}
                          />
                          <motion.div
                            className="w-full bg-violet-600"
                            initial={{ height: 0 }}
                            animate={{ height: `${appH / totalH * 100}%` }}
                            transition={{ duration: 0.5, delay: i * 0.04 + 0.1 }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* X-axis labels */}
                <div className="absolute bottom-0 left-3 right-3 flex">
                  {chartData.map((d, i) => (
                    <div key={i} className="flex-1 text-center">
                      <span className="text-[9px] text-muted-foreground/70">{d.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          {liveMode && (
            <p className="text-xs text-muted-foreground/60 mt-3 italic">
              Chart reflects V0 sample dataset. Connect sources in Import Sources to populate with real volume data.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Card className="bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-orange-500/5">
        <CardHeader><CardTitle className="text-lg">Key Insights</CardTitle></CardHeader>
        <CardContent>
          {activeInsights.length === 0 ? (
            <p className="text-sm text-muted-foreground">Upload feedback data to generate insights.</p>
          ) : (
            <ul className="space-y-3">
              {activeInsights.map((insight, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className={`p-1 rounded-full bg-${insight.color}-500/10 mt-0.5`}>
                    <insight.icon className={`w-3 h-3 text-${insight.color}-600`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}