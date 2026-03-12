import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { type EvidenceItem, type EvidenceMapItem, getEvidence, getEvidenceItems } from '../api/client'
import ConfidenceBar from '../components/ConfidenceBar'

const SOURCE_COLOR: Record<string, string> = {
  app_store: '#3B82F6',
  zendesk:   '#8B5CF6',
}

function SourceBadge({ source }: { source: string }) {
  const color = SOURCE_COLOR[source] ?? '#64748B'
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ background: `${color}20`, color }}
    >
      {source === 'app_store' ? 'App Store' : source === 'zendesk' ? 'Zendesk' : source}
    </span>
  )
}

function ItemsDrawer({ evidenceId, onClose }: { evidenceId: string; onClose: () => void }) {
  const [items, setItems] = useState<EvidenceMapItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvidenceItems(evidenceId)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [evidenceId])

  return (
    <div
      className="mt-3 rounded-lg border p-4"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
          Raw Feedback Items
        </span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">
          Close
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-slate-500">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500">No item map entries yet. Re-run the evidence pipeline to populate.</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 text-xs py-1.5 border-b"
              style={{ borderColor: 'var(--border)' }}
            >
              <SourceBadge source={item.source} />
              <span className="font-mono text-slate-400 truncate flex-1" title={item.s3_key}>
                {item.s3_key}
              </span>
              <span className="font-mono text-slate-500 flex-shrink-0">
                {item.dedup_hash.slice(0, 8)}…
              </span>
              {item.item_timestamp && (
                <span className="text-slate-500 flex-shrink-0">
                  {new Date(item.item_timestamp).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Evidence() {
  const [items, setItems] = useState<EvidenceItem[]>([])
  const [filtered, setFiltered] = useState<EvidenceItem[]>([])
  const [sourceFilter, setSourceFilter] = useState('all')
  const [sortBy, setSortBy] = useState('confidence_score')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEvidence({ sort_by: sortBy })
      .then((d) => { setItems(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [sortBy])

  useEffect(() => {
    if (sourceFilter === 'all') {
      setFiltered(items)
    } else {
      setFiltered(items.filter((e) => sourceFilter in (e.source_lineage ?? {})))
    }
  }, [items, sourceFilter])

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-500">Loading evidence…</div>
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'var(--card)' }}>
          {['all', 'app_store', 'zendesk'].map((s) => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className="px-3 py-1.5 text-xs rounded-md font-medium transition-all"
              style={{
                background: sourceFilter === s ? 'var(--accent)' : 'transparent',
                color: sourceFilter === s ? '#fff' : '#94A3B8',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {s === 'all' ? 'All Sources' : s === 'app_store' ? 'App Store' : 'Zendesk'}
            </button>
          ))}
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs rounded-lg px-3 py-2 border"
          style={{
            background: 'var(--card)',
            color: '#94A3B8',
            borderColor: 'var(--border)',
          }}
        >
          <option value="confidence_score">Sort: Confidence</option>
          <option value="unique_user_count">Sort: User Count</option>
          <option value="last_validated_at">Sort: Most Recent</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtered.length} clusters</span>
      </div>

      {/* Evidence cards */}
      {filtered.length === 0 ? (
        <div
          className="rounded-xl border p-8 text-center text-slate-500"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          No evidence clusters found.
        </div>
      ) : (
        filtered.map((e) => {
          const quotes = e.representative_quotes ?? []
          const lineageEntries = Object.entries(e.source_lineage ?? {})
          const totalLineage = lineageEntries.reduce((s, [, v]) => s + (v as number), 0)

          return (
            <div
              key={e.id}
              className="rounded-xl border p-5"
              style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            >
              <h3 className="text-base font-semibold text-slate-100 mb-3">{e.theme}</h3>

              <div className="flex items-center gap-6 mb-4">
                <div className="flex-1">
                  <p className="text-xs text-slate-500 mb-1">Confidence</p>
                  <ConfidenceBar score={e.confidence_score} />
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-slate-100">{e.unique_user_count}</div>
                  <div className="text-xs text-slate-500">users</div>
                </div>
              </div>

              {/* Source lineage bar */}
              {lineageEntries.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-slate-500 mb-1.5">Source Lineage</p>
                  <div className="flex rounded-full overflow-hidden h-3">
                    {lineageEntries.map(([src, val]) => (
                      <div
                        key={src}
                        title={`${src}: ${Math.round((val as number) * 100)}%`}
                        style={{
                          width: `${((val as number) / totalLineage) * 100}%`,
                          background: SOURCE_COLOR[src] ?? '#64748B',
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3 mt-1.5">
                    {lineageEntries.map(([src, val]) => (
                      <span key={src} className="flex items-center gap-1 text-xs text-slate-400">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: SOURCE_COLOR[src] ?? '#64748B' }}
                        />
                        {src === 'app_store' ? 'App Store' : src} ({Math.round((val as number) * 100)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Quotes */}
              {quotes.length > 0 && (
                <div className="space-y-2 mb-4">
                  {quotes.slice(0, 3).map((q, i) => (
                    <div
                      key={i}
                      className="rounded-lg p-3 text-xs text-slate-300 border flex items-start gap-2"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                    >
                      <span className="text-slate-600 mt-0.5">"</span>
                      <span className="flex-1">{q.text}</span>
                      <SourceBadge source={q.source} />
                    </div>
                  ))}
                </div>
              )}

              {/* Items toggle */}
              <button
                onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                {expandedId === e.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                View feedback items
              </button>

              {expandedId === e.id && (
                <ItemsDrawer evidenceId={e.id} onClose={() => setExpandedId(null)} />
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
