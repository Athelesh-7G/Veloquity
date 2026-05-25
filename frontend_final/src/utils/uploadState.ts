export type UploadedSource = {
  source: 'appstore' | 'support_tickets' | 'patient_portal' | 'hospital_survey_ticket'
  filename: string
  rowCount: number
  uploadedAt: string
  dataset: 'app_product' | 'hospital_survey'
}

const KEY = 'veloquity_uploaded_sources'

export function getUploadedSources(): UploadedSource[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch { return [] }
}

const MOCK_ITEM_COUNTS: Record<string, number> = {
  appstore:              275,
  support_tickets:               272,
  patient_portal:        155,
  hospital_survey_ticket: 155,
}

export function addUploadedSource(s: UploadedSource): void {
  try {
    const existing = getUploadedSources().filter(x => x.source !== s.source)
    const entry = { ...s, rowCount: MOCK_ITEM_COUNTS[s.source] ?? s.rowCount }
    localStorage.setItem(KEY, JSON.stringify([...existing, entry]))
  } catch {}
}

export function removeUploadedSource(source: string): void {
  try {
    const existing = getUploadedSources().filter(x => x.source !== source)
    localStorage.setItem(KEY, JSON.stringify(existing))
    if (existing.length === 0) localStorage.removeItem(KEY)
  } catch {}
}

export function hasUploadedData(): boolean {
  return getUploadedSources().length > 0
}

export function hasSource(source: 'appstore' | 'support_tickets' | 'patient_portal' | 'hospital_survey_ticket'): boolean {
  return getUploadedSources().some(x => x.source === source)
}

export function getActiveDataset(): 'app_product' | 'hospital_survey' | null {
  const sources = getUploadedSources()
  if (sources.some(s => s.dataset === 'hospital_survey')) return 'hospital_survey'
  if (sources.some(s => s.dataset === 'app_product')) return 'app_product'
  return null
}

export function clearAll(): void {
  try { localStorage.removeItem(KEY) } catch {}
}

export function getLiveMode(): boolean {
  return localStorage.getItem('veloquity_live_mode') === 'true'
}

export function setLiveMode(enabled: boolean): void {
  localStorage.setItem('veloquity_live_mode', enabled ? 'true' : 'false')
}

// ── Active pipeline sources (source_type strings sent to evidence Lambda) ────

const ACTIVE_SOURCES_KEY = 'veloquity_active_sources'

export function getActiveSources(): string[] {
  try {
    const stored = localStorage.getItem(ACTIVE_SOURCES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function setActiveSources(sources: string[]): void {
  localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(sources))
}

export function addActiveSource(source: string): void {
  const current = getActiveSources()
  if (!current.includes(source)) {
    setActiveSources([...current, source])
  }
}

export function removeActiveSource(source: string): void {
  setActiveSources(getActiveSources().filter(s => s !== source))
}

export function hasActiveSources(): boolean {
  return getActiveSources().length > 0
}

// ── Threshold persistence ─────────────────────────────────────────────────────

const THRESHOLD_KEY = 'veloquity_thresholds'

interface ThresholdState {
  confidenceThreshold: number
  uncertaintyTolerance: number
  minEvidence: number
}

const DEFAULT_THRESHOLDS: ThresholdState = {
  confidenceThreshold: 75,
  uncertaintyTolerance: 15,
  minEvidence: 3,
}

export function getThresholds(): ThresholdState {
  try {
    const stored = localStorage.getItem(THRESHOLD_KEY)
    return stored
      ? { ...DEFAULT_THRESHOLDS, ...JSON.parse(stored) }
      : DEFAULT_THRESHOLDS
  } catch {
    return DEFAULT_THRESHOLDS
  }
}

export function setThresholds(t: Partial<ThresholdState>): void {
  try {
    const current = getThresholds()
    const next = { ...current, ...t }
    localStorage.setItem(THRESHOLD_KEY, JSON.stringify(next))
    window.dispatchEvent(new StorageEvent('storage', {
      key: THRESHOLD_KEY,
      newValue: JSON.stringify(next),
    }))
  } catch {}
}

export function resetThresholds(): void {
  localStorage.removeItem(THRESHOLD_KEY)
  window.dispatchEvent(new StorageEvent('storage', {
    key: THRESHOLD_KEY,
    newValue: JSON.stringify(DEFAULT_THRESHOLDS),
  }))
}
