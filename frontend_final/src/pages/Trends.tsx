import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LineChart, TrendingUp, TrendingDown, Minus, Calendar, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react'

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
const CHART_DATA: Record<string, { label: string; appStore: number; zendesk: number }[]> = {
  '7d': [
    { label: 'Mar 4',  appStore: 18, zendesk: 16 },
    { label: 'Mar 5',  appStore: 22, zendesk: 19 },
    { label: 'Mar 6',  appStore: 17, zendesk: 21 },
    { label: 'Mar 7',  appStore: 25, zendesk: 23 },
    { label: 'Mar 8',  appStore: 28, zendesk: 26 },
    { label: 'Mar 9',  appStore: 31, zendesk: 28 },
    { label: 'Mar 10', appStore: 34, zendesk: 30 },
  ],
  '30d': [
    { label: 'Feb 9',  appStore: 52, zendesk: 48 },
    { label: 'Feb 16', appStore: 61, zendesk: 57 },
    { label: 'Feb 23', appStore: 74, zendesk: 69 },
    { label: 'Mar 1',  appStore: 88, zendesk: 82 },
    { label: 'Mar 10', appStore: 96, zendesk: 91 },
  ],
  '90d': [
    { label: 'Wk 1',  appStore: 28, zendesk: 24 },
    { label: 'Wk 2',  appStore: 33, zendesk: 29 },
    { label: 'Wk 3',  appStore: 38, zendesk: 34 },
    { label: 'Wk 4',  appStore: 42, zendesk: 39 },
    { label: 'Wk 5',  appStore: 47, zendesk: 43 },
    { label: 'Wk 6',  appStore: 53, zendesk: 49 },
    { label: 'Wk 7',  appStore: 58, zendesk: 54 },
    { label: 'Wk 8',  appStore: 64, zendesk: 60 },
    { label: 'Wk 9',  appStore: 70, zendesk: 65 },
    { label: 'Wk 10', appStore: 76, zendesk: 71 },
    { label: 'Wk 11', appStore: 83, zendesk: 78 },
    { label: 'Wk 12', appStore: 96, zendesk: 91 },
  ],
  '1y': [
    { label: 'Apr',   appStore: 38, zendesk: 34 },
    { label: 'May',   appStore: 47, zendesk: 42 },
    { label: 'Jun',   appStore: 55, zendesk: 50 },
    { label: 'Jul',   appStore: 63, zendesk: 58 },
    { label: 'Aug',   appStore: 72, zendesk: 67 },
    { label: 'Sep',   appStore: 80, zendesk: 74 },
    { label: 'Oct',   appStore: 86, zendesk: 80 },
    { label: 'Nov',   appStore: 91, zendesk: 85 },
    { label: 'Dec',   appStore: 96, zendesk: 89 },
    { label: 'Jan',   appStore: 101, zendesk: 94 },
    { label: 'Feb',   appStore: 112, zendesk: 105 },
    { label: 'Mar',   appStore: 118, zendesk: 110 },
  ],
}

const INSIGHTS = [
  {
    icon: TrendingUp, color: 'emerald',
    title: 'Feedback corpus grew 12.1% this period',
    desc: '547 items ingested — App Store (275) and Zendesk (272). Cross-source corroboration strengthens cluster confidence.',
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

export default function Trends() {
  const [timeRange, setTimeRange] = useState('30d')
  const [hoveredBar, setHoveredBar] = useState<number | null>(null)
  const chartData = CHART_DATA[timeRange]
  const chartMax = Math.max(...chartData.map((d) => d.appStore + d.zendesk))

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trends</h1>
          <p className="text-muted-foreground mt-1">Track key metrics over time</p>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trendsData.map((trend) => (
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
          <CardDescription>Daily feedback submissions — App Store vs Zendesk</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Legend */}
          <div className="flex items-center gap-6 mb-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-violet-600" />
              <span className="text-xs text-muted-foreground">App Store</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-400/70" />
              <span className="text-xs text-muted-foreground">Zendesk</span>
            </div>
            <span className="text-xs text-muted-foreground ml-auto">
              Total: {chartData.reduce((s, d) => s + d.appStore + d.zendesk, 0)} items
            </span>
          </div>

          {/* Chart area */}
          <div className="relative h-52 bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-orange-500/5 rounded-xl border border-border px-3 pt-2 pb-7 overflow-visible">
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
                const total = d.appStore + d.zendesk
                const totalH = (total / chartMax) * 100
                const appH   = (d.appStore / total) * totalH
                const zenH   = (d.zendesk  / total) * totalH
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
                          App Store: <span className="font-medium text-foreground">{d.appStore}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <div className="w-2 h-2 rounded-sm bg-blue-400/70" />
                          Zendesk: <span className="font-medium text-foreground">{d.zendesk}</span>
                        </div>
                        <div className="border-t border-border mt-1 pt-1 text-xs font-semibold text-foreground">Total: {total}</div>
                      </div>
                    )}
                    {/* Stacked bar */}
                    <div className={`w-full flex flex-col justify-end rounded-t-sm overflow-hidden transition-opacity ${isHov ? 'opacity-100' : 'opacity-80'}`} style={{ height: `${totalH}%` }}>
                      <motion.div
                        className="w-full bg-blue-400/70"
                        initial={{ height: 0 }}
                        animate={{ height: `${zenH / totalH * 100}%` }}
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
          </div>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Card className="bg-gradient-to-br from-blue-500/5 via-violet-500/5 to-orange-500/5">
        <CardHeader><CardTitle className="text-lg">Key Insights</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {INSIGHTS.map((insight, i) => (
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
        </CardContent>
      </Card>
    </div>
  )
}