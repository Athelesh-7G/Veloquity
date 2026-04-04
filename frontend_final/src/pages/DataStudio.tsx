import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search, Filter, Plus, Calendar, Tag, ExternalLink,
  ChevronDown, X, Check, Archive, Layers, AlertCircle,
  CheckCircle2, Clock, RefreshCw, Wifi, Download, Loader2,
  Hash, TrendingUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { useApp } from '@/lib/app-context'
import { cn } from '@/lib/utils'
import { getEvidence } from '@/api/client'
import type { EvidenceItem } from '@/api/client'
import { useDataMode } from '@/context/DataModeContext'
import { EvidenceItemsPanel } from '@/components/EvidenceItemsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────
type FeedbackStatus = 'new' | 'processing' | 'analyzed' | 'archived'
type FeedbackSource = 'App Store' | 'Zendesk'

interface FeedbackItem {
  id: string
  title: string
  content: string
  source: FeedbackSource
  date: string
  status: FeedbackStatus
  tags: string[]
  confidenceScore: number
  clusterId?: string
  clusterName?: string
}

// ─── Veloquity-aligned mock feedback (547 items represented via 24 rich cards) ─
// feedbackCount distribution matches Dashboard: App Store ~275, Zendesk ~272
const MOCK_FEEDBACK: FeedbackItem[] = [
  // Cluster 1 — App crashes on project switch (138 items)
  {
    id: 'f001', source: 'App Store', date: '2026-03-10', status: 'analyzed',
    title: 'App crashes every time I switch between projects',
    content: 'Whenever I try to switch from one project to another, the app completely freezes and then crashes. I\'ve lost hours of work. This started after the v2.4 update and happens 100% of the time.',
    tags: ['crash', 'project-switch', 'data-loss', 'v2.4'], confidenceScore: 93,
    clusterId: 'c1', clusterName: 'App crashes on project switch',
  },
  {
    id: 'f002', source: 'Zendesk', date: '2026-03-09', status: 'analyzed',
    title: 'Fatal crash when navigating between workspaces',
    content: 'Our whole team is affected. Moving between workspaces triggers an unrecoverable crash. We\'ve filed 3 tickets now. The crash log points to a null pointer in the project context handler.',
    tags: ['crash', 'workspace', 'team-impact', 'regression'], confidenceScore: 91,
    clusterId: 'c1', clusterName: 'App crashes on project switch',
  },
  {
    id: 'f003', source: 'App Store', date: '2026-03-08', status: 'analyzed',
    title: 'Switching projects = instant crash, 1 star',
    content: 'Used to be a 5-star app. After the last update, switching projects is completely broken. App closes without warning. No error message, no autosave. Please fix urgently.',
    tags: ['crash', 'project-switch', 'regression', 'urgent'], confidenceScore: 89,
    clusterId: 'c1', clusterName: 'App crashes on project switch',
  },
  {
    id: 'f004', source: 'Zendesk', date: '2026-03-07', status: 'analyzed',
    title: 'Project context crash - reproducible steps attached',
    content: 'Attaching full crash log. Steps: open project A > create item > immediately switch to project B > crash. Reproducible on iOS 17.3 and 17.4. Seems like the context isn\'t being flushed before the switch.',
    tags: ['crash', 'ios', 'reproducible', 'debug-log'], confidenceScore: 94,
    clusterId: 'c1', clusterName: 'App crashes on project switch',
  },
  // Cluster 2 — Black screen after latest update (112 items)
  {
    id: 'f005', source: 'App Store', date: '2026-03-10', status: 'analyzed',
    title: 'Black screen on launch after updating to 2.4',
    content: 'Updated yesterday and now the app shows a black screen for 15-20 seconds before loading. Sometimes it never loads and I have to force-quit. The old version was instant. Please roll back or hotfix.',
    tags: ['black-screen', 'launch', 'v2.4', 'performance'], confidenceScore: 88,
    clusterId: 'c2', clusterName: 'Black screen after latest update',
  },
  {
    id: 'f006', source: 'Zendesk', date: '2026-03-09', status: 'analyzed',
    title: 'App stuck on black screen - multiple users affected',
    content: 'We have 12 users on our account all reporting the same black screen on launch since the 2.4 update on March 8. Cold start only - warm restart works. Suspect an async init deadlock.',
    tags: ['black-screen', 'cold-start', 'team-impact', 'deadlock'], confidenceScore: 87,
    clusterId: 'c2', clusterName: 'Black screen after latest update',
  },
  {
    id: 'f007', source: 'App Store', date: '2026-03-08', status: 'analyzed',
    title: 'Broken since update - black screen every morning',
    content: 'First launch of the day = black screen guaranteed. After force-quitting and reopening it works fine. This is extremely annoying. Happens on iPhone 14 Pro and iPad Air.',
    tags: ['black-screen', 'cold-start', 'iphone', 'ipad'], confidenceScore: 85,
    clusterId: 'c2', clusterName: 'Black screen after latest update',
  },
  // Cluster 3 — Dashboard load time regression (94 items)
  {
    id: 'f008', source: 'Zendesk', date: '2026-03-10', status: 'analyzed',
    title: 'Dashboard load jumped from 2s to 12s after v2.4',
    content: 'We measured load times before and after the update. Dashboard went from ~2 seconds to 10-14 seconds. Checked network - not the issue. Backend response times are fine. Something changed in the frontend render cycle.',
    tags: ['performance', 'dashboard', 'load-time', 'v2.4', 'regression'], confidenceScore: 86,
    clusterId: 'c3', clusterName: 'Dashboard load time regression',
  },
  {
    id: 'f009', source: 'App Store', date: '2026-03-09', status: 'analyzed',
    title: 'App feels sluggish - dashboard takes forever',
    content: 'Everything felt snappy before. Now the main dashboard spins for 10+ seconds. The widgets seem to load one by one instead of all at once. Was parallel fetching removed?',
    tags: ['performance', 'dashboard', 'widgets', 'slow'], confidenceScore: 83,
    clusterId: 'c3', clusterName: 'Dashboard load time regression',
  },
  {
    id: 'f010', source: 'Zendesk', date: '2026-03-07', status: 'analyzed',
    title: 'Dashboard performance degradation - enterprise users blocked',
    content: 'Our enterprise workspace with 200+ active projects now takes 12-15 seconds to load the dashboard. This is blocking daily standups. Smaller workspaces seem fine - seems to scale badly with project count.',
    tags: ['performance', 'enterprise', 'scale', 'dashboard'], confidenceScore: 88,
    clusterId: 'c3', clusterName: 'Dashboard load time regression',
  },
  // Cluster 4 — No onboarding checklist (82 items)
  {
    id: 'f011', source: 'App Store', date: '2026-03-10', status: 'analyzed',
    title: 'No guidance when starting from scratch - very confusing',
    content: 'I signed up and had absolutely no idea where to start. There\'s no checklist, no welcome tour, nothing. I spent 20 minutes clicking around before finding the project creation flow. Competitors do this much better.',
    tags: ['onboarding', 'ux', 'new-user', 'checklist'], confidenceScore: 82,
    clusterId: 'c4', clusterName: 'No onboarding checklist for new users',
  },
  {
    id: 'f012', source: 'Zendesk', date: '2026-03-08', status: 'analyzed',
    title: 'New team members struggle to get started',
    content: 'Every time we add someone new to the team, they need a 30-minute walkthrough from an existing user. There\'s no onboarding flow, no "start here" checklist, and the docs are hard to find from inside the app.',
    tags: ['onboarding', 'team', 'new-user', 'documentation'], confidenceScore: 79,
    clusterId: 'c4', clusterName: 'No onboarding checklist for new users',
  },
  {
    id: 'f013', source: 'App Store', date: '2026-03-06', status: 'analyzed',
    title: 'Needs an interactive setup wizard',
    content: 'The app has a lot of power but zero hand-holding for new users. A simple 5-step checklist (create project, invite team, set up first workflow, add integration, run first report) would dramatically reduce the learning curve.',
    tags: ['onboarding', 'setup-wizard', 'feature-request', 'ux'], confidenceScore: 81,
    clusterId: 'c4', clusterName: 'No onboarding checklist for new users',
  },
  // Cluster 5 — Export to CSV silently fails (58 items)
  {
    id: 'f014', source: 'Zendesk', date: '2026-03-10', status: 'analyzed',
    title: 'CSV export says success but file is empty',
    content: 'Exporting any dataset to CSV shows a success toast but the downloaded file is 0 bytes. Tried on Chrome, Safari, and Firefox. Same result. This is blocking our weekly reporting process completely.',
    tags: ['export', 'csv', 'bug', 'reporting'], confidenceScore: 78,
    clusterId: 'c5', clusterName: 'Export to CSV silently fails',
  },
  {
    id: 'f015', source: 'App Store', date: '2026-03-09', status: 'analyzed',
    title: 'Export broken - no error shown',
    content: 'The export button does nothing visible. No download, no error. The loading spinner appears for a second and then nothing. Checked downloads folder - no file. This silently fails and it\'s very frustrating.',
    tags: ['export', 'csv', 'silent-failure', 'ux'], confidenceScore: 75,
    clusterId: 'c5', clusterName: 'Export to CSV silently fails',
  },
  {
    id: 'f016', source: 'Zendesk', date: '2026-03-07', status: 'analyzed',
    title: 'Data export pipeline completely broken for large datasets',
    content: 'Export works for small datasets (<100 rows) but silently fails for anything larger. We need to export 5,000+ rows weekly. No error message, no email, nothing. The job must be timing out server-side with no fallback.',
    tags: ['export', 'csv', 'large-dataset', 'timeout'], confidenceScore: 77,
    clusterId: 'c5', clusterName: 'Export to CSV silently fails',
  },
  // Cluster 6 — Notification delay on mobile (37 items)
  {
    id: 'f017', source: 'App Store', date: '2026-03-09', status: 'analyzed',
    title: 'Push notifications arrive 30 minutes late',
    content: 'I get notified about comments and mentions 20-40 minutes after they happen. By then the conversation has moved on. The email notifications are instant but push is severely delayed. On iOS.',
    tags: ['notifications', 'push', 'delay', 'ios', 'mobile'], confidenceScore: 73,
    clusterId: 'c6', clusterName: 'Notification delay on mobile',
  },
  {
    id: 'f018', source: 'Zendesk', date: '2026-03-08', status: 'analyzed',
    title: 'Mobile notification latency - team coordination impacted',
    content: 'Our team relies on mobile push for urgent task assignments. Notifications are arriving 15-45 minutes late on both iOS and Android. We\'ve checked device settings - push is enabled and background refresh is on.',
    tags: ['notifications', 'push', 'android', 'ios', 'latency'], confidenceScore: 71,
    clusterId: 'c6', clusterName: 'Notification delay on mobile',
  },
  // New / unprocessed items (no cluster yet)
  {
    id: 'f019', source: 'App Store', date: '2026-03-11', status: 'new',
    title: 'Dark mode colors are off in the new update',
    content: 'Several UI elements have incorrect contrast in dark mode after the latest update. The sidebar text is nearly invisible and some buttons have white text on light grey backgrounds.',
    tags: ['dark-mode', 'accessibility', 'ui', 'contrast'], confidenceScore: 61,
  },
  {
    id: 'f020', source: 'Zendesk', date: '2026-03-11', status: 'new',
    title: 'API rate limit errors hitting production',
    content: 'Our integration is hitting 429 errors more frequently since March 9. We haven\'t changed our request volume. Either the rate limits were lowered or something is counting requests differently now.',
    tags: ['api', 'rate-limit', 'integration', '429'], confidenceScore: 58,
  },
  {
    id: 'f021', source: 'App Store', date: '2026-03-11', status: 'processing',
    title: 'Search returns no results for exact matches',
    content: 'Searching for a project name I know exists returns zero results. The search worked fine two weeks ago. Tried clearing cache, reinstalling - no change. Feels like the search index is stale.',
    tags: ['search', 'bug', 'indexing'], confidenceScore: 64,
  },
  {
    id: 'f022', source: 'Zendesk', date: '2026-03-10', status: 'processing',
    title: 'SSO login loop affecting enterprise users',
    content: 'Enterprise users on our SAML SSO configuration are getting stuck in an auth loop after session expiry. They are redirected to the IdP, authenticate, then redirected back to the login screen again.',
    tags: ['sso', 'auth', 'enterprise', 'saml', 'loop'], confidenceScore: 66,
  },
  {
    id: 'f023', source: 'App Store', date: '2026-03-05', status: 'archived',
    title: 'Occasional sync delay - resolved in 2.3.1',
    content: 'Sync would sometimes lag by a few seconds when multiple users edited simultaneously. Was fixed in the 2.3.1 patch, no longer experiencing this.',
    tags: ['sync', 'resolved', 'multi-user'], confidenceScore: 55,
  },
  {
    id: 'f024', source: 'Zendesk', date: '2026-03-04', status: 'archived',
    title: 'Calendar integration not loading - fixed',
    content: 'Google Calendar integration was failing to load events for dates beyond 90 days. This was resolved by the team on March 5 - confirmed working now.',
    tags: ['calendar', 'google', 'integration', 'resolved'], confidenceScore: 52,
  },
]

const ALL_SOURCES: FeedbackSource[] = ['App Store', 'Zendesk']
const ALL_STATUSES: FeedbackStatus[] = ['new', 'processing', 'analyzed', 'archived']

const CLUSTER_MAP: Record<string, string> = {
  c1: 'App crashes on project switch',
  c2: 'Black screen after latest update',
  c3: 'Dashboard load time regression',
  c4: 'No onboarding checklist for new users',
  c5: 'Export to CSV silently fails',
  c6: 'Notification delay on mobile',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const color =
    score >= 85 ? 'from-green-500 to-emerald-500' :
    score >= 70 ? 'from-blue-500 to-violet-500'   :
    score >= 50 ? 'from-orange-500 to-amber-500'  :
                  'from-red-500 to-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className={`h-full bg-gradient-to-r ${color} rounded-full`}
        />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}%</span>
    </div>
  )
}

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const config = {
    new:        { label: 'New',        icon: AlertCircle,   className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
    processing: { label: 'Processing', icon: RefreshCw,     className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
    analyzed:   { label: 'Analyzed',   icon: CheckCircle2,  className: 'bg-green-500/10 text-green-600 dark:text-green-400' },
    archived:   { label: 'Archived',   icon: Archive,       className: 'bg-muted text-muted-foreground' },
  }
  const { label, icon: Icon, className } = config[status]
  return (
    <Badge className={cn('text-[10px] font-medium flex items-center gap-1', className)}>
      <Icon className="w-2.5 h-2.5" />{label}
    </Badge>
  )
}

function FeedbackCard({
  item, isSelected, onSelect, onClick,
}: {
  item: FeedbackItem; isSelected: boolean; onSelect: () => void; onClick: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      whileHover={{ y: -2 }}
      className={cn(
        'p-4 bg-card border border-border rounded-xl cursor-pointer transition-all',
        isSelected && 'ring-2 ring-violet-500 ring-offset-2 ring-offset-background',
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect() }}
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors',
              isSelected ? 'bg-violet-600 border-violet-600 text-white' : 'border-muted-foreground/30 hover:border-violet-500',
            )}
          >
            {isSelected && <Check className="w-3 h-3" />}
          </button>
          <div>
            <h3 className="font-medium text-foreground text-sm leading-snug">{item.title}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{item.source}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-xs text-muted-foreground">{item.date}</span>
            </div>
          </div>
        </div>
        <StatusBadge status={item.status} />
      </div>

      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{item.content}</p>

      {item.clusterName && (
        <div className="flex items-center gap-1.5 mb-3">
          <Layers className="w-3 h-3 text-violet-500 flex-shrink-0" />
          <span className="text-xs text-violet-600 dark:text-violet-400 truncate">{item.clusterName}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {item.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] font-normal">{tag}</Badge>
          ))}
          {item.tags.length > 3 && (
            <Badge variant="secondary" className="text-[10px] font-normal">+{item.tags.length - 3}</Badge>
          )}
        </div>
        <ConfidenceBar score={item.confidenceScore} />
      </div>
    </motion.div>
  )
}

function FeedbackDetailSlideOver({
  item, isOpen, onClose, onArchive, onLinkEvidence,
}: {
  item: FeedbackItem | null
  isOpen: boolean
  onClose: () => void
  onArchive: (id: string) => void
  onLinkEvidence: (id: string) => void
}) {
  if (!item) return null
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border shadow-xl z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background/80 backdrop-blur-xl border-b border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusBadge status={item.status} />
                <span className="text-sm text-muted-foreground">{item.source}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-6 space-y-6">
              {/* Title + meta */}
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-2">{item.title}</h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />{item.date}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" />{item.source}
                  </span>
                </div>
              </div>

              {/* Cluster badge */}
              {item.clusterName && (
                <div className="flex items-center gap-2 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                  <Layers className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-0.5">Evidence Cluster</p>
                    <p className="text-sm font-medium text-foreground">{item.clusterName}</p>
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Feedback Content</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
              </div>

              {/* Confidence */}
              <div className="p-4 bg-gradient-to-br from-blue-500/5 to-violet-500/5 rounded-xl border border-border">
                <h3 className="text-sm font-medium text-foreground mb-3">Confidence Analysis</h3>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Cluster confidence score</span>
                  <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                    {item.confidenceScore}%
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.confidenceScore}%` }}
                    transition={{ duration: 0.8 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {item.confidenceScore >= 60
                    ? 'Above acceptance threshold (≥ 0.60) — promoted to evidence'
                    : 'Below threshold — held in staging for review'}
                </p>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />{tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-border">
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                  disabled={!!item.clusterId}
                  onClick={() => { onLinkEvidence(item.id); onClose() }}
                >
                  <Layers className="w-4 h-4 mr-2" />
                  {item.clusterId ? 'Linked to Cluster' : 'Link to Evidence'}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 bg-transparent"
                  disabled={item.status === 'archived'}
                  onClick={() => { onArchive(item.id); onClose() }}
                >
                  <Archive className="w-4 h-4 mr-2" />
                  {item.status === 'archived' ? 'Archived' : 'Archive'}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Add Feedback Modal ────────────────────────────────────────────────────────
function AddFeedbackModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean; onClose: () => void; onAdd: (item: FeedbackItem) => void
}) {
  const [title, setTitle]     = useState('')
  const [content, setContent] = useState('')
  const [source, setSource]   = useState<FeedbackSource>('App Store')

  const handleSubmit = () => {
    if (!title.trim() || !content.trim()) return
    const newItem: FeedbackItem = {
      id: `f${Date.now()}`,
      title: title.trim(),
      content: content.trim(),
      source,
      date: new Date().toISOString().split('T')[0],
      status: 'new',
      tags: ['manual-entry'],
      confidenceScore: 0,
    }
    onAdd(newItem)
    setTitle(''); setContent('')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50" onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl z-50 p-6"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-foreground">Add Feedback</h2>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Source</label>
                <div className="flex gap-2">
                  {ALL_SOURCES.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setSource(s)}
                      className={cn(
                        'flex-1 py-2 px-3 rounded-lg border text-sm font-medium transition-colors',
                        source === s
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'border-border text-muted-foreground hover:border-violet-400',
                      )}
                    >{s}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Title</label>
                <Input
                  placeholder="Brief summary of the feedback..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Content</label>
                <textarea
                  rows={4}
                  placeholder="Full feedback text..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-violet-500 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>Cancel</Button>
                <Button
                  className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                  onClick={handleSubmit}
                  disabled={!title.trim() || !content.trim()}
                >
                  Add Feedback
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Live Cluster Card ────────────────────────────────────────────────────────
function LiveClusterCard({
  cluster,
  onViewRaw,
}: {
  cluster: EvidenceItem
  onViewRaw: (id: string, theme: string, count: number) => void
}) {
  const conf = cluster.confidence ?? cluster.confidence_score ?? 0
  const confColor =
    conf >= 0.8 ? 'text-emerald-400' :
    conf >= 0.6 ? 'text-amber-400' : 'text-red-400'
  const confBg =
    conf >= 0.8 ? 'bg-emerald-500/10 border-emerald-500/20' :
    conf >= 0.6 ? 'bg-amber-500/10 border-amber-500/20' : 'bg-red-500/10 border-red-500/20'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="p-4 bg-card border border-border rounded-xl"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Layers className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full border', confBg, confColor)}>
            {Math.round(conf * 100)}% conf.
          </span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Hash className="w-3 h-3" />
          {cluster.feedback_item_count ?? 0} items
        </span>
      </div>

      <h3 className="font-medium text-foreground text-sm leading-snug mb-2">{cluster.theme}</h3>

      {cluster.keywords && cluster.keywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cluster.keywords.slice(0, 4).map((kw: string) => (
            <Badge key={kw} variant="secondary" className="text-[10px] font-normal">{kw}</Badge>
          ))}
          {cluster.keywords.length > 4 && (
            <Badge variant="secondary" className="text-[10px] font-normal">+{cluster.keywords.length - 4}</Badge>
          )}
        </div>
      )}

      {cluster.source_distribution && Object.keys(cluster.source_distribution).length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3 h-3 text-muted-foreground" />
          {Object.entries(cluster.source_distribution).map(([src, n]) => (
            <span key={src} className="text-xs text-muted-foreground">
              {src}: <span className="text-foreground font-medium">{String(n)}</span>
            </span>
          ))}
        </div>
      )}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-full bg-transparent text-xs"
        onClick={() => onViewRaw(cluster.id, cluster.theme, cluster.feedback_item_count ?? 0)}
      >
        <ExternalLink className="w-3 h-3 mr-1.5" />
        View Raw Items
      </Button>
    </motion.div>
  )
}

// ─── CSV helpers ──────────────────────────────────────────────────────────────
function downloadCSV(filename: string, rows: string[][], headers: string[]) {
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DataStudio() {
  const { searchQuery } = useApp()
  const { isLive } = useDataMode()

  // Live mode state
  const [liveClusters, setLiveClusters]   = useState<EvidenceItem[]>([])
  const [liveLoading, setLiveLoading]     = useState(false)
  const [liveError, setLiveError]         = useState<string | null>(null)
  const [panelOpen, setPanelOpen]         = useState(false)
  const [panelCluster, setPanelCluster]   = useState<{ id: string; theme: string; count: number } | null>(null)

  useEffect(() => {
    if (!isLive) return
    setLiveLoading(true); setLiveError(null)
    getEvidence()
      .then((data) => setLiveClusters(data))
      .catch((e) => setLiveError(e instanceof Error ? e.message : 'Failed to load clusters'))
      .finally(() => setLiveLoading(false))
  }, [isLive])

  const openPanel = (id: string, theme: string, count: number) => {
    setPanelCluster({ id, theme, count })
    setPanelOpen(true)
  }

  const handleExportLiveCSV = () => {
    downloadCSV('veloquity_clusters.csv',
      liveClusters.map((c) => [
        c.id, c.theme,
        String(Math.round((c.confidence ?? c.confidence_score ?? 0) * 100)),
        String(c.feedback_item_count ?? 0),
        (c.keywords ?? []).join('; '),
      ]),
      ['ID', 'Theme', 'Confidence (%)', 'Feedback Items', 'Keywords'],
    )
  }

  // Demo mode state
  const [localSearch, setLocalSearch]       = useState('')
  const [selectedSources, setSelectedSources] = useState<FeedbackSource[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<FeedbackStatus[]>([])
  const [selectedItems, setSelectedItems]   = useState<string[]>([])
  const [activeItem, setActiveItem]         = useState<FeedbackItem | null>(null)
  const [showAddModal, setShowAddModal]     = useState(false)
  const [feedbackList, setFeedbackList]     = useState<FeedbackItem[]>(MOCK_FEEDBACK)

  const effectiveSearch = searchQuery || localSearch

  const filteredFeedback = useMemo(() => {
    return feedbackList.filter((item) => {
      const matchesSearch =
        !effectiveSearch ||
        item.title.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        item.content.toLowerCase().includes(effectiveSearch.toLowerCase()) ||
        item.tags.some((t) => t.toLowerCase().includes(effectiveSearch.toLowerCase()))
      const matchesSource  = selectedSources.length === 0  || selectedSources.includes(item.source)
      const matchesStatus  = selectedStatuses.length === 0 || selectedStatuses.includes(item.status)
      return matchesSearch && matchesSource && matchesStatus
    })
  }, [effectiveSearch, selectedSources, selectedStatuses, feedbackList])

  const handleExportDemoCSV = () => {
    downloadCSV('veloquity_feedback.csv',
      filteredFeedback.map((f) => [f.id, f.source, f.date, f.status, String(f.confidenceScore), f.title, f.content, f.tags.join('; ')]),
      ['ID', 'Source', 'Date', 'Status', 'Confidence (%)', 'Title', 'Content', 'Tags'],
    )
  }

  const toggleSource = (s: FeedbackSource) =>
    setSelectedSources((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])

  const toggleStatus = (s: FeedbackStatus) =>
    setSelectedStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])

  const toggleItemSelection = (id: string) =>
    setSelectedItems((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id])

  const handleArchiveSelected = () => {
    setFeedbackList((prev) =>
      prev.map((item) =>
        selectedItems.includes(item.id) ? { ...item, status: 'archived' as FeedbackStatus } : item,
      ),
    )
    setSelectedItems([])
  }

  const handleArchiveSingle = (id: string) => {
    setFeedbackList((prev) =>
      prev.map((item) => item.id === id ? { ...item, status: 'archived' as FeedbackStatus } : item),
    )
  }

  const handleLinkEvidence = (id: string) => {
    // In production this fires the Evidence Intelligence agent via API
    // For MVP: mark as analyzed and assign to nearest unlinked cluster
    setFeedbackList((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: 'analyzed' as FeedbackStatus, clusterId: 'c1', clusterName: CLUSTER_MAP['c1'] }
          : item,
      ),
    )
  }

  const handleAddFeedback = (item: FeedbackItem) => {
    setFeedbackList((prev) => [item, ...prev])
  }

  // Stats for header pills
  const analyzedCount = feedbackList.filter((f) => f.status === 'analyzed').length
  const newCount      = feedbackList.filter((f) => f.status === 'new').length

  return (
    <div className="p-6">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Data Studio</h1>
            {isLive && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                <Wifi className="w-3 h-3" />
                Live
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {isLive ? 'Evidence clusters from your live data' : 'Manage and analyze feedback from all sources'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 bg-transparent"
              onClick={handleExportLiveCSV}
              disabled={liveClusters.length === 0}
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={handleExportDemoCSV}
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                type="button"
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-2" />New Feedback
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ── Quick-stat pills ───────────────────────────────────────────────── */}
      {isLive ? (
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: `${liveClusters.length} Clusters`, color: 'bg-muted text-foreground' },
            { label: `${liveClusters.filter((c) => (c.confidence ?? c.confidence_score ?? 0) >= 0.8).length} High Confidence`, color: 'bg-green-500/10 text-green-600' },
            { label: `${liveClusters.reduce((s, c) => s + (c.feedback_item_count ?? 0), 0)} Total Items`, color: 'bg-violet-500/10 text-violet-600' },
          ].map(({ label, color }) => (
            <span key={label} className={cn('px-3 py-1 rounded-full text-xs font-medium', color)}>{label}</span>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { label: `${feedbackList.length} Total`,   color: 'bg-muted text-foreground' },
            { label: `${analyzedCount} Analyzed`,      color: 'bg-green-500/10 text-green-600' },
            { label: `${newCount} New`,                color: 'bg-blue-500/10 text-blue-600' },
            { label: `6 Evidence Clusters`,            color: 'bg-violet-500/10 text-violet-600' },
          ].map(({ label, color }) => (
            <span key={label} className={cn('px-3 py-1 rounded-full text-xs font-medium', color)}>{label}</span>
          ))}
        </div>
      )}

      {/* ── Search + Filters (demo only) ──────────────────────────────────── */}
      {!isLive && <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, content, or tag..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          {/* Source filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Filter className="w-4 h-4" />
                Source
                {selectedSources.length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">
                    {selectedSources.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {ALL_SOURCES.map((source) => (
                <DropdownMenuItem key={source} onClick={() => toggleSource(source)}>
                  <div className="flex items-center gap-2 w-full">
                    <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                      selectedSources.includes(source) ? 'bg-violet-600 border-violet-600 text-white' : 'border-muted-foreground/30',
                    )}>
                      {selectedSources.includes(source) && <Check className="w-3 h-3" />}
                    </div>
                    <span>{source}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedSources([])}>Clear</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 bg-transparent">
                <Clock className="w-4 h-4" />
                Status
                {selectedStatuses.length > 0 && (
                  <span className="ml-1 w-4 h-4 rounded-full bg-violet-600 text-white text-[10px] flex items-center justify-center">
                    {selectedStatuses.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {ALL_STATUSES.map((status) => (
                <DropdownMenuItem key={status} onClick={() => toggleStatus(status)}>
                  <div className="flex items-center gap-2 w-full">
                    <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
                      selectedStatuses.includes(status) ? 'bg-violet-600 border-violet-600 text-white' : 'border-muted-foreground/30',
                    )}>
                      {selectedStatuses.includes(status) && <Check className="w-3 h-3" />}
                    </div>
                    <span className="capitalize">{status}</span>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setSelectedStatuses([])}>Clear</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear all filters */}
          {(selectedSources.length > 0 || selectedStatuses.length > 0 || localSearch) && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setSelectedSources([]); setSelectedStatuses([]); setLocalSearch('') }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>}

      {/* ── Bulk action bar (demo only) ────────────────────────────────────── */}
      {!isLive && <AnimatePresence>
        {selectedItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-4 p-3 mb-4 bg-violet-500/10 rounded-lg border border-violet-500/20"
          >
            <span className="text-sm font-medium text-foreground">{selectedItems.length} selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                selectedItems.forEach(handleLinkEvidence)
                setSelectedItems([])
              }}>
                <Layers className="w-3.5 h-3.5 mr-1.5" />Link to Evidence
              </Button>
              <Button size="sm" variant="outline" onClick={handleArchiveSelected}>
                <Archive className="w-3.5 h-3.5 mr-1.5" />Archive
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedItems([])}>
                <X className="w-3.5 h-3.5 mr-1" />Clear
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>}

      {isLive ? (
        /* ── Live cluster grid ──────────────────────────────────────────────── */
        <>
          {liveLoading && (
            <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading clusters…</span>
            </div>
          )}
          {liveError && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {liveError}
              <Button type="button" size="sm" variant="ghost" className="ml-auto text-red-400" onClick={() => {
                setLiveLoading(true); setLiveError(null)
                getEvidence().then(setLiveClusters).catch((e) => setLiveError(e instanceof Error ? e.message : 'Error')).finally(() => setLiveLoading(false))
              }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Retry
              </Button>
            </div>
          )}
          {!liveLoading && !liveError && liveClusters.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Layers className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">No clusters yet</h3>
              <p className="text-sm text-muted-foreground">Run the ingestion pipeline to generate evidence clusters</p>
            </div>
          )}
          {!liveLoading && liveClusters.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground mb-4">{liveClusters.length} evidence clusters</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {liveClusters.map((cluster) => (
                    <LiveClusterCard
                      key={cluster.id}
                      cluster={cluster}
                      onViewRaw={openPanel}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
          <EvidenceItemsPanel
            isOpen={panelOpen}
            onClose={() => setPanelOpen(false)}
            clusterId={panelCluster?.id ?? null}
            clusterTheme={panelCluster?.theme ?? ''}
            totalItems={panelCluster?.count ?? 0}
          />
        </>
      ) : (
        /* ── Demo feedback grid ─────────────────────────────────────────────── */
        <>
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filteredFeedback.length} of {feedbackList.length} items
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredFeedback.map((item) => (
                <FeedbackCard
                  key={item.id}
                  item={item}
                  isSelected={selectedItems.includes(item.id)}
                  onSelect={() => toggleItemSelection(item.id)}
                  onClick={() => setActiveItem(item)}
                />
              ))}
            </AnimatePresence>
          </div>
          {filteredFeedback.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Search className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-foreground mb-2">No feedback found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
            </div>
          )}
          <FeedbackDetailSlideOver
            item={activeItem}
            isOpen={!!activeItem}
            onClose={() => setActiveItem(null)}
            onArchive={handleArchiveSingle}
            onLinkEvidence={handleLinkEvidence}
          />
          <AddFeedbackModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            onAdd={handleAddFeedback}
          />
        </>
      )}
    </div>
  )
}
