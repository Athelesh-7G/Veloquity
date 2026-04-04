// =============================================================
// src/utils/uploadState.ts
// Persists successful CSV upload records to localStorage so
// the "demo data" notice and upload state survive page navigation.
// =============================================================

const STORAGE_KEY = 'veloquity_uploaded_sources'

export interface UploadedSource {
  source: 'appstore' | 'zendesk'
  filename: string
  itemCount: number
  uploadedAt: string
}

export function getUploadedSources(): UploadedSource[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as UploadedSource[]) : []
  } catch {
    return []
  }
}

export function addUploadedSource(source: UploadedSource): void {
  // Replace any existing entry for the same source type
  const current = getUploadedSources().filter((s) => s.source !== source.source)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...current, source]))
  } catch {}
}

export function removeUploadedSource(sourceType: string): void {
  const updated = getUploadedSources().filter((s) => s.source !== sourceType)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch {}
}

export function hasUploadedData(): boolean {
  return getUploadedSources().length > 0
}

export function clearAllUploadedSources(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}
