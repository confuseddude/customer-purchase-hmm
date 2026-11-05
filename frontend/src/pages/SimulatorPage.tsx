import { ArrowRight, Play, ScanSearch, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { JourneyBuilder } from '../components/Journey'
import { AnalysisView, ForecastView } from '../components/PredictionViews'
import { Button, Callout, Card, ErrorBox, Loading, PageHeader, cx } from '../components/ui'
import { useAppState } from '../hooks/useAppState'
import { useAction } from '../hooks/useAsync'
import { navigate } from '../hooks/useRoute'
import { EXAMPLES } from '../lib/constants'
import { api } from '../services/api'
import type { ObservationName } from '../types'

type Mode = 'forecast' | 'analyze'

export function SimulatorPage() {
  const { sequence, setSequence, setLatest, modelVersion } = useAppState()
  const hasPurchase = sequence.includes('Purchase')
  const [mode, setMode] = useState<Mode>(hasPurchase ? 'analyze' : 'forecast')
  const forecast = useAction(api.forecast)
  const analysis = useAction(api.analyze)
  const [ranFor, setRanFor] = useState<string | null>(null)

  useEffect(() => {
    if (hasPurchase && mode === 'forecast') setMode('analyze')
  }, [hasPurchase, mode])

  const key = `${mode}:${sequence.join(',')}:${modelVersion}`
  const stale = ranFor !== null && ranFor !== key

  const run = async () => {
    setRanFor(key)
    if (mode === 'forecast') {
      const f = await forecast.run(sequence)
      if (f) setLatest({ observations: sequence, forecast: f, at: new Date().toISOString() })
    } else {
      const a = await analysis.run(sequence)
      if (a) setLatest({ observations: sequence, analysis: a, at: new Date().toISOString() })
    }
  }

  const change = (s: ObservationName[]) => setSequence(s)
  const purchaseIdx = sequence.indexOf('Purchase')

  return (
    <div className="space-y-6">
      <PageHeader title="Customer Journey Simulator">
        Build a simulated customer journey by clicking actions in order, then run the Hidden Markov Model. Use <strong className="text-slate-200">Forecast</strong> for an
        unfinished journey (what happens next?) and <strong className="text-slate-200">Analyze</strong> for a completed one (what was the customer thinking?).
      </PageHeader>

      <Card title="Build the journey" subtitle="Click an action to append it. Remove a step with its × button.">
        <JourneyBuilder seq={sequence} onChange={change} />
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {EXAMPLES.map((e) => (
            <button
              key={e.id}
              onClick={() => change([...e.observations])}
              className={cx(
                'rounded-lg border px-3 py-2.5 text-left transition-colors',
                e.observations.join() === sequence.join() ? 'border-accent/60 bg-accent/10' : 'border-ink-700 hover:border-ink-500',
              )}
            >
              <div className="text-[0.8125rem] font-semibold text-slate-200">
                Example {e.id}: {e.name}
              </div>
              <div className="mt-0.5 text-xs text-slate-500">{e.observations.join(' → ')}</div>
              <div className="mt-1 text-xs text-slate-400">{e.story}</div>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Choose what to ask the model">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ModeCard
            active={mode === 'forecast'}
            disabled={hasPurchase}
            onClick={() => setMode('forecast')}
            icon={<TrendingUp className="size-4" />}
            title="Forecast the next action"
            body="Unfinished journey. Computes the filtered intent after the last action and P(next action = Purchase | history)."
          />
          <ModeCard
            active={mode === 'analyze'}
            disabled={sequence.length === 0}
            onClick={() => setMode('analyze')}
            icon={<ScanSearch className="size-4" />}
            title="Analyze a completed journey"
            body="Retrospective. Forward-Backward posteriors and the Viterbi path explain the likely intent at every step."
          />
        </div>
        {hasPurchase && (
          <div className="mt-4">
            <Callout kind="warn" title="Forecasting is disabled: this journey already contains Purchase">
              Predicting “will the next action be Purchase?” after a purchase was already observed would leak the answer into the input (target leakage). Analyze the
              completed journey instead, or forecast from the part before the purchase.
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => change(sequence.slice(0, purchaseIdx))}>
                  Forecast from the prefix before Purchase
                </Button>
              </div>
            </Callout>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="primary" onClick={run} loading={forecast.loading || analysis.loading} disabled={mode === 'analyze' && sequence.length === 0}>
            <Play className="size-4" /> Run HMM
          </Button>
          {stale && <span className="text-xs text-amber-300/90">The journey, mode or model changed. Run again to update the results.</span>}
          {mode === 'forecast' && sequence.length === 0 && (
            <span className="text-xs text-slate-500">With no actions, the forecast uses only the initial distribution π.</span>
          )}
        </div>
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold tracking-[-0.01em] text-white">Results</h2>
        {mode === 'forecast' ? (
          <>
            <ErrorBox error={forecast.error} />
            {forecast.loading && <Loading label="Running the forward algorithm…" />}
            {!forecast.loading && forecast.data && <ForecastView f={forecast.data} />}
            {!forecast.data && !forecast.loading && !forecast.error && <EmptyResults />}
          </>
        ) : (
          <>
            <ErrorBox error={analysis.error} />
            {analysis.loading && <Loading label="Running Forward-Backward and Viterbi…" />}
            {!analysis.loading && analysis.data && <AnalysisView a={analysis.data} />}
            {!analysis.data && !analysis.loading && !analysis.error && <EmptyResults />}
          </>
        )}
        {(forecast.data || analysis.data) && (
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => navigate('/analysis')}>
              Full prediction analysis <ArrowRight className="size-4" />
            </Button>
            <Button variant="ghost" onClick={() => navigate('/lab/forward')}>
              See every calculation in the Algorithm Lab <ArrowRight className="size-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ModeCard({
  active,
  disabled,
  onClick,
  icon,
  title,
  body,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        active ? 'border-accent/70 bg-accent/10' : 'border-ink-700 hover:border-ink-500',
      )}
    >
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span className={active ? 'text-accent-soft' : 'text-slate-500'}>{icon}</span>
        {title}
      </div>
      <p className="mt-1.5 text-[0.8125rem] leading-relaxed text-slate-400">{body}</p>
    </button>
  )
}

function EmptyResults() {
  return (
    <div className="rounded-xl border border-dashed border-ink-600 px-6 py-10 text-center text-sm text-slate-500">
      Press <span className="font-medium text-slate-300">Run HMM</span> to send the journey to the backend.
    </div>
  )
}
