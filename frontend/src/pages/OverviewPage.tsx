import { ArrowRight, BrainCircuit, Eye, FlaskConical, GraduationCap, Play, Sparkles, Target } from 'lucide-react'
import { DistributionBars } from '../components/Distribution'
import { IntentTrellis } from '../components/IntentTrellis'
import { SequenceInline } from '../components/Journey'
import { MatrixTable } from '../components/MatrixTable'
import { PredictionSummary, PurchaseGauge } from '../components/PredictionViews'
import { Button, Card, ErrorBox, Loading, PageHeader } from '../components/ui'
import { useAppState } from '../hooks/useAppState'
import { useAsync } from '../hooks/useAsync'
import { navigate } from '../hooks/useRoute'
import { STATE_SHORT } from '../lib/constants'
import { fixed } from '../lib/format'
import { api } from '../services/api'

const PIPELINE = [
  { icon: Eye, title: 'Customer actions', body: 'View, Cart, Checkout, Purchase, Exit: the only thing we can observe.' },
  { icon: BrainCircuit, title: 'Hidden Markov Model', body: 'λ = (A, B, π) links hidden intent to observable behaviour.' },
  { icon: Sparkles, title: 'Hidden intent', body: 'Forward, Forward-Backward and Viterbi infer Browsing, Interested or Ready.' },
  { icon: Target, title: 'Purchase prediction', body: 'P(next action = Purchase | history), computed as a real conditional probability.' },
]

const two = (v: number | null) => fixed(v, 2)

function CurrentJourney() {
  const { sequence, modelVersion } = useAppState()
  const key = `${sequence.join(',')}:${modelVersion}`
  const purchaseAt = sequence.indexOf('Purchase')
  const prefix = purchaseAt >= 0 ? sequence.slice(0, purchaseAt) : sequence
  // record = false: opening this page is not an experiment.
  const analysis = useAsync(() => api.analyze(sequence, false), [key], sequence.length > 0)
  const forecast = useAsync(() => api.forecast(prefix, false), [key])
  const a = analysis.data
  const f = forecast.data

  return (
    <Card
      title="Current journey, as the model reads it"
      subtitle="Bars show the hidden-state posterior at each step, labels show the Viterbi path"
      action={
        <Button size="sm" variant="ghost" onClick={() => navigate('/simulator')}>
          Edit journey
        </Button>
      }
    >
      <ErrorBox error={analysis.error ?? forecast.error} />
      {sequence.length === 0 ? (
        <p className="py-6 text-sm text-slate-400">The journey is empty. Open the Customer Simulator and add an action to see the model infer intent.</p>
      ) : a && f ? (
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <IntentTrellis observations={a.observations} beliefs={a.posterior} path={a.viterbi_path} />
          <div className="border-t border-ink-700 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <PurchaseGauge p={f.purchase_probability} floor={f.ceiling.min} ceiling={f.ceiling.max} level={f.interpretation.level} />
            <p className="mt-4 text-[0.8125rem] leading-relaxed text-slate-400">
              {purchaseAt >= 0
                ? `Forecast from the ${prefix.length} action${prefix.length === 1 ? '' : 's'} before the Purchase, so the answer never leaks into the input.`
                : f.interpretation.headline}
            </p>
          </div>
        </div>
      ) : (
        !analysis.error && !forecast.error && <Loading />
      )}
    </Card>
  )
}

export function OverviewPage() {
  const { model, latest, health } = useAppState()
  const experiments = useAsync(() => api.experiments(6), [latest?.at])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Customer Purchase Likelihood Prediction using Hidden Markov Models"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/learn/1')}>
              <GraduationCap className="size-4" /> Learn the project
            </Button>
            <Button variant="primary" onClick={() => navigate('/simulator')}>
              <Play className="size-4" /> Start an experiment
            </Button>
          </>
        }
      >
        E-commerce platforms see what customers <em>do</em>, not what they <em>intend</em>. This lab models intention as a hidden state, infers it from the
        sequence of actions with a Hidden Markov Model implemented from scratch in NumPy, and estimates how likely the customer is to purchase next.
      </PageHeader>

      <CurrentJourney />

      <ol className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
        {PIPELINE.map((p, i) => (
          <li key={p.title} className="border-t border-ink-700 pt-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
              <p.icon className="size-4 text-accent-soft" />
              {p.title}
              {i < PIPELINE.length - 1 && <ArrowRight className="ml-auto hidden size-4 text-slate-500 lg:block" />}
            </div>
            <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate-400">{p.body}</p>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card
          title="Current model parameters λ = (A, B, π)"
          subtitle={
            model
              ? `${model.states.length} hidden states, ${model.observations.length} observation types. Active model: ${model.name}. Illustrative, simulated values.`
              : 'Illustrative, simulated values.'
          }
          action={
            <Button size="sm" variant="ghost" onClick={() => navigate('/config')}>
              Edit
            </Button>
          }
        >
          {!model ? (
            <Loading label="Loading parameters…" />
          ) : (
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[0.8125rem] font-medium text-slate-300">π: initial state distribution</div>
                <DistributionBars values={model.pi} dense highlightMax={false} />
              </div>
              <div>
                <div className="mb-1 text-[0.8125rem] font-medium text-slate-300">A: transition matrix (row = from, column = to)</div>
                <MatrixTable values={model.A} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="from \ to" compact format={two} />
              </div>
              <div>
                <div className="mb-1 text-[0.8125rem] font-medium text-slate-300">B: emission matrix (row = hidden state, column = observed action)</div>
                <MatrixTable values={model.B} rowLabels={[...STATE_SHORT]} colLabels={model.observations} corner="state \ action" compact format={two} />
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card title="Latest prediction" subtitle={latest ? new Date(latest.at).toLocaleTimeString() : undefined}>
            {latest ? (
              <div className="space-y-3">
                <SequenceInline seq={latest.observations} />
                <PredictionSummary forecast={latest.forecast} analysis={latest.analysis} />
                <Button size="sm" variant="ghost" onClick={() => navigate('/analysis')}>
                  Open full analysis <ArrowRight className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div className="text-sm text-slate-400">
                No prediction in this session yet.
                <div className="mt-3">
                  <Button size="sm" variant="secondary" onClick={() => navigate('/simulator')}>
                    <FlaskConical className="size-3.5" /> Run the HMM on a journey
                  </Button>
                </div>
              </div>
            )}
          </Card>
          <Card title="Recent experiments" subtitle={health ? `Stored in SQLite by the backend, next to ${health.dataset_size} simulated sequences` : 'Stored in SQLite by the backend'}>
            {experiments.loading && !experiments.data ? (
              <Loading />
            ) : experiments.data && experiments.data.length ? (
              <ul className="divide-y divide-ink-700 text-[0.8125rem]">
                {experiments.data.map((e) => (
                  <li key={e.id} className="flex items-baseline justify-between gap-4 py-2">
                    <span className="shrink-0 text-slate-300">{e.kind}</span>
                    <span className="min-w-0 truncate text-right text-slate-400">{summarise(e.summary)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">No experiments recorded yet. Run the HMM in the Customer Simulator to log the first one.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function summarise(s: Record<string, unknown>): string {
  if (typeof s.purchase_probability === 'number') return `P(Purchase next) = ${(s.purchase_probability * 100).toFixed(1)}%`
  if (Array.isArray(s.viterbi_path)) return (s.viterbi_path as string[]).map((x) => x.split(' ')[0]).join(' → ')
  if (typeof s.final_ll === 'number') return `${s.iterations} iterations, log L ${Number(s.initial_ll).toFixed(1)} → ${s.final_ll.toFixed(1)}`
  if (typeof s.log_likelihood_after === 'number') return `${s.n_sequences} sequences, log L ${s.log_likelihood_after.toFixed(1)}`
  return ''
}
