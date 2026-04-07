// =============================================================
// src/api/client.ts
// Typed API client for all Veloquity backend endpoints.
// =============================================================

const BASE = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_URL ?? 'http://localhost:8002'
const V1 = `${BASE}/api/v1`

// ── Types ───────────────────────────────────────────────────

export interface EvidenceItem {
  id: string
  theme: string
  confidence_score: number
  unique_user_count: number
  source_lineage: Record<string, number>
  representative_quotes: Array<{ text: string; source: string }>
  status: string
  last_validated_at: string | null
}

export interface EvidenceMapItem {
  id: string
  dedup_hash: string
  s3_key: string
  source: string
  item_id: string
  item_timestamp: string | null
}

export interface Recommendation {
  rank: number
  theme: string
  recommended_action: string
  effort_estimate: 'low' | 'medium' | 'high'
  user_impact: 'low' | 'medium' | 'high'
  tradeoff_explanation: string
  risk_flags: string[]
  related_clusters: number[]
}

export interface ReasoningRun {
  id: string
  run_at: string
  model_id: string
  token_usage: { input_tokens?: number; output_tokens?: number }
  recommendations: Recommendation[]
  reasoning_summary: string
  highest_priority_theme: string
  cross_cluster_insight: string
}

export interface AgentStatus {
  name: string
  display_name: string
  last_run_at: string | null
  last_run_status: string
  total_runs: number | null
  description: string
  lambda_function_name: string
}

export interface AgentRunResult {
  agent_name: string
  status: string
  response_payload: Record<string, unknown>
  invoked_at: string
}

export interface GovernanceEvent {
  id: string
  event_type: string
  target_id: string | null
  details: Record<string, unknown>
  actioned_at: string
}

export interface GovernanceStats {
  total_events: number
  stale_flagged: number
  signals_promoted: number
  cost_alerts: number
  active_evidence: number
  staging_count: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  response: string
  context_used: string[]
}

// ── Helpers ─────────────────────────────────────────────────

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    let msg = `API error ${res.status}`
    try {
      const body = await res.json()
      msg = body?.detail ?? msg
    } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

// ── API functions ────────────────────────────────────────────

export const getEvidence = (params?: { source?: string; sort_by?: string }) => {
  const qs = new URLSearchParams()
  if (params?.source) qs.set('source', params.source)
  if (params?.sort_by) qs.set('sort_by', params.sort_by)
  return apiFetch<EvidenceItem[]>(`${V1}/evidence/?${qs}`)
}

export const getEvidenceItems = (id: string) =>
  apiFetch<EvidenceMapItem[]>(`${V1}/evidence/${id}/items`)

export const getRecommendations = () =>
  apiFetch<ReasoningRun>(`${V1}/recommendations/`)

export const getAgentStatus = () =>
  apiFetch<AgentStatus[]>(`${V1}/agents/status`)

export const runAgent = (name: string) =>
  apiFetch<AgentRunResult>(`${V1}/agents/${name}/run`, { method: 'POST' })

export const getGovernanceLog = (limit = 50) =>
  apiFetch<GovernanceEvent[]>(`${V1}/governance/log?limit=${limit}`)

export const getGovernanceStats = () =>
  apiFetch<GovernanceStats>(`${V1}/governance/stats`)

export const sendChatMessage = (message: string, history: ChatMessage[], system?: string) =>
  apiFetch<ChatResponse>(`${V1}/chat/`, {
    method: 'POST',
    body: JSON.stringify({ message, history, ...(system ? { system } : {}) }),
  })

export const getConstraints = () =>
  apiFetch<Record<string, unknown>>(`${V1}/constraints/`)

export const updateConstraints = (updates: Record<string, unknown>) =>
  apiFetch<Record<string, unknown>>(`${V1}/constraints/`, {
    method: 'POST',
    body: JSON.stringify(updates),
  })

// Aliases used in some pages
export const sendChat = sendChatMessage

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    return res.ok
  } catch {
    return false
  }
}
