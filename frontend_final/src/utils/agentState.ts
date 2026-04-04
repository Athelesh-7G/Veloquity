// =============================================================
// src/utils/agentState.ts
// Persists per-agent run state to localStorage so timers and
// results survive page navigation.
// =============================================================

const STORAGE_KEY = 'veloquity_agent_state'

export type AgentKey        = 'ingestion' | 'evidence' | 'reasoning' | 'governance'
export type AgentRunStatus  = 'idle' | 'running' | 'done' | 'error'

export interface AgentEntry {
  status:    AgentRunStatus
  lastRun:   string | null   // ISO string of last successful run
  duration:  number | null   // elapsed seconds of last run
  error:     string | null   // error message if status === 'error'
  startedAt: number | null   // epoch ms — restores the live timer after navigation
}

type AgentStateMap = Record<AgentKey, AgentEntry>

const DEFAULT_ENTRY: AgentEntry = {
  status: 'idle', lastRun: null, duration: null, error: null, startedAt: null,
}

function defaultState(): AgentStateMap {
  return {
    ingestion:  { ...DEFAULT_ENTRY },
    evidence:   { ...DEFAULT_ENTRY },
    reasoning:  { ...DEFAULT_ENTRY },
    governance: { ...DEFAULT_ENTRY },
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getAgentState(): AgentStateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw) as Partial<AgentStateMap>
    const state = defaultState()
    for (const key of Object.keys(state) as AgentKey[]) {
      if (parsed[key]) state[key] = { ...DEFAULT_ENTRY, ...parsed[key] }
    }
    return state
  } catch {
    return defaultState()
  }
}

export function getAgentStatus(agent: AgentKey): AgentEntry {
  return getAgentState()[agent]
}

export function setAgentStatus(
  agent: AgentKey,
  status: AgentRunStatus,
  extras?: Partial<Omit<AgentEntry, 'status'>>,
): void {
  const state = getAgentState()
  state[agent] = { ...state[agent], status, ...(extras ?? {}) }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function clearAgentState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
