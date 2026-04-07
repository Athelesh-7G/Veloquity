export type UploadedSource = {
  source: 'appstore' | 'zendesk'
  filename: string
  rowCount: number
  uploadedAt: string
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

export function hasSource(source: 'appstore' | 'zendesk'): boolean {
  return getUploadedSources().some(x => x.source === source)
}

export function clearAll(): void {
  try { localStorage.removeItem(KEY) } catch {}
}
