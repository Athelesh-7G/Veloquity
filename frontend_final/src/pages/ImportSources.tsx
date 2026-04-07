import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  CheckCircle2, Upload, Smartphone, Ticket, Download, AlertTriangle,
  Info, X, FileText, Loader2, Hospital, ClipboardList
} from 'lucide-react'
import {
  getUploadedSources, addUploadedSource, removeUploadedSource,
  type UploadedSource,
} from '@/utils/uploadState'
import { setAgentsDone, clearAgentRunState } from '@/utils/agentRunState'

// ─── Phase definitions ────────────────────────────────────────────────────────
interface Phase {
  label: (rows: number) => string
  startAt: number
  targetProgress: number
}

const PHASES: Phase[] = [
  { label: () => 'Reading source file…',                 startAt: 0,     targetProgress: 10  },
  { label: () => 'Running ingestion pipeline…',          startAt: 2000,  targetProgress: 35  },
  { label: () => 'Computing embeddings and clustering…', startAt: 6000,  targetProgress: 70  },
  { label: () => 'Generating evidence insights…',        startAt: 10000, targetProgress: 90  },
  { label: () => 'Finalizing intelligence report…',      startAt: 13000, targetProgress: 100 },
]
const CONNECT_TOTAL_MS = 16000

type SourceId = 'appstore' | 'zendesk' | 'patient_portal' | 'hospital_survey_ticket'

function cleanFilename(name: string): string {
  return name.replace(/[_-]?sample[_-]?/gi, '')
}

// ─── Status Banner ─────────────────────────────────────────────────────────────
function StatusBanner({ appCount, hospitalCount }: { appCount: number; hospitalCount: number }) {
  const total = appCount + hospitalCount
  if (total === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Upload your feedback data to unlock insights across all pages
        </p>
      </div>
    )
  }
  if (appCount > 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/8">
        <Info className="w-5 h-5 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-600 dark:text-blue-400">
          {appCount === 2
            ? 'App Product Complaints active — all insights unlocked'
            : `App Product Complaints active — ${appCount} of 2 sources connected`}
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/8">
      <Info className="w-5 h-5 text-blue-500 shrink-0" />
      <p className="text-sm text-blue-600 dark:text-blue-400">
        {hospitalCount === 2
          ? 'Patient Hospital Survey active — all insights unlocked'
          : `Patient Hospital Survey active — ${hospitalCount} of 2 sources connected`}
      </p>
    </div>
  )
}

// ─── Source Card ───────────────────────────────────────────────────────────────
interface SourceCardProps {
  id: SourceId
  label: string
  description: string
  Icon: React.ElementType
  connected: UploadedSource | null
  blockedMessage?: string
  onConnect: (source: SourceId, filename: string, rowCount: number) => void
  onDisconnect: (source: SourceId) => void
}

function SourceCard({
  id, label, description, Icon, connected, blockedMessage, onConnect, onDisconnect,
}: SourceCardProps) {
  const [dragging, setDragging]         = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [connecting, setConnecting]     = useState(false)
  const [phaseLabel, setPhaseLabel]     = useState('')
  const [progress, setProgress]         = useState(0)

  const timersRef  = useRef<ReturnType<typeof setTimeout>[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [])

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) return
    setSelectedFile(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function animateProgressTo(target: number) {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= target) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return target
        }
        return Math.min(prev + 1, target)
      })
    }, 60)
  }

  function handleConnect() {
    if (!selectedFile || connecting) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(l => l.trim().length > 0)
      const rowCount = Math.max(0, lines.length - 1)
      const filename = selectedFile.name

      setConnecting(true)
      setProgress(0)

      PHASES.forEach((phase) => {
        const t = setTimeout(() => {
          setPhaseLabel(phase.label(rowCount))
          animateProgressTo(phase.targetProgress)
        }, phase.startAt)
        timersRef.current.push(t)
      })

      const done = setTimeout(() => {
        setConnecting(false)
        setSelectedFile(null)
        setPhaseLabel('')
        setProgress(0)
        onConnect(id, filename, rowCount)
      }, CONNECT_TOTAL_MS)
      timersRef.current.push(done)
    }
    reader.readAsText(selectedFile)
  }

  function handleDisconnect() {
    onDisconnect(id)
    setSelectedFile(null)
    setProgress(0)
    setPhaseLabel('')
    setConnecting(false)
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/10 to-violet-500/10">
            <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{label}</CardTitle>
              {connected && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />Connected
                </Badge>
              )}
            </div>
            <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        {connected ? (
          <div className="space-y-3">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">{cleanFilename(connected.filename)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {connected.rowCount.toLocaleString()} feedback items connected · uploaded {new Date(connected.uploadedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full bg-transparent text-red-500 hover:text-red-600 hover:border-red-500/50 hover:bg-red-500/5"
              onClick={handleDisconnect}
            >
              <X className="w-3.5 h-3.5 mr-1.5" />Disconnect
            </Button>
          </div>
        ) : blockedMessage ? (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-600 dark:text-amber-400 leading-relaxed">{blockedMessage}</p>
          </div>
        ) : connecting ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-violet-500 shrink-0" />
              <p className="text-sm text-foreground font-medium">{phaseLabel}</p>
            </div>
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                dragging
                  ? 'border-violet-500 bg-violet-500/8'
                  : selectedFile
                  ? 'border-violet-500/50 bg-violet-500/5'
                  : 'border-border hover:border-violet-500/50 hover:bg-violet-500/5'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-5 h-5 text-violet-500 shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{cleanFilename(selectedFile.name)}</span>
                </div>
              ) : (
                <>
                  <Upload className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drop a <span className="font-medium text-foreground">.csv</span> file here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              aria-label={`Upload ${label} CSV file`}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white"
              disabled={!selectedFile}
              onClick={handleConnect}
            >
              Connect Source
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImportSources() {
  const [sources, setSources] = useState<UploadedSource[]>(getUploadedSources)

  const appstoreSource        = sources.find(s => s.source === 'appstore')          ?? null
  const zendeskSource         = sources.find(s => s.source === 'zendesk')           ?? null
  const patientPortalSource   = sources.find(s => s.source === 'patient_portal')    ?? null
  const hospitalSurveySource  = sources.find(s => s.source === 'hospital_survey_ticket') ?? null

  const appCount      = sources.filter(s => s.dataset === 'app_product').length
  const hospitalCount = sources.filter(s => s.dataset === 'hospital_survey').length

  const appBlocked      = hospitalCount > 0 ? 'Disconnect Patient Hospital Survey sources first to switch datasets' : undefined
  const hospitalBlocked = appCount > 0 ? 'Disconnect App Product sources first to switch datasets' : undefined

  function handleConnect(source: SourceId, filename: string, rowCount: number) {
    const lower = filename.toLowerCase()
    const dataset: 'app_product' | 'hospital_survey' =
      lower.includes('patient') || lower.includes('hospital') ? 'hospital_survey' : 'app_product'

    const entry: UploadedSource = {
      source,
      filename,
      rowCount,
      uploadedAt: new Date().toISOString(),
      dataset,
    }
    addUploadedSource(entry)
    setAgentsDone(new Date().toISOString())
    setSources(getUploadedSources())
  }

  function handleDisconnect(source: SourceId) {
    removeUploadedSource(source)
    const remaining = getUploadedSources().filter(s => s.source !== source)
    if (remaining.length === 0) clearAgentRunState()
    setSources(getUploadedSources())
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Import Sources</h1>
        <p className="text-muted-foreground mt-1">
          Upload your feedback CSV files to unlock the intelligence pipeline
        </p>
      </div>

      {/* ── Status Banner ──────────────────────────────────────────────────── */}
      <StatusBanner appCount={appCount} hospitalCount={hospitalCount} />

      {/* ── Section 1: App Product Complaints ──────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">App Product Complaints</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <SourceCard
            id="appstore"
            label="App Store Reviews"
            description="Upload a CSV export of iOS/macOS App Store reviews"
            Icon={Smartphone}
            connected={appstoreSource}
            blockedMessage={appstoreSource ? undefined : appBlocked}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
          <SourceCard
            id="zendesk"
            label="Zendesk Tickets"
            description="Upload a CSV export of customer support tickets from Zendesk"
            Icon={Ticket}
            connected={zendeskSource}
            blockedMessage={zendeskSource ? undefined : appBlocked}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </div>

      {/* ── Section 2: Patient Hospital Survey ─────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Patient Hospital Survey</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <SourceCard
            id="patient_portal"
            label="Patient Portal Reviews"
            description="Upload a CSV export of patient portal app reviews"
            Icon={Hospital}
            connected={patientPortalSource}
            blockedMessage={patientPortalSource ? undefined : hospitalBlocked}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
          <SourceCard
            id="hospital_survey_ticket"
            label="Hospital Survey Tickets"
            description="Upload a CSV export of hospital patient satisfaction survey tickets"
            Icon={ClipboardList}
            connected={hospitalSurveySource}
            blockedMessage={hospitalSurveySource ? undefined : hospitalBlocked}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
          />
        </div>
      </div>

      {/* ── Download Sample Files ───────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="w-4 h-4 text-violet-600" />Download Sample Files
          </CardTitle>
          <CardDescription>
            Use these sample CSVs to try out the platform before connecting real data
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <a href="/samples/appstore_sample.csv" download>
            <Button variant="outline" className="bg-transparent gap-2">
              <Smartphone className="w-4 h-4" />
              Download App Store CSV
            </Button>
          </a>
          <a href="/samples/zendesk_sample.csv" download>
            <Button variant="outline" className="bg-transparent gap-2">
              <Ticket className="w-4 h-4" />
              Download Zendesk CSV
            </Button>
          </a>
          <a href="/samples/patient_portal_sample.csv" download>
            <Button variant="outline" className="bg-transparent gap-2">
              <Hospital className="w-4 h-4" />
              Download Patient Portal CSV
            </Button>
          </a>
          <a href="/samples/hospital_survey_sample.csv" download>
            <Button variant="outline" className="bg-transparent gap-2">
              <ClipboardList className="w-4 h-4" />
              Download Hospital Survey CSV
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
