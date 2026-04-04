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
  feedback_item_count: number
  source_lineage: Record<string, number>
  representative_quotes: Array<{ text: string; source: string }>
  status: string
  last_validated_at: string | null
}

export interface EvidenceMapItem {
  id: string
  source: string
  text: string
  timestamp: string | null
  metadata: Record<string, unknown>
  s3_key: string
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
  evidence_used: string[]
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

export const sendChatMessage = (message: string, history: ChatMessage[]) =>
  apiFetch<ChatResponse>(`${V1}/chat/`, {
    method: 'POST',
    body: JSON.stringify({ message, history }),
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
export const postConstraints = updateConstraints

// ── Upload ───────────────────────────────────────────────────

export interface UploadResult {
  status: string
  items_submitted: number
  source: string
  message: string
}

export const uploadFeedback = async (
  file: File,
  source: 'appstore' | 'zendesk',
): Promise<UploadResult> => {
  const form = new FormData()
  form.append('file', file)
  form.append('source', source)
  // No Content-Type header — browser sets multipart boundary automatically
  const res = await fetch(`${V1}/upload/feedback`, { method: 'POST', body: form })
  if (!res.ok) {
    let msg = `Upload error ${res.status}`
    try { const b = await res.json(); msg = b?.detail ?? msg } catch {}
    throw new Error(msg)
  }
  return res.json() as Promise<UploadResult>
}

// ── Metrics ──────────────────────────────────────────────────

export interface PlatformMetrics {
  generated_at: string
  data_pipeline: {
    evidence_clusters: { total: number; active: number; stale: number; rejected: number }
    feedback_items: { total_mapped: number; unique_hashes: number; sources: string[] }
    embedding_cache: { total_entries: number; total_hits: number }
    staging: { total: number; pending: number }
  }
  model_performance: {
    confidence: { avg: number; max: number; min: number }
    cluster_size: { avg: number; max: number }
    thresholds: { auto_accepted: number; llm_validated: number; auto_rejected: number }
  }
  agent_activity: {
    reasoning_runs: {
      total: number
      total_tokens_used: number
      latest_run_at: string | null
      latest_priority_theme: string | null
    }
    governance: { total_events: number; by_type: Record<string, number> }
    agents: Array<{
      name: string
      display_name: string
      last_run_at: string | null
      last_run_status: string
      total_runs: number | null
    }>
  }
  cost_estimates: {
    embedding_cost_usd: number
    reasoning_cost_usd: number
    total_cost_usd: number
    basis: Record<string, number>
  }
}

export const getMetrics = () => apiFetch<PlatformMetrics>(`${V1}/metrics/`)

// ── Health / wake-up ─────────────────────────────────────────
export const checkHealth = (): Promise<{ status: string; service: string }> =>
  fetch(`${BASE}/health`, { signal: AbortSignal.timeout(5000) }).then((r) => {
    if (!r.ok) throw new Error(`Health check failed: ${r.status}`)
    return r.json() as Promise<{ status: string; service: string }>
  })
