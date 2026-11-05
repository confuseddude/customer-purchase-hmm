import { ChevronDown, Target } from 'lucide-react'
import { useState } from 'react'
import { NextActionChart, PurchaseTrajectoryChart } from '../charts/Charts'
import { STATE_COLORS, STATE_SYMBOL } from '../lib/constants'
import { pct } from '../lib/format'
import type { AnalyzeResponse, ForecastResponse } from '../types'
import { DistributionBars } from './Distribution'
import { IntentTrellis } from './IntentTrellis'
import { ObsChip, StateChip } from './Journey'
import { Tex } from './Tex'
import { Card, Callout, Stat } from './ui'

const LEVEL_COLOR: Record<string, string> = {
  low: '#8894b0',
  moderate: '#fbbf24',
  high: '#60d5a5',
  very_high: '#34d399',
}

/** Number first, then where it sits between the lowest and highest values this model can produce. */
export function PurchaseGauge({ p, floor, ceiling, level }: { p: number; floor: number; ceiling: number; level: string }) {
  const frac = Math.min(1, Math.max(0, (p - floor) / Math.max(ceiling - floor, 1e-9)))
  const color = LEVEL_COLOR[level] ?? '#7c8cff'
  return (
    <div className="w-full">
      <div className="text-[2.75rem] leading-none font-medium tracking-[-0.02em] text-white tabular-nums">
        {(p * 100).toFixed(1)}
        <span className="ml-1 text-2xl text-slate-400">%</span>
      </div>
      <div className="mt-2 text-[0.8125rem] text-slate-400">P(next action = Purchase)</div>
      <div className="relative mt-5 h-4" role="img" aria-label={`${pct(frac, 0)} of the way from the model minimum to the model maximum`}>
        <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ink-600" />
        <div className="absolute top-1/2 left-0 h-0.5 -translate-y-1/2 rounded-full transition-[width] duration-300 ease-out" style={{ width: `${frac * 100}%`, backgroundColor: color }} />
        <div className="absolute top-0 h-4 w-1 -translate-x-1/2 rounded-[2px] transition-[left] duration-300 ease-out" style={{ left: `${frac * 100}%`, backgroundColor: color }} />
      </div>
      <div className="mt-1 flex justify-between gap-3 text-xs whitespace-nowrap text-slate-500">
        <span>
          Model min <span className="num text-slate-400">{pct(floor)}</span>
        </span>
        <span>
          Model max <span className="num text-slate-400">{pct(ceiling)}</span>
        </span>
      </div>
    </div>
  )
}

export function ForecastView({ f }: { f: ForecastResponse }) {
  const [showCalc, setShowCalc] = useState(false)
  const T = f.history_length
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card title="Purchase likelihood" subtitle="Genuine conditional probability from the forward algorithm">
          <PurchaseGauge p={f.purchase_probability} floor={f.ceiling.min} ceiling={f.ceiling.max} level={f.interpretation.level} />
          <div className="mt-4 text-sm font-medium text-slate-100">{f.interpretation.headline}</div>
          <div className="mt-0.5 text-[0.8125rem] text-slate-400">
            Readiness index <span className="num text-slate-200">{pct(f.interpretation.readiness_index, 0)}</span> of the model's range
          </div>
          <div className="mt-5 grid grid-cols-2 gap-x-6">
            <Stat
              label="Current intent"
              value={f.most_likely_current_state_name ? (f.most_likely_current_state_name === 'Ready to Purchase' ? 'Ready' : f.most_likely_current_state_name) : 'Prior'}
              color={f.most_likely_current_state !== null ? STATE_COLORS[f.most_likely_current_state] : undefined}
              hint={f.filtered_distribution && f.most_likely_current_state !== null ? pct(f.filtered_distribution[f.most_likely_current_state]) : 'no history yet'}
            />
            <Stat
              label="Likely next action"
              value={f.most_likely_next_action_name}
              hint={pct(f.next_observation_distribution[f.most_likely_next_action])}
            />
          </div>
        </Card>

        <Card title="Hidden-state distribution" subtitle={T ? `Filtered: P(q_t | O₁…O_${T}) after the last action` : 'No actions yet: the prior π is used'}>
          <DistributionBars values={f.filtered_distribution ?? f.next_state_distribution} />
          <div className="mt-5 border-t border-ink-700/70 pt-4">
            <div className="mb-2 text-[0.8125rem] font-medium text-slate-400">Predicted state at the next step, P(q_{T + 1} | history)</div>
            <DistributionBars values={f.next_state_distribution} dense />
          </div>
          <div className="mt-5 border-t border-ink-700/70 pt-4">
            <div className="mb-1 text-[0.8125rem] font-medium text-slate-400">Next-action distribution</div>
            <NextActionChart distribution={f.next_observation_distribution} observations={f.model.observations} height={170} />
          </div>
        </Card>
      </div>

      <Card
        title="How this number was computed"
        subtitle="Every term below is returned by the backend"
        action={
          <button className="flex items-center gap-1 text-xs text-accent-soft hover:text-white" onClick={() => setShowCalc((s) => !s)}>
            {showCalc ? 'Hide' : 'Show'} calculation <ChevronDown className={`size-3.5 transition-transform ${showCalc ? 'rotate-180' : ''}`} />
          </button>
        }
      >
        <Tex block>
          {T
            ? String.raw`P(O_{t+1}=\text{Purchase}\mid O_{1:t}) = \sum_i \sum_j \frac{\alpha_t(i)}{\sum_k \alpha_t(k)}\, a_{ij}\, b_j(\text{Purchase})`
            : String.raw`P(O_{1}=\text{Purchase}) = \sum_j \pi_j\, b_j(\text{Purchase})`}
        </Tex>
        {showCalc && (
          <div className="mt-4 space-y-3 animate-fade-up">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.8125rem]">
                <thead>
                  <tr className="text-left text-slate-500">
                    {T > 0 && <th className="px-2 py-1.5 font-medium">current i</th>}
                    <th className="px-2 py-1.5 font-medium">next j</th>
                    <th className="px-2 py-1.5 font-medium">{T ? 'filtered(i)' : 'π_j'}</th>
                    {T > 0 && <th className="px-2 py-1.5 font-medium">a_ij</th>}
                    <th className="px-2 py-1.5 font-medium">b_j(Purchase)</th>
                    <th className="px-2 py-1.5 text-right font-medium">product</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {f.purchase_terms.map((t, k) => (
                    <tr key={k} className="border-t border-ink-700/50 text-slate-300">
                      {T > 0 && <td className="px-2 py-1" style={{ color: STATE_COLORS[t.from ?? 0] }}>{STATE_SYMBOL[t.from ?? 0]}</td>}
                      <td className="px-2 py-1" style={{ color: STATE_COLORS[t.to] }}>{STATE_SYMBOL[t.to]}</td>
                      <td className="px-2 py-1">{(t.filtered ?? t.next_state ?? 0).toFixed(4)}</td>
                      {T > 0 && <td className="px-2 py-1">{t.a?.toFixed(2)}</td>}
                      <td className="px-2 py-1">{t.emission.toFixed(2)}</td>
                      <td className="px-2 py-1 text-right">{t.product.toFixed(5)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-ink-600 font-semibold text-white">
                    <td className="px-2 py-1.5" colSpan={T ? 5 : 3}>
                      Sum = P(Purchase next)
                    </td>
                    <td className="px-2 py-1.5 text-right">{f.purchase_probability.toFixed(5)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              B = Browsing, I = Interested, R = Ready to Purchase. The filtered distribution is α_T normalised to sum to 1. log P(O₁…O_T | λ) ={' '}
              <span className="num">{f.log_likelihood.toFixed(4)}</span>.
            </p>
          </div>
        )}
      </Card>

      {f.prefix_trajectory.length > 1 && (
        <Card title="Purchase probability as the journey unfolds" subtitle="Each point uses only the actions observed up to that moment (no target leakage)">
          <PurchaseTrajectoryChart trajectory={f.prefix_trajectory} ceiling={f.ceiling.max} />
        </Card>
      )}

      <Callout kind="tip" title="Interpretation">
        <p>{f.interpretation.summary}</p>
        <p className="mt-2 text-slate-400">
          <Target className="mr-1 inline size-3.5" />
          {f.interpretation.suggested_action}
        </p>
      </Callout>
    </div>
  )
}

export function AnalysisView({ a }: { a: AnalyzeResponse }) {
  return (
    <div className="space-y-5">
      <Card title="Decoded customer journey" subtitle="Bars show the Forward-Backward posterior at each step, labels show the Viterbi path">
        <IntentTrellis observations={a.observations} beliefs={a.posterior} path={a.viterbi_path} />
        {!a.paths_agree && (
          <p className="mt-2 text-xs text-amber-300/90">
            The Viterbi path differs from the step-wise most probable states, which is possible because Viterbi optimises the whole path jointly.
          </p>
        )}
      </Card>
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="log P(O | λ)" value={a.log_likelihood.toFixed(3)} hint={`P = ${a.likelihood.toExponential(3)}`} />
        <Stat label="Purchased" value={a.purchased ? `Yes (t=${a.first_purchase_step})` : 'No'} />
        <Stat
          label="Pre-purchase forecast"
          value={a.pre_purchase_probability !== null ? pct(a.pre_purchase_probability) : 'n/a'}
          hint={a.pre_purchase_probability !== null ? 'P(Purchase next) just before buying' : 'no purchase in journey'}
        />
        <Stat label="Peak readiness" value={`t = ${a.ready_peak_step}`} hint={`max P(Ready) = ${pct(Math.max(...a.posterior.map((g) => g[2])))}`} />
      </div>
      {a.prefix_trajectory.length > 1 && (
        <Card title="Leakage-free purchase forecast before each step" subtitle="Forecasts use only prefixes that end before the first Purchase">
          <PurchaseTrajectoryChart trajectory={a.prefix_trajectory} />
        </Card>
      )}
      <Callout kind="tip" title="Interpretation">
        {a.summary}
      </Callout>
    </div>
  )
}

/** Compact one-line summary used on the dashboard. */
export function PredictionSummary({ forecast, analysis }: { forecast?: ForecastResponse; analysis?: AnalyzeResponse }) {
  if (forecast)
    return (
      <div className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="num text-3xl font-medium text-white">{pct(forecast.purchase_probability)}</span>
          <span className="text-sm text-slate-400">chance the next action is Purchase</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
          Current intent
          {forecast.most_likely_current_state !== null ? (
            <StateChip state={forecast.most_likely_current_state} size="sm" />
          ) : (
            <span>prior</span>
          )}
          · likely next <ObsChip name={forecast.most_likely_next_action_name} size="sm" />
        </div>
        <div className="text-[0.8125rem] text-slate-300">
          {forecast.interpretation.headline}
        </div>
      </div>
    )
  if (analysis)
    return (
      <div className="space-y-2 text-sm text-slate-400">
        <div className="flex flex-wrap items-center gap-1.5">
          {analysis.viterbi_path.map((s, i) => (
            <StateChip key={i} state={s} size="sm" />
          ))}
        </div>
        <div>
          Completed journey · log-likelihood <span className="num text-slate-200">{analysis.log_likelihood.toFixed(3)}</span>
          {analysis.pre_purchase_probability !== null && (
            <>
              {' '}
              · pre-purchase forecast <span className="num text-slate-200">{pct(analysis.pre_purchase_probability)}</span>
            </>
          )}
        </div>
      </div>
    )
  return null
}
