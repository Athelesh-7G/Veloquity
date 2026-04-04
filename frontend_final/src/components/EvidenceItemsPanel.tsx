// =============================================================
// src/components/EvidenceItemsPanel.tsx
// Shared slide-over panel: shows raw feedback items for an evidence cluster.
// Used by EvidenceGrid, Chat, Scenarios, DataStudio.
// =============================================================

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, Download, Smartphone, Headphones, Database } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { type EvidenceMapItem, getEvidenceItems } from '@/api/client'

interface Props {
  isOpen: boolean
  onClose: () => void
  clusterId: string | null
  clusterTheme: string
  totalItems: number
}

function SourceBadge({ source }: { source: string }) {
  const isAppStore =
    source.toLowerCase().includes('app') || source.toLowerCase().includes('appstore')
  return (
    <Badge
      className={`text-[10px] flex items-center gap-1 border-0 ${
        isAppStore
          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
          : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
      }`}
    >
      {isAppStore
        ? <Smartphone className="w-2.5 h-2.5" />
        : <Headphones className="w-2.5 h-2.5" />}
      {source}
    </Badge>
  )
}

function downloadCSV(items: EvidenceMapItem[], theme: string) {
  const header = 'id,source,text,timestamp,s3_key\n'
  const rows = items
    .map((item) =>
      [
        item.id,
        item.source,
        `"${(item.text || '').replace(/"/g, '""')}"`,
        item.timestamp ?? '',
        item.s3_key,
      ].join(','),
    )
    .join('\n')
  const blob = new Blob([header + rows], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${theme.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '')}_items.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function EvidenceItemsPanel({
  isOpen,
  onClose,
  clusterId,
  clusterTheme,
  totalItems,
}: Props) {
  const [items, setItems]     = useState<EvidenceMapItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Fetch when panel opens
  useEffect(() => {
    if (!isOpen || !clusterId) return
    setLoading(true)
    setError(null)
    setItems([])
    getEvidenceItems(clusterId)
      .then((data) => setItems(data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load items'))
      .finally(() => setLoading(false))
  }, [isOpen, clusterId])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={onClose}
          />

          {/* Slide-over panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="sticky top-0 bg-background/90 backdrop-blur-xl border-b border-border px-5 py-4 flex items-center justify-between shrink-0">
              <div className="min-w-0 mr-3">
                <h2 className="font-semibold text-foreground text-base">
                  {totalItems > 0 ? `${totalItems} feedback items` : 'Feedback items'} in this cluster
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{clusterTheme}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {items.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-transparent text-xs"
                    onClick={() => downloadCSV(items, clusterTheme)}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download CSV
                  </Button>
                )}
                <Button type="button" variant="ghost" size="icon" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">

              {loading && (
                <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading feedback items…</span>
                </div>
              )}

              {!loading && error && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Database className="w-8 h-8 text-muted-foreground opacity-30" />
                  <p className="text-sm text-red-500">{error}</p>
                  <p className="text-xs text-muted-foreground">
                    Raw items are stored in S3. Run the ingestion pipeline to populate them.
                  </p>
                </div>
              )}

              {!loading && !error && items.length === 0 && !clusterId && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No cluster selected.</p>
                </div>
              )}

              {!loading && !error && items.length === 0 && clusterId && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Database className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No raw feedback items found for this cluster.</p>
                  <p className="text-xs text-center max-w-xs">
                    Run the full ingestion → evidence pipeline to populate item-level provenance.
                  </p>
                </div>
              )}

              {items.map((item) => {
                const meta    = item.metadata || {}
                const rating  = meta.rating as number | undefined
                const priority = meta.priority as string | undefined
                const status  = meta.status as string | undefined
                const itemId  = meta.item_id as string | undefined

                return (
                  <div
                    key={item.id}
                    className="p-4 bg-card border border-border rounded-xl space-y-3"
                  >
                    {/* Source + date row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <SourceBadge source={item.source} />
                      {item.timestamp && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.timestamp).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Full feedback text */}
                    {item.text ? (
                      <p className="text-sm text-foreground leading-relaxed">{item.text}</p>
                    ) : itemId ? (
                      <p className="text-xs text-muted-foreground font-mono">Item ID: {itemId}</p>
                    ) : null}

                    {/* Metadata pills */}
                    {(rating != null || priority || status) && (
                      <div className="flex flex-wrap gap-1.5">
                        {rating != null && (
                          <Badge variant="secondary" className="text-[10px]">
                            {'★'.repeat(Math.min(5, Math.max(1, Math.round(rating))))} {rating}/5
                          </Badge>
                        )}
                        {priority && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {priority} priority
                          </Badge>
                        )}
                        {status && (
                          <Badge variant="secondary" className="text-[10px] capitalize">
                            {status}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* S3 key — proves data lineage */}
                    {item.s3_key && (
                      <p className="text-[10px] text-muted-foreground/50 font-mono truncate">
                        {item.s3_key}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
