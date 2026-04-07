export type UploadedSource = {
  source: 'appstore' | 'zendesk' | 'patient_portal' | 'hospital_survey_ticket'
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

export function addUploadedSource(s: UploadedSource): void {
  try {
    const existing = getUploadedSources().filter(x => x.source !== s.source)
    localStorage.setItem(KEY, JSON.stringify([...existing, s]))
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

export function hasSource(source: 'appstore' | 'zendesk' | 'patient_portal' | 'hospital_survey_ticket'): boolean {
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
