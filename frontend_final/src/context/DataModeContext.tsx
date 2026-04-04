// =============================================================
// src/context/DataModeContext.tsx
// Global data-mode context: "demo" (seed data) vs "live" (real API).
// Mode is persisted in localStorage. refresh() increments a counter
// that pages can subscribe to for triggering refetches.
// =============================================================

import { createContext, useContext, useState, type ReactNode } from 'react'
import { hasUploadedData } from '@/utils/uploadState'

export type DataMode = 'demo' | 'live'

const DATA_MODE_KEY = 'veloquity_data_mode'

function readStoredMode(): DataMode {
  try {
    const stored = localStorage.getItem(DATA_MODE_KEY) as DataMode | null
    if (stored === 'live' || stored === 'demo') return stored
  } catch {}
  // Default: live if the user has already uploaded data, demo otherwise
  return hasUploadedData() ? 'live' : 'demo'
}

// ─── Context shape ────────────────────────────────────────────────────────────

interface DataModeContextType {
  mode: DataMode
  isLive: boolean
  setLive: () => void
  setDemo: () => void
  refresh: () => void
  refreshCount: number
}

const DataModeContext = createContext<DataModeContextType | undefined>(undefined)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>(readStoredMode)
  const [refreshCount, setRefreshCount] = useState(0)

  function setLive() {
    setModeState('live')
    try { localStorage.setItem(DATA_MODE_KEY, 'live') } catch {}
  }

  function setDemo() {
    setModeState('demo')
    try { localStorage.setItem(DATA_MODE_KEY, 'demo') } catch {}
  }

  function refresh() {
    setRefreshCount((c) => c + 1)
  }

  return (
    <DataModeContext.Provider
      value={{ mode, isLive: mode === 'live', setLive, setDemo, refresh, refreshCount }}
    >
      {children}
    </DataModeContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useDataMode(): DataModeContextType {
  const ctx = useContext(DataModeContext)
  if (!ctx) throw new Error('useDataMode must be used within DataModeProvider')
  return ctx
}

/** Subscribe to global refetch signals without the full mode object. */
export function useRefreshCount(): number {
  return useDataMode().refreshCount
}
