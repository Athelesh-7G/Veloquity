import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  id: string
  source: string
  text: string
  date: string
  rating?: number
  cluster: string
}

// ─── Source display helpers ───────────────────────────────────────────────────

const SOURCE_DISPLAY: Record<string, string> = {
  appstore:        'App Store',
  zendesk:         'Zendesk',
  patient_portal:  'Patient Portal',
  hospital_survey: 'Hospital Survey',
}

const SOURCE_BADGE: Record<string, string> = {
  'App Store':      'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30',
  'Zendesk':        'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30',
  'Patient Portal': 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30',
  'Hospital Survey':'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30',
}

function resolveSource(raw: string): string {
  return SOURCE_DISPLAY[raw] ?? raw
}

function sourceBadgeClass(displaySource: string): string {
  return SOURCE_BADGE[displaySource] ?? 'bg-muted text-muted-foreground border-border'
}

// ─── CSV download ─────────────────────────────────────────────────────────────

function downloadCSV(items: EvidenceItem[], clusterName: string) {
  const header = 'id,source,date,rating,text\n'
  const rows = items.map((i) => {
    const src = resolveSource(i.source)
    const text = i.text.replace(/"/g, '""')
    return `${i.id},"${src}",${i.date},${i.rating ?? ''},"${text}"`
  })
  const blob = new Blob([header + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${clusterName.toLowerCase().replace(/\s+/g, '-')}-items.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EvidenceDrawerProps {
  isOpen: boolean
  onClose: () => void
  clusterName: string
  allItems: EvidenceItem[]
  totalCount?: number
}

export function EvidenceDrawer({ isOpen, onClose, clusterName, allItems, totalCount }: EvidenceDrawerProps) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
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
            className="fixed inset-0 bg-black/30 z-40"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-xl bg-background border-l border-border shadow-2xl z-50 flex flex-col"
          >
            {/* Sticky header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border p-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mb-0.5">
                  All feedback items
                </p>
                <h2 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">
                  {clusterName}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {(totalCount ?? allItems.length)} item{(totalCount ?? allItems.length) !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs bg-transparent h-8"
                  onClick={() => downloadCSV(allItems, clusterName)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download CSV
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Scrollable item list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allItems.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
                  No items found for this cluster.
                </div>
              ) : (
                allItems.map((item) => {
                  const displaySrc = resolveSource(item.source)
                  const badgeCls = sourceBadgeClass(displaySrc)
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-border bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span
                          className={cn(
                            'text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0',
                            badgeCls,
                          )}
                        >
                          {displaySrc}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.rating != null && (
                            <span className="text-xs text-amber-500 shrink-0">
                              {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                            </span>
                          )}
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            {item.date}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed">{item.text}</p>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
