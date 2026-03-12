import { useEffect, useRef, useState } from 'react'
import { Bot, Send } from 'lucide-react'
import {
  type ChatMessage,
  getAgentStatus,
  getEvidence,
  getRecommendations,
  sendChatMessage,
} from '../api/client'

const STARTERS = [
  'What are the highest priority issues right now?',
  'Which evidence cluster has the most user reports?',
  'What did the last governance run do?',
  'Explain the confidence score for the crash cluster',
]

interface Message extends ChatMessage {
  context_used?: string[]
  pending?: boolean
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [contextInfo, setContextInfo] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Pre-fetch context info for the sidebar
    Promise.allSettled([getEvidence(), getRecommendations(), getAgentStatus()]).then(([ev, rec]) => {
      const labels: string[] = []
      if (ev.status === 'fulfilled') labels.push(`${ev.value.length} evidence clusters`)
      if (rec.status === 'fulfilled') labels.push(`${rec.value.recommendations.length} recommendations`)
      setContextInfo(labels)
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(text: string) {
    if (!text.trim() || sending) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages((m) => [...m, userMsg])
    setInput('')
    setSending(true)

    const pendingMsg: Message = { role: 'assistant', content: '', pending: true }
    setMessages((m) => [...m, pendingMsg])

    try {
      const history = messages.slice(-10).map((m) => ({ role: m.role, content: m.content }))
      const res = await sendChatMessage(text, history)
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'assistant', content: res.response, context_used: res.context_used },
      ])
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'assistant', content: `Error: ${msg}` },
      ])
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-full gap-5" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      {/* Left panel: context */}
      <div
        className="w-72 flex-shrink-0 rounded-xl border p-4 flex flex-col gap-4"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">System Context</h2>
        <p className="text-xs text-slate-400">The assistant has access to live system data:</p>
        <div className="space-y-2">
          {contextInfo.map((c, i) => (
            <div
              key={i}
              className="text-xs px-3 py-2 rounded-lg border"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: '#93C5FD' }}
            >
              {c}
            </div>
          ))}
          <div
            className="text-xs px-3 py-2 rounded-lg border"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: '#93C5FD' }}
          >
            Recent governance activity
          </div>
        </div>
      </div>

      {/* Right panel: chat */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Messages */}
        <div
          className="flex-1 rounded-xl border p-4 overflow-y-auto space-y-4"
          style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <Bot size={32} className="text-slate-600" />
              <p className="text-slate-500 text-sm">Ask Veloquity anything about your evidence and recommendations.</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs text-left px-3 py-2.5 rounded-lg border transition-all"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: '#94A3B8',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div style={{ maxWidth: '75%' }}>
                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <Bot size={12} className="text-slate-500" />
                      <span className="text-xs text-slate-500">Veloquity AI</span>
                    </div>
                  )}
                  <div
                    className="rounded-xl px-4 py-3 text-sm"
                    style={{
                      background: m.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                      color: '#F1F5F9',
                      borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    }}
                  >
                    {m.pending ? (
                      <span className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                  {m.context_used && m.context_used.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {m.context_used.map((c) => (
                        <span
                          key={c}
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(100,116,139,0.15)', color: '#64748B' }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="flex gap-2 mt-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
            disabled={sending}
            placeholder="Ask about evidence, recommendations, or system activity…"
            className="flex-1 rounded-xl px-4 py-3 text-sm border outline-none"
            style={{
              background: 'var(--card)',
              borderColor: 'var(--border)',
              color: '#F1F5F9',
            }}
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="rounded-xl px-4 py-3 flex items-center gap-2 text-sm font-medium"
            style={{
              background: sending || !input.trim() ? 'var(--card)' : 'var(--accent)',
              color: sending || !input.trim() ? '#475569' : '#fff',
              border: `1px solid ${sending || !input.trim() ? 'var(--border)' : 'var(--accent)'}`,
              cursor: sending || !input.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
