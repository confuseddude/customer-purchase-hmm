import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DEFAULT_SEQUENCE } from '../lib/constants'
import { api, ApiError } from '../services/api'
import type { Health, ModelConfig, ObservationName } from '../types'
import { AppStateContext, type LatestPrediction } from './useAppState'

const SEQ_KEY = 'hmm-lab:sequence'

function loadSequence(): ObservationName[] {
  try {
    const raw = localStorage.getItem(SEQ_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_SEQUENCE
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [model, setModelState] = useState<ModelConfig | null>(null)
  const [modelError, setModelError] = useState<ApiError | null>(null)
  const [modelVersion, setModelVersion] = useState(0)
  const [health, setHealth] = useState<Health | null>(null)
  const [sequence, setSequenceState] = useState<ObservationName[]>(loadSequence)
  const [latest, setLatest] = useState<LatestPrediction | null>(null)

  const setModel = useCallback((m: ModelConfig) => {
    setModelState(m)
    setModelError(null)
    setModelVersion((v) => v + 1)
  }, [])

  const refreshModel = useCallback(async () => {
    try {
      setModel(await api.parameters())
      setHealth(await api.health())
    } catch (e) {
      setModelError(e instanceof ApiError ? e : new ApiError(0, String(e)))
    }
  }, [setModel])

  useEffect(() => {
    refreshModel()
  }, [refreshModel])

  const setSequence = useCallback((s: ObservationName[]) => {
    setSequenceState(s)
    try {
      localStorage.setItem(SEQ_KEY, JSON.stringify(s))
    } catch {
      /* storage unavailable */
    }
  }, [])

  const value = useMemo(
    () => ({ model, modelError, refreshModel, setModel, modelVersion, health, sequence, setSequence, latest, setLatest }),
    [model, modelError, refreshModel, setModel, modelVersion, health, sequence, setSequence, latest],
  )
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
