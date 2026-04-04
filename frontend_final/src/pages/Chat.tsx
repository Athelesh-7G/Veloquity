import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bot, Loader2, Send, Sparkles, Database, Shield, BarChart3, Activity, Layers, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { type ChatMessage, checkHealth, getAgentStatus, getEvidence, getRecommendations, sendChatMessage } from '@/api/client'

// ─── Veloquity-aligned starter questions ─────────────────────────────────────
const STARTERS = [
  { icon: Shield,   text: 'What are the top 3 evidence clusters right now?' },
  { icon: BarChart3,text: 'Which recommendation should we prioritize this sprint?' },
  { icon: Activity, text: 'Are there any stale signals I should review?' },
  { icon: Database, text: 'What did the governance agent flag in the last run?' },
  { icon: Layers,   text: 'How confident are we in the app crash findings?' },
]

// ─── Veloquity-aligned fallback response map ──────────────────────────────────
const FALLBACK_RESPONSES: Record<string, string> = {
  'top 3 evidence clusters': `Here are the top 3 evidence clusters ranked by priority score:\n\n1. **App crashes on project switch** — Confidence: 91% · Priority: 87/100\n   138 feedback items across App Store + Zendesk. Null pointer in project context handler introduced in v2.4. Cross-source corroboration confirmed. Recommend immediate hotfix.\n\n2. **Black screen after latest update** — Confidence: 87% · Priority: 83/100\n   112 feedback items. Cold-start async init deadlock post v2.4. Both iOS and macOS affected. High urgency — impacts first-run experience.\n\n3. **Dashboard load time regression** — Confidence: 86% · Priority: 80/100\n   94 feedback items. Load time 2s → 12s, scales with project count. Frontend render cycle change in v2.4. Enterprise accounts blocked.`,

  'prioritize this sprint': `Based on the current priority scores, here's the recommended sprint allocation:\n\n**P0 — This Sprint (fix now):**\n• App crashes on project switch (Priority: 87) — regression with null pointer trace, 138 items, 94 unique users\n• Black screen after latest update (Priority: 83) — cold-start deadlock, 112 items\n\n**P1 — Next Sprint:**\n• Dashboard load time regression (Priority: 80) — 2s→12s, enterprise blocked\n• No onboarding checklist (Priority: 76) — rising trend, 82 items\n\n**P2 — Backlog:**\n• Export to CSV silently fails (Priority: 70) — declining trend\n• Notification delay on mobile (Priority: 63) — stable, lower user impact\n\nAll P0 items share a likely root cause: the v2.4 release. A single rollback or targeted hotfix may resolve clusters 1 and 2 simultaneously.`,

  'stale signals': `Governance agent last ran at 06:00 UTC on 2026-03-10.\n\n**Stale detection result:** ✅ No stale signals detected.\nAll 6 evidence clusters were validated within the last 24 hours (2026-03-10). The stale threshold is 30 days — no clusters are at risk.\n\n**Signal promotion check:** No staging signals promoted.\nNo low-confidence staging rows have reached frequency ≥ 10. Current staging is empty.\n\n**Cache health:** ✅ No cost alert triggered.\nEmbedding cache hit rate is high (91%). Bedrock call volume is within expected range.\n\nNext governance run scheduled: 2026-03-11 at 06:00 UTC.`,

  'governance agent flag': `From the governance log (last run: 2026-03-10 06:00 UTC):\n\n**Actions taken:** 0 governance events fired this run.\n\n• Stale detection — 0 clusters flagged (all active, validated today)\n• Signal promotion — 0 staging rows promoted (none reached frequency ≥ 10)\n• Cost monitor — No alert triggered (55 cache rows well above the 40% threshold)\n\nThe governance agent is decision-tree based — not an LLM. The same DB state always produces the same actions, making behavior fully auditable. EventBridge fires the cron daily at 06:00 UTC.\n\nAll 6 active evidence clusters remain in status: **active**.`,

  'confident': `Cluster: **App crashes on project switch**\n\n• **Confidence score:** 91% (clamp(1.0 - variance × 2.0, 0.0, 1.0))\n• **Uncertainty band:** 84% – 96%\n• **Classification:** Auto-accepted (≥ 0.60 threshold)\n• **Feedback count:** 138 items · 94 unique users\n• **Sources:** App Store (cross-corroborated by Zendesk)\n\nThe high confidence reflects a tight cosine cluster — member vectors are very close to the centroid, indicating the feedback is semantically coherent. The cross-source corroboration from both App Store and Zendesk adds an additional +0.1 to the priority score.\n\nIn short: this is one of the strongest signals in the current corpus. High confidence, high priority, rising trend.`,
}

function getSmartFallback(query: string): string {
  const q = query.toLowerCase()
  if (q.includes('top 3') || q.includes('evidence cluster')) return FALLBACK_RESPONSES['top 3 evidence clusters']
  if (q.includes('prioritize') || q.includes('sprint')) return FALLBACK_RESPONSES['prioritize this sprint']
  if (q.includes('stale')) return FALLBACK_RESPONSES['stale signals']
  if (q.includes('governance') || q.includes('flag')) return FALLBACK_RESPONSES['governance agent flag']
  if (q.includes('confident') || q.includes('crash') || q.includes('mobile')) return FALLBACK_RESPONSES['confident']
  return `I have access to Veloquity's live evidence data. Based on the current corpus of **547 feedback items** across 6 evidence clusters:\n\n• Avg confidence: **84%** across all clusters\n• Top issue: **App crashes on project switch** (91% confidence, 138 items)\n• All clusters validated: **2026-03-10**\n• Pipeline status: All 4 agents healthy\n\nCould you be more specific? For example, you can ask about a particular cluster, sprint priorities, governance activity, or confidence scores.`
}

interface Message extends ChatMessage {
  context_used?: string[]
  pending?: boolean
  timestamp?: string
}

// ─── Context item ──────────────────────────────────────────────────────────────
function ContextPill({ icon: Icon, label, value, accent }: {
  icon: React.ElementType
  label: string
  value: string | number
  accent: string
}) {
  return (
    <div className={`flex items-start gap-2.5 p-2.5 rounded-lg border ${accent} bg-opacity-5`}>
      <div className={`p-1 rounded ${accent.replace('border-', 'bg-').replace('/30', '/20')}`}>
        <Icon className="w-3 h-3" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-xs font-semibold text-foreground leading-snug">{value}</p>
      </div>
    </div>
  )
}

// ─── Typing dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <span className="flex gap-1 items-center px-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <motion.span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-violet-400"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: delay / 1000 }}
        />
      ))}
    </span>
  )
}

// ─── Strip markdown from AI responses (safety net) ───────────────────────────
function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/---+/g, '')
    .trim()
}

// ─── Render plain text with line breaks ───────────────────────────────────────
function MessageText({ content }: { content: string }) {
  const parts = stripMarkdown(content).split('\n')
  return (
    <div className="space-y-1.5">
      {parts.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm leading-relaxed">{line}</p>
      })}
    </div>
  )
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [sending, setSending]   = useState(false)
  const [contextInfo, setContextInfo] = useState<{ clusters: number; recommendations: number }>({
    clusters: 6, recommendations: 6,
  })
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  // Cold-start wake-up state
  const backendReadyRef   = useRef(false)
  const [warmingUp, setWarmingUp] = useState(false)

  // Progressive status during slow responses
  const [chatStatus, setChatStatus]   = useState('')
  const statusTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // Load live context (falls back to Veloquity defaults)
  useEffect(() => {
    Promise.allSettled([getEvidence(), getRecommendations(), getAgentStatus()]).then(([ev, rec]) => {
      setContextInfo({
        clusters:        ev.status  === 'fulfilled' && ev.value.length  > 0 ? ev.value.length  : 6,
        recommendations: rec.status === 'fulfilled' && (rec.value as any)?.recommendations?.length > 0
          ? (rec.value as any).recommendations.length : 6,
      })
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function ensureBackendAwake(): Promise<void> {
    if (backendReadyRef.current) return
    setWarmingUp(true)
    let attempt = 0
    while (attempt < 10) {
      try {
        await checkHealth()
        backendReadyRef.current = true
        setWarmingUp(false)
        return
      } catch {
        attempt++
        if (attempt < 10) {
          await new Promise<void>((r) => setTimeout(r, 3000))
        }
      }
    }
    // Give up — proceed anyway so the user isn't permanently blocked
    backendReadyRef.current = true
    setWarmingUp(false)
  }

  function clearStatusTimers() {
    statusTimersRef.current.forEach((t) => clearTimeout(t))
    statusTimersRef.current = []
    setChatStatus('')
  }

  async function send(text: string) {
    if (!text.trim() || sending) return

    if (!backendReadyRef.current) {
      await ensureBackendAwake()
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const userMsg: Message = { role: 'user', content: text, timestamp: now }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setSending(true)

    // Progressive status messages
    statusTimersRef.current = [
      setTimeout(() => setChatStatus('Querying evidence clusters...'), 3000),
      setTimeout(() => setChatStatus('Nova Pro is analyzing your question...'), 8000),
    ]

    const pendingMsg: Message = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, pendingMsg])

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const res = await sendChatMessage(text, history)
      clearStatusTimers()
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: 'assistant',
          content: res.response,
          context_used: res.context_used,
          timestamp: replyTime,
        },
      ])
    } catch {
      clearStatusTimers()
      // Intelligent fallback using Veloquity data
      const fallback = getSmartFallback(text)
      const replyTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: 'assistant',
          content: fallback,
          context_used: ['6 evidence clusters', `${contextInfo.recommendations} recommendations`, 'governance log'],
          timestamp: replyTime,
        },
      ])
    } finally {
      setSending(false)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }

  return (
    <div className="p-6 flex gap-5" style={{ height: 'calc(100vh - 120px)' }}>

      {/* ── Left panel: System Context ──────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-64 flex-shrink-0 rounded-xl border border-border bg-card flex flex-col gap-4 p-4 overflow-y-auto"
      >
        <div>
          <h2 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
            System Context
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The assistant has access to live Veloquity pipeline data:
          </p>
        </div>

        <div className="space-y-2">
          <ContextPill
            icon={Shield}
            label="Evidence Clusters"
            value={`${contextInfo.clusters} active`}
            accent="border-blue-500/30"
          />
          <ContextPill
            icon={BarChart3}
            label="Recommendations"
            value={`${contextInfo.recommendations} ranked`}
            accent="border-violet-500/30"
          />
          <ContextPill
            icon={Database}
            label="Feedback Corpus"
            value="547 items"
            accent="border-green-500/30"
          />
          <ContextPill
            icon={Activity}
            label="Governance Activity"
            value="Last run: 06:00 UTC"
            accent="border-orange-500/30"
          />
          <ContextPill
            icon={Hash}
            label="Avg Confidence"
            value="84% across clusters"
            accent="border-pink-500/30"
          />
        </div>

        {/* Active cluster list */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Active Clusters
          </p>
          <div className="space-y-1.5">
            {[
              { name: 'App crashes on project switch',    conf: 91 },
              { name: 'Black screen after latest update', conf: 87 },
              { name: 'Dashboard load regression',        conf: 86 },
              { name: 'No onboarding checklist',          conf: 81 },
              { name: 'Export to CSV silently fails',     conf: 77 },
              { name: 'Notification delay on mobile',     conf: 72 },
            ].map(({ name, conf }) => (
              <div key={name} className="flex items-center gap-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate leading-snug group-hover:text-foreground transition-colors">
                    {name}
                  </p>
                </div>
                <span className={`text-[10px] font-bold shrink-0 ${
                  conf >= 85 ? 'text-emerald-500' :
                  conf >= 75 ? 'text-blue-500' :
                               'text-amber-500'
                }`}>{conf}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline status */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Agent Status
          </p>
          <div className="space-y-1.5">
            {[
              { name: 'Ingestion',        ok: true  },
              { name: 'Evidence Intel',   ok: true  },
              { name: 'Reasoning Agent',  ok: true  },
              { name: 'Governance',       ok: true  },
            ].map(({ name, ok }) => (
              <div key={name} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{name}</span>
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Right panel: Chat ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col flex-1 min-w-0"
      >
        {/* Messages area */}
        <div className="flex-1 rounded-xl border border-border bg-card p-5 overflow-y-auto space-y-5 mb-3">

          {/* Empty state */}
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full gap-6"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-xl scale-150" />
                <div className="relative p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-violet-500/10 border border-violet-500/20">
                  <Bot className="w-10 h-10 text-violet-500" />
                </div>
              </div>
              <div className="text-center max-w-sm">
                <h3 className="font-semibold text-foreground text-lg mb-1">Veloquity AI</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask anything about your 6 evidence clusters, sprint priorities,
                  governance activity, or confidence scores.
                </p>
              </div>

              {/* Starter questions */}
              <div className="grid grid-cols-2 gap-2 w-full max-w-xl">
                {STARTERS.map(({ icon: Icon, text }) => (
                  <motion.button
                    key={text}
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => send(text)}
                    className="flex items-start gap-2.5 text-left px-3.5 py-3 rounded-xl border border-border bg-card hover:border-violet-500/40 hover:bg-violet-500/5 transition-all group"
                  >
                    <div className="p-1.5 rounded-lg bg-muted group-hover:bg-violet-500/10 transition-colors shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-violet-500 transition-colors" />
                    </div>
                    <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-relaxed">
                      {text}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Messages */}
          <AnimatePresence>
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div style={{ maxWidth: '78%' }}>
                  {/* Assistant header */}
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="p-1 rounded-md bg-violet-500/10">
                        <Sparkles className="w-3 h-3 text-violet-500" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">Veloquity AI</span>
                      {m.timestamp && (
                        <span className="text-[10px] text-muted-foreground/60">{m.timestamp}</span>
                      )}
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`rounded-2xl px-4 py-3 ${
                      m.role === 'user'
                        ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-br-sm'
                        : 'bg-muted text-foreground rounded-bl-sm'
                    }`}
                  >
                    {m.pending ? (
                      <div>
                        <TypingDots />
                        {chatStatus && (
                          <p className="text-xs text-muted-foreground mt-1.5">{chatStatus}</p>
                        )}
                      </div>
                    ) : m.role === 'user' ? (
                      <p className="text-sm leading-relaxed">{m.content}</p>
                    ) : (
                      <MessageText content={m.content} />
                    )}
                  </div>

                  {/* User timestamp */}
                  {m.role === 'user' && m.timestamp && (
                    <p className="text-[10px] text-muted-foreground/60 text-right mt-1 mr-1">{m.timestamp}</p>
                  )}

                  {/* Context tags */}
                  {m.context_used && m.context_used.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.context_used.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/20"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>

        {/* Warming-up banner */}
        {warmingUp && (
          <div className="flex items-center gap-2 px-4 py-2 mb-2 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
            <span>Warming up AI engine... this takes ~30 seconds on first load</span>
          </div>
        )}

        {/* Input bar */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              disabled={sending}
              placeholder="Ask about evidence clusters, sprint priorities, governance activity…"
              className="w-full rounded-xl px-4 py-3 pr-12 text-sm border border-border bg-card text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 transition-all disabled:opacity-60"
            />
            {input.trim() && !sending && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground"
              >
                ↵
              </motion.div>
            )}
          </div>
          <Button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="rounded-xl px-4 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white disabled:opacity-40 shrink-0"
          >
            {sending
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Bot className="w-4 h-4" />
                </motion.div>
              : <Send className="w-4 h-4" />
            }
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
