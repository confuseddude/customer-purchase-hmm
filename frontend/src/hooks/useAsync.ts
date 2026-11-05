import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../services/api'

export interface AsyncState<T> {
  data: T | null
  error: ApiError | null
  loading: boolean
  reload: () => void
}

/** Runs `fn` whenever `deps` change (and on reload). Stale responses are ignored. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [tick, setTick] = useState(0)
  const callId = useRef(0)

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    const id = ++callId.current
    setLoading(true)
    fn()
      .then((d) => {
        if (id !== callId.current) return
        setData(d)
        setError(null)
      })
      .catch((e: unknown) => {
        if (id !== callId.current) return
        setError(e instanceof ApiError ? e : new ApiError(0, String(e)))
        setData(null)
      })
      .finally(() => {
        if (id === callId.current) setLoading(false)
      })
  }, [...deps, tick, enabled])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}

/** Imperative variant for button-triggered requests. */
export function useAction<A extends unknown[], T>(fn: (...args: A) => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<ApiError | null>(null)
  const [loading, setLoading] = useState(false)
  const run = useCallback(
    async (...args: A) => {
      setLoading(true)
      setError(null)
      try {
        const d = await fn(...args)
        setData(d)
        return d
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError(0, String(e)))
        return null
      } finally {
        setLoading(false)
      }
    },
    [],
  )
  return { data, error, loading, run, setData }
}
