import { CompareChart, NextActionChart, PurchaseTrajectoryChart, StateProbabilityChart } from '../charts/Charts'
import { DistributionBars } from '../components/Distribution'
import { IntentTrellis } from '../components/IntentTrellis'
import { JourneyBuilder, SequenceInline, StateChip } from '../components/Journey'
import { MatrixTable } from '../components/MatrixTable'
import { PurchaseGauge } from '../components/PredictionViews'
import { Callout, Card, ErrorBox, Loading, PageHeader, Stat } from '../components/ui'
import { useAppState } from '../hooks/useAppState'
import { useAsync } from '../hooks/useAsync'
import { EXAMPLES, STATE_COLORS, STATE_SHORT } from '../lib/constants'
import { fmt, pct } from '../lib/format'
import { api } from '../services/api'
import { StateLabel } from './lab/common'

export function AnalysisPage() {
  const { sequence, setSequence, modelVersion, setLatest } = useAppState()
  const key = `${sequence.join(',')}:${modelVersion}`
  const purchaseAt = sequence.indexOf('Purchase')
  const forecastSeq = purchaseAt >= 0 ? sequence.slice(0, purchaseAt) : sequence

  const analysis = useAsync(() => api.analyze(sequence), [key], sequence.length > 0)
  const forecast = useAsync(
    () =>
      api.forecast(forecastSeq).then((f) => {
        if (purchaseAt < 0) setLatest({ observations: sequence, forecast: f, at: new Date().toISOString() })
        return f
      }),
    [key],
  )
  const compare = useAsync(
    () =>
      api.compare([
        ...EXAMPLES.map((e) => ({ name: `${e.id}: ${e.name}`, observations: e.observations })),
        { name: 'Current journey', observations: sequence },
      ]),
    [key],
  )

  const a = analysis.data
  const f = forecast.data

  return (
    <div className="space-y-6">
      <PageHeader title="Prediction Analysis">
        A complete report for the current journey: posterior intent over time, the Viterbi-decoded path, next-action probabilities and a comparison against the
        example journeys.
      </PageHeader>

      <Card title="Customer sequence">
        <JourneyBuilder seq={sequence} onChange={setSequence} compact />
      </Card>

      {sequence.length === 0 && (
        <Callout kind="info">The journey is empty. The forecast below uses only the initial distribution π; add actions for a full analysis.</Callout>
      )}
      <ErrorBox error={analysis.error} />
      <ErrorBox error={forecast.error} />

      {(analysis.loading || forecast.loading) && !a && !f && <Loading />}

      {f && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card
            title="Next purchase probability"
            subtitle={
              purchaseAt >= 0 ? (
                <>
                  Leakage-free: computed from <SequenceInline seq={forecastSeq} /> (the actions before the observed Purchase)
                </>
              ) : (
                'P(next action = Purchase | all actions so far)'
              )
            }
          >
            <PurchaseGauge p={f.purchase_probability} floor={f.ceiling.min} ceiling={f.ceiling.max} level={f.interpretation.level} />
            <div className="mt-4 text-sm font-medium text-slate-100">{f.interpretation.headline}</div>
            <div className="mt-5 grid grid-cols-2 gap-x-6">
              <Stat label="Likely next action" value={f.most_likely_next_action_name} hint={pct(f.next_observation_distribution[f.most_likely_next_action])} />
              <Stat
                label="Current intent"
                value={f.most_likely_current_state !== null ? STATE_SHORT[f.most_likely_current_state] : 'Prior'}
                color={f.most_likely_current_state !== null ? STATE_COLORS[f.most_likely_current_state] : undefined}
              />
            </div>
          </Card>
          <Card title="Next-action probabilities" subtitle="P(O_{T+1} = k | history) for every action">
            <NextActionChart distribution={f.next_observation_distribution} observations={f.model.observations} />
            <div className="mt-4 border-t border-ink-700/70 pt-4">
              <div className="mb-2 text-xs text-slate-400">Current (filtered) hidden-state distribution</div>
              <DistributionBars values={f.filtered_distribution ?? f.next_state_distribution} dense />
            </div>
          </Card>
        </div>
      )}

      {a && (
        <>
          <Card title="Viterbi-decoded path and posterior intent" subtitle="Bars show the Forward-Backward posterior at each step, labels show the Viterbi path">
            <IntentTrellis observations={a.observations} beliefs={a.posterior} path={a.viterbi_path} />
            <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
              <Stat label="log P(O | λ)" value={a.log_likelihood.toFixed(4)} />
              <Stat label="Viterbi log P(O, Q*)" value={a.viterbi_log_probability.toFixed(4)} />
              <Stat label="Viterbi = step-wise argmax?" value={a.paths_agree ? 'Yes' : 'No'} hint={a.paths_agree ? 'both methods agree' : 'joint vs marginal decoding differ'} />
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Hidden-state probability over time" subtitle="Online belief (Forward, filtered): uses actions up to t only">
              <StateProbabilityChart matrix={a.filtered} observations={a.observations} variant="line" />
            </Card>
            <Card title="Forward-Backward posterior timeline" subtitle="Hindsight belief: uses the whole journey">
              <StateProbabilityChart matrix={a.posterior} observations={a.observations} />
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="State transition visualization" subtitle="Expected number of transitions Σ_t ξ_t(i, j) in this journey">
              {a.length < 2 ? (
                <p className="text-sm text-slate-500">Needs at least two actions.</p>
              ) : (
                <>
                  <MatrixTable
                    values={a.expected_transitions}
                    rowLabels={STATE_SHORT.map((s, i) => (
                      <StateLabel key={s} i={i} />
                    ))}
                    colLabels={[...STATE_SHORT]}
                    corner="from \ to"
                    format={(v) => (v === null ? 'n/a' : v.toFixed(3))}
                  />
                  <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                    Decoded transitions:
                    {a.viterbi_path.map((s, i) => (
                      <span key={i} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-slate-600">→</span>}
                        <StateChip state={s} size="sm" />
                      </span>
                    ))}
                  </div>
                </>
              )}
            </Card>
            <Card title="Purchase probability before each step" subtitle="Leakage-free forecasts from each prefix">
              <PurchaseTrajectoryChart trajectory={a.prefix_trajectory} ceiling={f?.ceiling.max} />
            </Card>
          </div>
        </>
      )}

      <Card title="Purchase probability across customer journeys" subtitle="P(next = Purchase) for each journey; journeys containing Purchase are evaluated on the prefix before it">
        <ErrorBox error={compare.error} />
        {compare.data ? (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
            <CompareChart
              rows={compare.data.journeys
                .filter((j) => j.purchase_probability !== undefined)
                .map((j) => ({ name: j.name, p: j.purchase_probability!, highlight: j.name === 'Current journey' }))}
            />
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1.5 pr-2 font-medium">journey</th>
                    <th className="py-1.5 pr-2 font-medium">evaluated on</th>
                    <th className="py-1.5 text-right font-medium">P</th>
                  </tr>
                </thead>
                <tbody>
                  {compare.data.journeys.map((j) => (
                    <tr key={j.name} className="border-t border-ink-700/60 align-top text-slate-300">
                      <td className="py-1.5 pr-2">{j.name}</td>
                      <td className="py-1.5 pr-2">
                        {j.error ? <span className="text-red-300">{j.error}</span> : <SequenceInline seq={j.evaluated_prefix ?? []} />}
                      </td>
                      <td className="num py-1.5 text-right">{j.purchase_probability !== undefined ? pct(j.purchase_probability) : 'n/a'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          !compare.error && <Loading />
        )}
      </Card>

      {(a || f) && (
        <Card title="Interpretation">
          <div className="prose-lab space-y-2 text-sm">
            {f && <p>{f.interpretation.summary}</p>}
            {a && <p>{a.summary}</p>}
            {a && f && (
              <p>
                The model’s overall confidence in this journey, log P(O | λ) = {fmt(a.log_likelihood)}, measures how typical the behaviour is under the current
                parameters. Lower values mean the journey is unusual for this model.
              </p>
            )}
            <p className="text-slate-500">All probabilities come from illustrative parameters and simulated data; they are not calibrated real-world conversion rates.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
