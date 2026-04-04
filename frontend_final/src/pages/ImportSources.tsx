import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  FileUp, Database, MessageSquare, FileSpreadsheet,
  CheckCircle2, Clock, AlertCircle, Plus, RefreshCw, Settings, Trash2,
  Smartphone, Ticket, Webhook, Copy, Check, ChevronDown, ChevronUp,
  ShieldCheck, Layers, X, Download, Loader2, Play,
} from 'lucide-react'
import { type UploadResult, runAgent, uploadFeedback } from '@/api/client'
import {
  addUploadedSource,
  getUploadedSources,
  hasUploadedData,
  removeUploadedSource,
} from '@/utils/uploadState'

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
  { id: 'appstore',   name: 'App Store',     icon: Smartphone,     description: 'Import App Store reviews via Apple API' },
  { id: 'zendesk',    name: 'Zendesk',       icon: Ticket,         description: 'Sync support tickets and customer requests' },
  { id: 'intercom',   name: 'Intercom',      icon: MessageSquare,  description: 'Import customer conversations and feedback' },
  { id: 'csv',        name: 'CSV / XLSX',    icon: FileSpreadsheet, description: 'Upload spreadsheets with feedback data' },
  { id: 'api',        name: 'REST API',      icon: Database,       description: 'Connect via custom API integration' },
  { id: 'webhook',    name: 'Webhook',       icon: Webhook,        description: 'Receive real-time data via webhooks' },
]

// ─── Pipeline step config ─────────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { key: 'ingestion', label: 'Ingestion Agent',   msg: 'Normalising, deduplicating and writing to S3...' },
  { key: 'evidence',  label: 'Evidence Agent',    msg: 'Embedding and clustering feedback...' },
  { key: 'reasoning', label: 'Reasoning Agent',   msg: 'Scoring and ranking evidence...' },
] as const

type PipelineKey = typeof PIPELINE_STEPS[number]['key']
type StepState   = 'pending' | 'running' | 'done' | 'error'

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

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
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSync} disabled={syncing}>
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

            <div className="grid grid-cols-2 gap-3 mb-5">
              {AVAILABLE_SOURCES.map((src) => (
                <button
                  type="button"
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

// ─── CSV Upload Card ──────────────────────────────────────────────────────────
function UploadCard({
  sourceKey,
  label,
  icon: Icon,
  accent,
  onSuccess,
}: {
  sourceKey: 'appstore' | 'zendesk'
  label: string
  icon: React.ElementType
  accent: string
  onSuccess: (result: UploadResult, filename: string) => void
}) {
  const [file, setFile]           = useState<File | null>(null)
  const [dragging, setDragging]   = useState(false)
  const [phase, setPhase]         = useState<'idle' | 'uploading' | 'pipeline' | 'done' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)

  // Pipeline step tracking
  const [stepStates, setStepStates] = useState<Record<PipelineKey, StepState>>({
    ingestion: 'pending', evidence: 'pending', reasoning: 'pending',
  })
  const [stepStartedAt, setStepStartedAt] = useState<Record<PipelineKey, number>>({
    ingestion: 0, evidence: 0, reasoning: 0,
  })
  const [stepElapsed, setStepElapsed] = useState<Record<PipelineKey, number>>({
    ingestion: 0, evidence: 0, reasoning: 0,
  })
  const [, forceRender] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isRunning = phase === 'uploading' || phase === 'pipeline'

  function startTimer() {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => forceRender((n) => n + 1), 1000)
    }
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  function setStep(key: PipelineKey, state: StepState) {
    setStepStates((s) => ({ ...s, [key]: state }))
    if (state === 'running') {
      const now = Date.now()
      setStepStartedAt((s) => ({ ...s, [key]: now }))
    }
    if (state === 'done' || state === 'error') {
      setStepElapsed((prev) => ({
        ...prev,
        [key]: Math.round((Date.now() - stepStartedAt[key]) / 1000),
      }))
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.toLowerCase().endsWith('.csv')) setFile(f)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  function reset() {
    setFile(null); setPhase('idle'); setErrorText(''); setUploadResult(null)
    setStepStates({ ingestion: 'pending', evidence: 'pending', reasoning: 'pending' })
    setStepStartedAt({ ingestion: 0, evidence: 0, reasoning: 0 })
    setStepElapsed({ ingestion: 0, evidence: 0, reasoning: 0 })
    stopTimer()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleUpload() {
    if (!file || isRunning) return
    setPhase('uploading')
    setErrorText('')
    startTimer()

    let result: UploadResult
    try {
      result = await uploadFeedback(file, sourceKey)
      setUploadResult(result)
      onSuccess(result, file.name)
    } catch (err: unknown) {
      stopTimer()
      setPhase('error')
      setErrorText(err instanceof Error ? err.message : 'Upload failed')
      return
    }

    // ── Run pipeline: ingestion → evidence → reasoning ──────────────────────
    setPhase('pipeline')

    for (const step of PIPELINE_STEPS) {
      const key = step.key as PipelineKey
      setStep(key, 'running')
      try {
        await runAgent(key)
        setStep(key, 'done')
      } catch (err: unknown) {
        setStep(key, 'error')
        stopTimer()
        setPhase('error')
        setErrorText(
          `Pipeline failed at ${step.label}: ${err instanceof Error ? err.message : 'unknown error'}`
        )
        return
      }
    }

    stopTimer()
    setPhase('done')

    // Persist to localStorage after full pipeline success
    addUploadedSource({
      source: sourceKey,
      filename: file.name,
      itemCount: result.items_submitted,
      uploadedAt: new Date().toISOString(),
    })
  }

  const currentElapsed = (key: PipelineKey): number => {
    if (stepStates[key] === 'running' && stepStartedAt[key]) {
      return Math.max(0, Math.round((Date.now() - stepStartedAt[key]) / 1000))
    }
    return stepElapsed[key]
  }

  return (
    <div
      className={`rounded-2xl border flex flex-col gap-4 p-5 transition-all ${
        dragging ? 'border-violet-500 bg-violet-500/5' : 'border-border bg-card'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl shrink-0" style={{ background: `${accent}18` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-foreground">{label}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {sourceKey === 'appstore'
              ? 'Columns: review_id, rating, title, review, date, version, author'
              : 'Columns: ticket_id, subject, description, status, priority, created_at, requester'}
          </p>
        </div>
      </div>

      {/* Drop zone */}
      {phase === 'idle' && (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
            dragging
              ? 'border-violet-500 bg-violet-500/5'
              : 'border-border hover:border-violet-400 hover:bg-violet-500/5'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <FileUp className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
          {file ? (
            <p className="text-sm font-medium text-foreground">{file.name}</p>
          ) : (
            <>
              <p className="text-sm text-foreground font-medium">Drop CSV here</p>
              <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            aria-label={`Upload ${label} CSV file`}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Upload / pipeline progress */}
      {(phase === 'uploading' || phase === 'pipeline') && (
        <div className="space-y-3">
          {/* Upload step */}
          <div className="flex items-center gap-2 text-xs">
            {phase === 'uploading'
              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500 shrink-0" />
              : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
            <span className={phase === 'uploading' ? 'text-foreground' : 'text-emerald-500'}>
              {phase === 'uploading' ? 'Uploading...' : `${uploadResult?.items_submitted ?? 0} items uploaded`}
            </span>
          </div>

          {/* Pipeline steps */}
          {phase === 'pipeline' && PIPELINE_STEPS.map((step) => {
            const key = step.key as PipelineKey
            const ss = stepStates[key]
            const elapsed = currentElapsed(key)
            return (
              <div key={key} className="flex items-center gap-2 text-xs">
                {ss === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />}
                {ss === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500 shrink-0" />}
                {ss === 'done'    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {ss === 'error'   && <AlertCircle  className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                <span className={
                  ss === 'done'    ? 'text-emerald-500' :
                  ss === 'running' ? 'text-foreground'  :
                  ss === 'error'   ? 'text-red-500'     : 'text-muted-foreground'
                }>
                  {ss === 'running' ? step.msg : step.label}
                </span>
                {(ss === 'running' || ss === 'done') && elapsed > 0 && (
                  <span className="ml-auto tabular-nums text-muted-foreground">
                    {ss === 'done' ? `done in ${formatElapsed(elapsed)}` : formatElapsed(elapsed)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Done state */}
      {phase === 'done' && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 space-y-1">
          <div className="flex items-center gap-2 text-emerald-500 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {uploadResult?.items_submitted ?? 0} items submitted to pipeline successfully
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Pipeline complete. Visit Evidence Grid to see your results.
          </p>
        </div>
      )}

      {/* Error state */}
      {phase === 'error' && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-red-400 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="break-words">{errorText}</span>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-xs text-violet-500 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Upload button */}
      {(phase === 'idle' || phase === 'done') && (
        <Button
          onClick={phase === 'done' ? reset : handleUpload}
          disabled={phase === 'idle' && !file}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white disabled:opacity-40 rounded-xl"
        >
          {phase === 'done' ? (
            <span className="flex items-center gap-2"><Plus className="w-4 h-4" />Upload Another</span>
          ) : (
            <span className="flex items-center gap-2"><Play className="w-4 h-4" />Upload & Process</span>
          )}
        </Button>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImportSources() {
  const [sources, setSources]           = useState<ImportSource[]>(INITIAL_SOURCES)
  const [showAddModal, setShowAddModal] = useState(false)
  const [uploadedOnce, setUploadedOnce] = useState(() => hasUploadedData())

  // Restore persisted upload entries into the sources list on mount
  useEffect(() => {
    const persisted = getUploadedSources()
    if (persisted.length === 0) return
    setSources((prev) => {
      const existingIds = new Set(prev.map((s) => s.id))
      const restored: ImportSource[] = persisted
        .filter((u) => !existingIds.has(`upload-${u.source}`))
        .map((u) => ({
          id: `upload-${u.source}`,
          name: u.source === 'appstore'
            ? `CSV — App Store (${u.filename})`
            : `CSV — Zendesk (${u.filename})`,
          type: 'file' as SourceType,
          icon: FileSpreadsheet,
          status: 'connected' as SourceStatus,
          lastSync: new Date(u.uploadedAt).toLocaleString(),
          itemsImported: u.itemCount,
          piiRedacted: 0,
          deduped: 0,
          description: `Uploaded CSV: ${u.filename}`,
        }))
      return [...prev, ...restored]
    })
  }, [])

  const totalItems     = sources.reduce((s, src) => s + src.itemsImported, 0)
  const totalPii       = sources.reduce((s, src) => s + src.piiRedacted, 0)
  const totalDeduped   = sources.reduce((s, src) => s + src.deduped, 0)
  const connectedCount = sources.filter((s) => s.status === 'connected').length

  const handleSync = (id: string) => {
    setSources((prev) => prev.map((s) => s.id === id ? { ...s, lastSync: 'Just now' } : s))
  }

  const handleDelete = (id: string) => {
    // If it's a persisted CSV upload, remove it from localStorage too
    if (id.startsWith('upload-')) {
      const sourceType = id.replace('upload-', '')
      removeUploadedSource(sourceType)
      if (!hasUploadedData()) setUploadedOnce(false)
    }
    setSources((prev) => prev.filter((s) => s.id !== id))
  }

  const handleAdd = (source: ImportSource) => {
    setSources((prev) => [...prev, source])
  }

  const handleUploadSuccess = (result: UploadResult, filename: string, sourceKey: 'appstore' | 'zendesk') => {
    setUploadedOnce(true)
    setSources((prev) => {
      const exists = prev.find((s) => s.id === `upload-${sourceKey}`)
      if (exists) {
        return prev.map((s) =>
          s.id === `upload-${sourceKey}`
            ? { ...s, name: `CSV — ${sourceKey === 'appstore' ? 'App Store' : 'Zendesk'} (${filename})`, itemsImported: result.items_submitted, lastSync: 'Just now', status: 'connected' }
            : s
        )
      }
      return [...prev, {
        id: `upload-${sourceKey}`,
        name: sourceKey === 'appstore' ? `CSV — App Store (${filename})` : `CSV — Zendesk (${filename})`,
        type: 'file' as SourceType,
        icon: FileSpreadsheet,
        status: 'connected' as SourceStatus,
        lastSync: 'Just now',
        itemsImported: result.items_submitted,
        piiRedacted: 0,
        deduped: 0,
        description: `Uploaded CSV: ${filename}`,
      }]
    })
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

      {/* ── Demo data notice ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {!uploadedOnce && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5"
          >
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-500">
              No data uploaded yet — showing demo data across all pages. Upload your feedback files below to see real results.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pipeline summary pills ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Ingested',    value: totalItems.toLocaleString(), sub: 'across all sources',          color: 'from-blue-500/5 to-blue-500/10'    },
          { label: 'Sources Connected', value: connectedCount,              sub: `of ${sources.length} configured`, color: 'from-green-500/5 to-green-500/10'  },
          { label: 'PII Redacted',      value: totalPii,                    sub: 'regex patterns applied',       color: 'from-violet-500/5 to-violet-500/10' },
          { label: 'SHA-256 Deduped',   value: totalDeduped,                sub: 'duplicates suppressed',        color: 'from-orange-500/5 to-orange-500/10' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className={`p-4 rounded-xl border border-border bg-gradient-to-br ${color}`}>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── CSV Upload ──────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileUp className="w-5 h-5 text-violet-600" />Upload Feedback CSV
          </CardTitle>
          <CardDescription>
            Upload a CSV file to run the full evidence pipeline — ingestion, embedding, clustering, and reasoning.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <UploadCard
              sourceKey="appstore"
              label="App Store Reviews"
              icon={Smartphone}
              accent="#6366f1"
              onSuccess={(r, filename) => handleUploadSuccess(r, filename, 'appstore')}
            />
            <UploadCard
              sourceKey="zendesk"
              label="Zendesk Tickets"
              icon={Ticket}
              accent="#8b5cf6"
              onSuccess={(r, filename) => handleUploadSuccess(r, filename, 'zendesk')}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Download Sample Files ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5 text-violet-600" />Download Sample Files
          </CardTitle>
          <CardDescription>
            Use these sample CSVs to test the upload pipeline or as a template for your own data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <a href="/samples/appstore_sample.csv" download>
              <Button variant="outline" className="bg-transparent gap-2">
                <Smartphone className="w-4 h-4 text-indigo-500" />
                Download App Store Sample CSV
              </Button>
            </a>
            <a href="/samples/zendesk_sample.csv" download>
              <Button variant="outline" className="bg-transparent gap-2">
                <Ticket className="w-4 h-4 text-violet-500" />
                Download Zendesk Sample CSV
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            App Store: 20 rows · columns: review_id, rating, title, review, date, version, author
            <span className="mx-2">·</span>
            Zendesk: 20 rows · columns: ticket_id, subject, description, status, priority, created_at, requester
          </p>
        </CardContent>
      </Card>

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
              <Input id="api-key" value="vlq_sk_live_082228066878_xk9mTqPzWvNrLdYe" readOnly className="font-mono text-sm bg-muted" />
              <CopyButton value="vlq_sk_live_082228066878_xk9mTqPzWvNrLdYe" />
            </div>
            <p className="text-xs text-muted-foreground">
              Pass as <code className="bg-muted px-1 rounded text-xs">Authorization: Bearer &lt;key&gt;</code> header
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingestion-endpoint">Ingestion Endpoint</Label>
            <div className="flex gap-2">
              <Input id="ingestion-endpoint" value="https://api.veloquity.io/v1/ingest" readOnly className="font-mono text-sm bg-muted" />
              <CopyButton value="https://api.veloquity.io/v1/ingest" />
            </div>
            <p className="text-xs text-muted-foreground">
              POST JSON array of feedback items — triggers <code className="bg-muted px-1 rounded text-xs">veloquity-ingestion-dev</code> Lambda
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input id="webhook-url" value="https://api.veloquity.io/v1/webhooks/feedback" readOnly className="font-mono text-sm bg-muted" />
              <CopyButton value="https://api.veloquity.io/v1/webhooks/feedback" />
            </div>
            <p className="text-xs text-muted-foreground">
              EventBridge-triggered — fires daily at 06:00 UTC for batch ingestion
            </p>
          </div>

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
