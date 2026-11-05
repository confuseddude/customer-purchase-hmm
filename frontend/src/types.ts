// Types mirroring the FastAPI responses. Every number shown in the UI comes from these payloads.

export type ObservationName = 'View' | 'Cart' | 'Checkout' | 'Purchase' | 'Exit'
export type Matrix = number[][]

export interface ModelDict {
  states: string[]
  observations: ObservationName[]
  pi: number[]
  A: Matrix
  B: Matrix
}

export interface ModelConfig extends ModelDict {
  id: number
  name: string
  source: string
  created_at: string
  state_descriptions: Record<string, string>
  sums: { pi: number; A: number[]; B: number[] }
  is_default: boolean
  note: string
}

export interface Envelope {
  observations: ObservationName[]
  observation_indices: number[]
  model: ModelDict
}

export interface Term {
  from: number | null
  prev: number
  a: number | null
  product: number
}

export interface ForwardCell {
  state: number
  terms: Term[]
  sum: number
  emission: number
  value: number
  log_value: number | null
  scaled: number
}

export interface ForwardStep {
  t: number
  observation: number
  observation_name: ObservationName
  phase: 'initialization' | 'recursion'
  cells: ForwardCell[]
  column_sum: number
  scale: number
}

export interface ForwardResponse extends Envelope {
  alpha: Matrix
  log_alpha: (number | null)[][]
  alpha_hat: Matrix
  scale_factors: number[]
  likelihood: number
  log_likelihood: number | null
  impossible: boolean
  steps: ForwardStep[]
  termination: { terms: number[]; likelihood: number }
}

export interface BackwardTerm {
  to: number
  a: number
  emission: number
  next: number
  product: number
}

export interface BackwardStep {
  t: number
  observation: number
  observation_name: ObservationName
  next_observation: number | null
  next_observation_name: ObservationName | null
  phase: 'initialization' | 'recursion'
  cells: { state: number; terms: BackwardTerm[]; value: number; log_value: number | null }[]
}

export interface BackwardResponse extends Envelope {
  beta: Matrix
  log_beta: (number | null)[][]
  steps: BackwardStep[]
  termination: {
    terms: { state: number; pi: number; emission: number; beta: number; product: number }[]
    likelihood: number
  }
  likelihood: number
  log_likelihood: number | null
  impossible: boolean
}

export interface FBTimelineItem {
  t: number
  observation: number
  observation_name: ObservationName
  posterior: number[]
  filtered: number[]
  most_likely_state: number
  most_likely_state_name: string
  cells: { state: number; alpha: number; beta: number; product: number; gamma: number }[]
}

export interface ForwardBackwardResponse extends Envelope {
  alpha: Matrix
  beta: Matrix
  gamma: Matrix
  filtered: Matrix
  xi: number[][][]
  expected_transitions: Matrix
  likelihood: number
  log_likelihood: number
  timeline: FBTimelineItem[]
  posterior_path: number[]
}

export interface ViterbiCell {
  state: number
  candidates: Term[]
  best_from: number | null
  max: number
  emission: number
  value: number
  log_value: number | null
}

export interface ViterbiResponse extends Envelope {
  delta: Matrix
  log_delta: (number | null)[][]
  backpointers: (number | null)[][]
  steps: { t: number; observation: number; observation_name: ObservationName; phase: string; cells: ViterbiCell[] }[]
  path: number[]
  path_names: string[]
  best_probability: number
  best_log_probability: number | null
  impossible: boolean
  backtracking: { t: number; state: number; state_name: string; via: string }[]
  termination: { final_delta: number[]; best_last_state: number }
}

export interface TrajectoryPoint {
  t: number
  after: ObservationName | null
  purchase_probability: number
  filtered: number[] | null
}

export interface Interpretation {
  level: 'low' | 'moderate' | 'high' | 'very_high'
  headline: string
  readiness_index: number
  summary: string
  suggested_action: string
}

export interface ForecastResponse extends Envelope {
  mode: 'forecast'
  history_length: number
  filtered_distribution: number[] | null
  most_likely_current_state: number | null
  most_likely_current_state_name: string | null
  next_state_distribution: number[]
  next_observation_distribution: number[]
  most_likely_next_action: number
  most_likely_next_action_name: ObservationName
  purchase_probability: number
  purchase_terms: {
    from: number | null
    to: number
    filtered: number | null
    a: number | null
    next_state: number | null
    emission: number
    product: number
  }[]
  log_likelihood: number
  prefix_trajectory: TrajectoryPoint[]
  ceiling: { per_current_state: number[]; max: number; min: number; first_action: number }
  interpretation: Interpretation
  experiment_id: number
}

export interface AnalyzeResponse extends Envelope {
  mode: 'analyze'
  length: number
  purchased: boolean
  first_purchase_step: number | null
  posterior: Matrix
  filtered: Matrix
  posterior_path: number[]
  viterbi_path: number[]
  viterbi_path_names: string[]
  viterbi_log_probability: number
  log_likelihood: number
  likelihood: number
  expected_transitions: Matrix
  prefix_trajectory: TrajectoryPoint[]
  pre_purchase_probability: number | null
  ready_peak_step: number
  summary: string
  paths_agree: boolean
  experiment_id: number
}

export interface CompareRow {
  name: string
  observations: ObservationName[]
  evaluated_prefix?: ObservationName[]
  truncated_before_purchase?: boolean
  purchase_probability?: number
  most_likely_current_state_name?: string | null
  most_likely_next_action_name?: ObservationName
  next_observation_distribution?: number[]
  filtered_distribution?: number[] | null
  readiness_index?: number
  error?: string
}

export interface CompareResponse {
  model: ModelDict
  journeys: CompareRow[]
}

export interface MLEResponse {
  method: 'supervised_mle'
  source: string
  before: ModelDict
  after: ModelDict
  counts: { pi: number[]; A: Matrix; B: Matrix }
  smoothing: number
  n_sequences: number
  n_observations: number
  n_transitions: number
  log_likelihood_before: number | null
  log_likelihood_after: number | null
  complete_log_likelihood_before: number | null
  complete_log_likelihood_after: number | null
  applied: boolean
}

export interface BaumWelchResponse {
  method: 'baum_welch'
  source: string
  init: string
  before: ModelDict
  after: ModelDict
  history: { iteration: number; log_likelihood: number; improvement: number | null; params: ModelDict }[]
  iterations: number
  converged: boolean
  monotonic: boolean
  tolerance: number
  max_iterations: number
  pseudocount: number
  initial_log_likelihood: number
  final_log_likelihood: number
  n_sequences: number
  n_observations: number
  example_estep: { observations: ObservationName[]; gamma: Matrix; xi: number[][][]; log_likelihood: number }
  applied: boolean
}

export interface DatasetSequence {
  id: number
  customer_id: string
  archetype: string
  behaviour: string
  observations: ObservationName[]
  hidden_states: string[]
  length: number
  purchased: boolean
  ended_with: string
}

export interface DatasetPage {
  total: number
  limit: number
  offset: number
  items: DatasetSequence[]
  note: string
}

export interface DatasetSummary {
  total: number
  purchase_rate: number
  mean_length: number
  behaviours: { behaviour: string; count: number }[]
  actions: { action: ObservationName; count: number }[]
  lengths: { length: number; count: number }[]
  ended_with: { ended_with: string; count: number }[]
}

export interface Health {
  status: string
  active_model: string
  dataset_size: number
  states: number
  observations: number
}

export interface SavedConfig extends Omit<ModelDict, 'states' | 'observations'> {
  id: number
  name: string
  source: string
  created_at: string
  is_active: boolean
}

export interface Experiment {
  id: number
  kind: string
  created_at: string
  input: Record<string, unknown>
  summary: Record<string, unknown>
}

export interface LikelihoodCurve {
  k: number
  n: number
  mle: number
  max_likelihood: number
  curve: { p: number; likelihood: number; log_likelihood: number | null }[]
}

export interface JointResponse extends Envelope {
  states: number[]
  factors: { t: number; kind: 'initial' | 'transition' | 'emission'; symbol: string; value: number }[]
  probability: number
  log_probability: number | null
  viterbi_path: number[]
  viterbi_probability: number
  is_viterbi_path: boolean
}
