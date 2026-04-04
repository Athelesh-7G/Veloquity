import type React from 'react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  FileUp, LinkIcon, Database, MessageSquare, Mail, FileSpreadsheet,
  CheckCircle2, Clock, AlertCircle, Plus, RefreshCw, Settings, Trash2,
  Smartphone, Ticket, Webhook, Copy, Check, ChevronDown, ChevronUp,
  ShieldCheck, Layers, X
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type SourceStatus = 'connected' | 'pending' | 'error'
type SourceType   = 'api' | 'file' | 'webhook'

interface ImportSource {
  id: string
  name: string
  type: SourceType
  icon: React.ElementType
  status: SourceStatus
  lastSync: string
  itemsImported: number
  piiRedacted: number
  deduped: number
  description: string
}

// ─── Veloquity-aligned connected sources (App Store 275 + Zendesk 272 = 547) ──
const INITIAL_SOURCES: ImportSource[] = [
  {
    id: 'appstore',
    name: 'App Store Reviews',
    type: 'api',
    icon: Smartphone,
    status: 'connected',
    lastSync: '2026-03-10 06:00 UTC',
    itemsImported: 275,
    piiRedacted: 18,
    deduped: 12,
    description: 'iOS & macOS App Store review ingestion via Lambda ingestion agent',
  },
  {
    id: 'zendesk',
    name: 'Zendesk Support Tickets',
    type: 'api',
    icon: Ticket,
    status: 'connected',
    lastSync: '2026-03-10 06:00 UTC',
    itemsImported: 272,
    piiRedacted: 31,
    deduped: 8,
    description: 'Customer support tickets synced via Zendesk API — PII redacted before S3 landing',
  },
  {
    id: 'webhook-salesforce',
    name: 'Salesforce Webhook',
    type: 'webhook',
    icon: Webhook,
    status: 'pending',
    lastSync: 'Awaiting first event',
    itemsImported: 0,
    piiRedacted: 0,
    deduped: 0,
    description: 'Real-time CRM feedback via webhook — pending endpoint verification',
  },
]

// ─── Available source types to add ───────────────────────────────────────────
const AVAILABLE_SOURCES = [
  { id: 'appstore',   name: 'App Store',     icon: Smartphone,    description: 'Import App Store reviews via Apple API' },
  { id: 'zendesk',    name: 'Zendesk',       icon: Ticket,        description: 'Sync support tickets and customer requests' },
  { id: 'intercom',   name: 'Intercom',      icon: MessageSquare, description: 'Import customer conversations and feedback' },
  { id: 'csv',        name: 'CSV / XLSX',    icon: FileSpreadsheet,description: 'Upload spreadsheets with feedback data' },
  { id: 'api',        name: 'REST API',      icon: Database,      description: 'Connect via custom API integration' },
  { id: 'webhook',    name: 'Webhook',       icon: LinkIcon,      description: 'Receive real-time data via webhooks' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SourceStatus }) {
  const map = {
    connected: { label: 'Connected', icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    pending:   { label: 'Pending',   icon: Clock,        cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    error:     { label: 'Error',     icon: AlertCircle,  cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  }
  const { label, icon: Icon, cls } = map[status]
  return (
    <Badge className={`${cls} border-0 flex items-center gap-1`}>
      <Icon className="w-3 h-3" />{label}
    </Badge>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="outline" onClick={handleCopy} className="shrink-0 bg-transparent w-20">
      {copied ? <><Check className="w-3.5 h-3.5 mr-1.5 text-green-500" />Copied</> : <><Copy className="w-3.5 h-3.5 mr-1.5" />Copy</>}
    </Button>
  )
}

function SourceRow({
  source, onSync, onDelete,
}: {
  source: ImportSource
  onSync: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [syncing, setSyncing]   = useState(false)

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => { setSyncing(false); onSync(source.id) }, 1800)
  }

  return (
    <motion.div layout className="border border-border rounded-xl overflow-hidden">
      {/* Main row */}
      <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10 shrink-0">
            <source.icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground text-sm">{source.name}</h3>
              <StatusBadge status={source.status} />
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">Last sync: {source.lastSync}</span>
              {source.itemsImported > 0 && (
                <span className="text-xs font-medium text-foreground">
                  {source.itemsImported.toLocaleString()} items
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="icon" className="h-8 w-8"
            onClick={handleSync} disabled={syncing}
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-violet-500' : ''}`} />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <Settings className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={() => onDelete(source.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setExpanded((p) => !p)}>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-border pt-4 grid sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3 text-sm text-muted-foreground mb-1">{source.description}</div>

              {/* Stats */}
              <div className="p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Items Ingested</p>
                <p className="text-xl font-bold text-foreground">{source.itemsImported.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-0.5">via Lambda ingestion agent</p>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  <p className="text-xs text-muted-foreground">PII Redacted</p>
                </div>
                <p className="text-xl font-bold text-foreground">{source.piiRedacted}</p>
                <p className="text-xs text-muted-foreground mt-0.5">regex patterns applied</p>
              </div>
              <div className="p-3 bg-muted/40 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <Layers className="w-3.5 h-3.5 text-violet-500" />
                  <p className="text-xs text-muted-foreground">SHA-256 Deduped</p>
                </div>
                <p className="text-xl font-bold text-foreground">{source.deduped}</p>
                <p className="text-xs text-muted-foreground mt-0.5">duplicates suppressed</p>
              </div>

              {/* S3 destination */}
              <div className="sm:col-span-3 flex items-center gap-2 p-3 bg-gradient-to-r from-blue-500/5 to-violet-500/5 border border-border rounded-lg">
                <Database className="w-4 h-4 text-violet-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">S3 Landing Zone</p>
                  <p className="text-xs font-mono text-foreground truncate">
                    s3://veloquity-raw-dev-082228066878/{source.id}/{'{'}year{'}'}/{'{'}month{'}'}/{'{'}day{'}'}/
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Add Source Modal ─────────────────────────────────────────────────────────
function AddSourceModal({ isOpen, onClose, onAdd }: {
  isOpen: boolean
  onClose: () => void
  onAdd: (source: ImportSource) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [name, setName]         = useState('')

  const handleAdd = () => {
    if (!selected || !name.trim()) return
    const template = AVAILABLE_SOURCES.find((s) => s.id === selected)!
    const newSource: ImportSource = {
      id: `${selected}-${Date.now()}`,
      name: name.trim(),
      type: ['csv'].includes(selected) ? 'file' : selected === 'webhook' ? 'webhook' : 'api',
      icon: template.icon,
      status: 'pending',
      lastSync: 'Awaiting first sync',
      itemsImported: 0,
      piiRedacted: 0,
      deduped: 0,
      description: template.description,
    }
    onAdd(newSource)
    setSelected(null); setName('')
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
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl z-50 p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Add Data Source</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Choose a source type to connect to Veloquity</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
            </div>

            {/* Source type grid */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {AVAILABLE_SOURCES.map((src) => (
                <button
                  key={src.id}
                  onClick={() => setSelected(src.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    selected === src.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-border hover:border-violet-400 hover:bg-violet-500/5'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 ${selected === src.id ? 'bg-violet-600' : 'bg-muted'}`}>
                    <src.icon className={`w-4 h-4 ${selected === src.id ? 'text-white' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{src.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{src.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
                <Label htmlFor="source-name" className="mb-1.5 block">Connection Name</Label>
                <Input
                  id="source-name"
                  placeholder={`e.g. ${AVAILABLE_SOURCES.find((s) => s.id === selected)?.name} Production`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </motion.div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 bg-transparent" onClick={onClose}>Cancel</Button>
              <Button
                className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                onClick={handleAdd}
                disabled={!selected || !name.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />Add Source
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImportSources() {
  const [sources, setSources]       = useState<ImportSource[]>(INITIAL_SOURCES)
  const [showAddModal, setShowAddModal] = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadDone, setUploadDone] = useState(false)

  const totalItems     = sources.reduce((s, src) => s + src.itemsImported, 0)
  const totalPii       = sources.reduce((s, src) => s + src.piiRedacted, 0)
  const totalDeduped   = sources.reduce((s, src) => s + src.deduped, 0)
  const connectedCount = sources.filter((s) => s.status === 'connected').length

  const handleSync = (id: string) => {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, lastSync: 'Just now' } : s))
  }

  const handleDelete = (id: string) => {
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  const handleAdd = (source: ImportSource) => {
    setSources((prev) => [...prev, source])
  }

  const handleFileUpload = () => {
    if (uploading) return
    setUploading(true); setUploadDone(false); setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setUploading(false); setUploadDone(true)
          // Add as a connected CSV source
          setSources((s) => [...s, {
            id: `csv-${Date.now()}`,
            name: 'CSV Upload',
            type: 'file',
            icon: FileSpreadsheet,
            status: 'connected',
            lastSync: 'Just now',
            itemsImported: Math.floor(Math.random() * 80) + 20,
            piiRedacted: Math.floor(Math.random() * 10),
            deduped: Math.floor(Math.random() * 5),
            description: 'Manually uploaded CSV feedback dataset',
          }])
          return 100
        }
        return prev + 8
      })
    }, 150)
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Import Sources</h1>
          <p className="text-muted-foreground mt-1">Connect and manage feedback data sources for the ingestion pipeline</p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />Add Source
        </Button>
      </div>

      {/* ── Pipeline summary pills ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Ingested',    value: totalItems.toLocaleString(), sub: 'across all sources',     color: 'from-blue-500/5 to-blue-500/10'    },
          { label: 'Sources Connected', value: connectedCount,              sub: `of ${sources.length} configured`, color: 'from-green-500/5 to-green-500/10'  },
          { label: 'PII Redacted',      value: totalPii,                    sub: 'regex patterns applied',  color: 'from-violet-500/5 to-violet-500/10' },
          { label: 'SHA-256 Deduped',   value: totalDeduped,                sub: 'duplicates suppressed',   color: 'from-orange-500/5 to-orange-500/10' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={`p-4 rounded-xl border border-border bg-gradient-to-br ${color}`}>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Connected Sources ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Sources</CardTitle>
          <CardDescription>
            Active ingestion pipelines — each normalizes, PII-redacts, and SHA-256 deduplicates before S3 landing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No sources connected. Add one to start ingesting feedback.</p>
            </div>
          ) : (
            sources.map((source) => (
              <SourceRow key={source.id} source={source} onSync={handleSync} onDelete={handleDelete} />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Quick Upload ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileUp className="w-5 h-5 text-violet-600" />Quick Upload
          </CardTitle>
          <CardDescription>
            Upload CSV, JSON, or XLSX — routed through the Lambda ingestion agent with PII redaction and SHA-256 dedup
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              uploading || uploadDone
                ? 'border-violet-500/40 bg-violet-500/5'
                : 'border-border hover:border-violet-500/50 hover:bg-violet-500/5'
            }`}
            onClick={handleFileUpload}
          >
            {uploading ? (
              <div className="space-y-4 max-w-xs mx-auto">
                <RefreshCw className="w-8 h-8 mx-auto text-violet-600 animate-spin" />
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground">
                  Normalizing → PII redaction → SHA-256 dedup → S3... {uploadProgress}%
                </p>
              </div>
            ) : uploadDone ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-green-500" />
                <p className="text-sm font-medium text-foreground">Upload complete — added to connected sources</p>
                <p className="text-xs text-muted-foreground">Click to upload another file</p>
              </div>
            ) : (
              <>
                <FileUp className="w-8 h-8 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">Supports CSV, JSON, XLSX — up to 10 MB</p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── API Configuration ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="w-5 h-5 text-violet-600" />API Configuration
          </CardTitle>
          <CardDescription>
            Use these credentials to push feedback programmatically to the Veloquity ingestion Lambda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <div className="flex gap-2">
              <Input
                id="api-key"
                value="vlq_sk_live_082228066878_xk9mTqPzWvNrLdYe"
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <CopyButton value="vlq_sk_live_082228066878_xk9mTqPzWvNrLdYe" />
            </div>
            <p className="text-xs text-muted-foreground">
              Pass as <code className="bg-muted px-1 rounded text-xs">Authorization: Bearer &lt;key&gt;</code> header
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingestion-endpoint">Ingestion Endpoint</Label>
            <div className="flex gap-2">
              <Input
                id="ingestion-endpoint"
                value="https://api.veloquity.io/v1/ingest"
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <CopyButton value="https://api.veloquity.io/v1/ingest" />
            </div>
            <p className="text-xs text-muted-foreground">
              POST JSON array of feedback items — triggers <code className="bg-muted px-1 rounded text-xs">veloquity-ingestion-dev</code> Lambda
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook-url"
                value="https://api.veloquity.io/v1/webhooks/feedback"
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <CopyButton value="https://api.veloquity.io/v1/webhooks/feedback" />
            </div>
            <p className="text-xs text-muted-foreground">
              EventBridge-triggered — fires daily at 06:00 UTC for batch ingestion
            </p>
          </div>

          {/* S3 bucket reference */}
          <div className="flex items-start gap-3 p-3 bg-gradient-to-r from-blue-500/5 to-violet-500/5 border border-border rounded-lg mt-2">
            <Database className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">S3 Raw Landing Bucket</p>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                s3://veloquity-raw-dev-082228066878/&lt;source&gt;/&lt;year&gt;/&lt;month&gt;/&lt;day&gt;/
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Hive-partitioned, append-only, lifecycle rules enabled
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Add Source Modal ────────────────────────────────────────────────── */}
      <AddSourceModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onAdd={handleAdd} />
    </div>
  )
}