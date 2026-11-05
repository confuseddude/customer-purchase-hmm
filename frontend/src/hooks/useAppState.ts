import { createContext, useContext } from 'react'
import type { ApiError } from '../services/api'
import type { AnalyzeResponse, ForecastResponse, Health, ModelConfig, ObservationName } from '../types'

// Context + hook live in a module without components so React Fast Refresh never
// duplicates the context object during development hot reloads.

export interface LatestPrediction {
  observations: ObservationName[]
  forecast?: ForecastResponse
  analysis?: AnalyzeResponse
  at: string
}

export interface AppState {
  model: ModelConfig | null
  modelError: ApiError | null
  refreshModel: () => Promise<void>
  setModel: (m: ModelConfig) => void
  modelVersion: number
  health: Health | null
  sequence: ObservationName[]
  setSequence: (s: ObservationName[]) => void
  latest: LatestPrediction | null
  setLatest: (p: LatestPrediction) => void
}

export const AppStateContext = createContext<AppState | null>(null)

export function useAppState(): AppState {
  const v = useContext(AppStateContext)
  if (!v) throw new Error('useAppState must be used inside AppStateProvider')
  return v
}
