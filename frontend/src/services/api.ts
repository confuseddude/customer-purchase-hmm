import type {
  AnalyzeResponse,
  BackwardResponse,
  BaumWelchResponse,
  CompareResponse,
  DatasetPage,
  DatasetSequence,
  DatasetSummary,
  Experiment,
  ForecastResponse,
  ForwardBackwardResponse,
  ForwardResponse,
  Health,
  JointResponse,
  LikelihoodCurve,
  Matrix,
  MLEResponse,
  ModelConfig,
  SavedConfig,
  ViterbiResponse,
} from '../types'

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''

export class ApiError extends Error {
  status: number
  code?: string
  errors: string[]
  constructor(status: number, message: string, code?: string, errors?: string[]) {
    super(message)
    this.status = status
    this.code = code
    this.errors = errors ?? [message]
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the backend. Is the FastAPI server running on port 8000?', 'network')
  }
  if (!res.ok) {
    let body: { detail?: unknown; code?: string; errors?: string[] } = {}
    try {
      body = await res.json()
    } catch {
      /* non-JSON error */
    }
    let message = `Request failed (${res.status})`
    if (typeof body.detail === 'string') message = body.detail
    else if (Array.isArray(body.detail))
      message = body.detail.map((d: { msg?: string }) => d.msg ?? JSON.stringify(d)).join('; ')
    throw new ApiError(res.status, message, body.code, body.errors)
  }
  return res.json() as Promise<T>
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) })

export interface ParamsOverride {
  pi: number[]
  A: Matrix
  B: Matrix
}

export const api = {
  health: () => request<Health>('/api/health'),
  parameters: () => request<ModelConfig>('/api/model/parameters'),
  saveParameters: (p: ParamsOverride & { name: string }) =>
    request<ModelConfig>('/api/model/parameters', { method: 'PUT', body: JSON.stringify(p) }),
  validateParameters: (p: ParamsOverride & { name: string }) =>
    post<{ valid: boolean; errors: string[] }>('/api/model/validate', p),
  resetParameters: () => post<ModelConfig>('/api/model/reset', {}),
  modelHistory: (limit = 8) => request<SavedConfig[]>(`/api/model/history?limit=${limit}`),

  forward: (observations: string[], params?: ParamsOverride) => post<ForwardResponse>('/api/forward', { observations, params }),
  backward: (observations: string[], params?: ParamsOverride) => post<BackwardResponse>('/api/backward', { observations, params }),
  forwardBackward: (observations: string[], params?: ParamsOverride) =>
    post<ForwardBackwardResponse>('/api/forward-backward', { observations, params }),
  viterbi: (observations: string[], params?: ParamsOverride) => post<ViterbiResponse>('/api/viterbi', { observations, params }),
  forecast: (observations: string[], record = true) => post<ForecastResponse>('/api/predict', { observations, mode: 'forecast', record }),
  analyze: (observations: string[], record = true) => post<AnalyzeResponse>('/api/predict', { observations, mode: 'analyze', record }),
  joint: (observations: string[], states: number[]) => post<JointResponse>('/api/joint', { observations, states }),
  compare: (journeys: { name: string; observations: string[] }[]) => post<CompareResponse>('/api/predict/compare', { journeys }),

  trainMLE: (body: {
    smoothing?: number
    limit?: number | null
    apply?: boolean
    sequences?: { observations: string[]; hidden_states: string[] }[]
  }) => post<MLEResponse>('/api/train/mle', body),
  trainBaumWelch: (body: {
    max_iterations?: number
    tolerance?: number
    pseudocount?: number
    init?: 'current' | 'random'
    seed?: number
    limit?: number | null
    apply?: boolean
    sequences?: string[][]
  }) => post<BaumWelchResponse>('/api/train/baum-welch', body),

  dataset: (q: { behaviour?: string; purchased?: boolean; limit?: number; offset?: number }) => {
    const p = new URLSearchParams()
    if (q.behaviour) p.set('behaviour', q.behaviour)
    if (q.purchased !== undefined) p.set('purchased', String(q.purchased))
    p.set('limit', String(q.limit ?? 25))
    p.set('offset', String(q.offset ?? 0))
    return request<DatasetPage>(`/api/dataset?${p}`)
  },
  datasetItem: (id: number) => request<DatasetSequence>(`/api/dataset/${id}`),
  datasetSummary: () => request<DatasetSummary>('/api/dataset/summary'),
  experiments: (limit = 20) => request<Experiment[]>(`/api/experiments?limit=${limit}`),
  likelihoodCurve: (k: number, n: number) => request<LikelihoodCurve>(`/api/learn/likelihood-curve?k=${k}&n=${n}`),
}
