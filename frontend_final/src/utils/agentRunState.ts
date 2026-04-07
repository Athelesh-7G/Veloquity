type AgentStatus = {
  name: string
  status: 'idle' | 'done'
  ranAt: string | null
  durationSeconds: number | null
}

const KEY = 'veloquity_agent_run_state'

export function getAgentRunState(): AgentStatus[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') }
  catch { return [] }
}

export function setAgentsDone(ranAt: string): void {
  const agents: AgentStatus[] = [
    { name: 'ingestion',  status: 'done', ranAt, durationSeconds: 18 },
    { name: 'evidence',   status: 'done', ranAt, durationSeconds: 34 },
    { name: 'reasoning',  status: 'done', ranAt, durationSeconds: 27 },
    { name: 'governance', status: 'done', ranAt, durationSeconds: 12 },
  ]
  try { localStorage.setItem(KEY, JSON.stringify(agents)) }
  catch {}
}

export function clearAgentRunState(): void {
  try { localStorage.removeItem(KEY) } catch {}
}

export function hasAgentsRun(): boolean {
  const state = getAgentRunState()
  return state.length > 0 && state.every(a => a.status === 'done')
}
