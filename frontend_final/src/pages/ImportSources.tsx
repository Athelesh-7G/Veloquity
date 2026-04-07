import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, Upload, Smartphone, Ticket, Download, AlertTriangle,
  Info, X, FileText
} from 'lucide-react'
import {
  getUploadedSources, addUploadedSource, removeUploadedSource,
  hasSource, type UploadedSource,
} from '@/utils/uploadState'

// ─── Status Banner ─────────────────────────────────────────────────────────────
function StatusBanner({ count }: { count: number }) {
  if (count === 0) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Upload your feedback data to unlock insights across all pages
        </p>
      </div>
    )
  }
  if (count === 1) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-500/30 bg-blue-500/8">
        <Info className="w-5 h-5 text-blue-500 shrink-0" />
        <p className="text-sm text-blue-600 dark:text-blue-400">
          1 of 2 sources connected — upload the second source for full cross-source insights
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/8">
      <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
      <p className="text-sm text-emerald-600 dark:text-emerald-400">
        All sources connected — insights available across all pages
      </p>
    </div>
  )
}

// ─── Source Card ───────────────────────────────────────────────────────────────
interface SourceCardProps {
  id: 'appstore' | 'zendesk'
  label: string
  description: string
  Icon: React.ElementType
  connected: UploadedSource | null
  onConnect: (source: 'appstore' | 'zendesk', filename: string, rowCount: number) => void
  onDisconnect: (source: 'appstore' | 'zendesk') => void
}

function SourceCard({ id, label, description, Icon, connected, onConnect, onDisconnect }: SourceCardProps) {
  const [dragging, setDragging]     = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [success, setSuccess]       = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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

  function handleConnect() {
    if (!selectedFile) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').filter(l => l.trim().length > 0)
      const rowCount = Math.max(0, lines.length - 1) // subtract header
      onConnect(id, selectedFile.name, rowCount)
      setSuccess(`${label} data connected — ${rowCount} rows loaded`)
      setSelectedFile(null)
    }
    reader.readAsText(selectedFile)
  }

  function handleDisconnect() {
    onDisconnect(id)
    setSuccess('')
    setSelectedFile(null)
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
          /* ── Connected state ──────────────────────────────────────────────── */
          <div className="space-y-3">
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">{connected.filename}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {connected.rowCount.toLocaleString()} rows · uploaded {new Date(connected.uploadedAt).toLocaleDateString()}
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
        ) : (
          /* ── Upload state ─────────────────────────────────────────────────── */
          <div className="space-y-3">
            {/* Drop zone */}
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
                  <span className="text-sm font-medium text-foreground truncate max-w-[180px]">{selectedFile.name}</span>
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

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-3 bg-emerald-500/8 border border-emerald-500/25 rounded-lg"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-600 dark:text-emerald-400">{success}</p>
              </motion.div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ImportSources() {
  const [sources, setSources] = useState<UploadedSource[]>(getUploadedSources)

  const appstoreSource = sources.find(s => s.source === 'appstore') ?? null
  const zendeskSource  = sources.find(s => s.source === 'zendesk')  ?? null
  const connectedCount = sources.length

  function handleConnect(source: 'appstore' | 'zendesk', filename: string, rowCount: number) {
    const entry: UploadedSource = {
      source,
      filename,
      rowCount,
      uploadedAt: new Date().toISOString(),
    }
    addUploadedSource(entry)
    setSources(getUploadedSources())
  }

  function handleDisconnect(source: 'appstore' | 'zendesk') {
    removeUploadedSource(source)
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
      <StatusBanner count={connectedCount} />

      {/* ── Source Cards ───────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-5">
        <SourceCard
          id="appstore"
          label="App Store Reviews"
          description="Upload a CSV export of iOS/macOS App Store reviews"
          Icon={Smartphone}
          connected={appstoreSource}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
        <SourceCard
          id="zendesk"
          label="Zendesk Tickets"
          description="Upload a CSV export of customer support tickets from Zendesk"
          Icon={Ticket}
          connected={zendeskSource}
          onConnect={handleConnect}
          onDisconnect={handleDisconnect}
        />
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
              Download App Store Sample CSV
            </Button>
          </a>
          <a href="/samples/zendesk_sample.csv" download>
            <Button variant="outline" className="bg-transparent gap-2">
              <Ticket className="w-4 h-4" />
              Download Zendesk Sample CSV
            </Button>
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
