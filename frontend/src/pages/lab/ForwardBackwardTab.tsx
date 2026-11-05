import { useState } from 'react'
import { StateProbabilityChart } from '../../charts/Charts'
import { StackedBar } from '../../components/Distribution'
import { JourneyTimeline } from '../../components/Journey'
import { MatrixTable } from '../../components/MatrixTable'
import { StepControls } from '../../components/StepControls'
import { Formula, Tex } from '../../components/Tex'
import { Card, Toggle } from '../../components/ui'
import { STATE_COLORS, STATE_SHORT } from '../../lib/constants'
import { fmt, pct, tex, texState } from '../../lib/format'
import type { ForwardBackwardResponse } from '../../types'
import { AlgoIntro, CalcLine, ColumnLabel, ResultPanel, StateLabel } from './common'

export function ForwardBackwardTab({ data }: { data: ForwardBackwardResponse }) {
  const T = data.observations.length
  const [step, setStep] = useState(1)
  const [showXi, setShowXi] = useState(false)
  const s = Math.min(step, T)
  const item = s > 0 ? data.timeline[s - 1] : null
  const gammaT = STATE_SHORT.map((_, i) => data.gamma.map((row) => row[i]))

  return (
    <div className="space-y-5">
      <AlgoIntro
        what={
          <p>
            Combines Forward (past) and Backward (future) to compute <strong>γ<sub>t</sub>(i) = P(q<sub>t</sub> = i | whole sequence)</strong>: the probability of
            every intention at every step, given everything observed.
          </p>
        }
        why={
          <p>
            It answers: <em>“Given this customer’s entire journey, what was their likely intention at each moment?”</em> Unlike Viterbi it keeps the full
            distribution, so we see uncertainty (e.g. 55% Interested vs 40% Ready). Its γ and ξ quantities are the E-step of Baum-Welch.
          </p>
        }
      >
        <Formula
          tex={[
            String.raw`\gamma_t(i) = P(q_t = i \mid O, \lambda) = \frac{\alpha_t(i)\,\beta_t(i)}{P(O\mid\lambda)} = \frac{\alpha_t(i)\,\beta_t(i)}{\sum_j \alpha_t(j)\,\beta_t(j)}`,
            String.raw`\xi_t(i,j) = \frac{\alpha_t(i)\, a_{ij}\, b_j(O_{t+1})\, \beta_{t+1}(j)}{P(O\mid\lambda)}`,
          ]}
          symbols={[
            ['\\gamma_t(i)', 'posterior probability of state i at time t'],
            ['\\alpha_t(i)\\beta_t(i)', 'prob. of whole sequence AND state i at t'],
            ['P(O\\mid\\lambda)', 'normaliser so each γ_t sums to 1'],
            ['\\xi_t(i,j)', 'posterior prob. of moving i → j between t and t+1'],
          ]}
        />
      </AlgoIntro>

      <Card title="Step-by-step execution" subtitle="At each time step: multiply α by β, then normalise">
        <div className="space-y-4">
          <StepControls step={s} total={T} onStep={setStep} labels={['Not started', ...data.timeline.map((t) => `t = ${t.t} (${t.observation_name})`)]} />
          {item && (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="overflow-x-auto rounded-lg border border-ink-700">
                <table className="w-full text-[0.8125rem]">
                  <thead className="bg-ink-900/70 text-left text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">state</th>
                      <th className="px-3 py-2 font-medium">α_{s}(i)</th>
                      <th className="px-3 py-2 font-medium">β_{s}(i)</th>
                      <th className="px-3 py-2 font-medium">α·β</th>
                      <th className="px-3 py-2 font-medium">γ_{s}(i)</th>
                    </tr>
                  </thead>
                  <tbody className="num">
                    {item.cells.map((c) => (
                      <tr key={c.state} className="border-t border-ink-700/60 text-slate-300">
                        <td className="px-3 py-1.5">
                          <StateLabel i={c.state} />
                        </td>
                        <td className="px-3 py-1.5">{fmt(c.alpha)}</td>
                        <td className="px-3 py-1.5">{fmt(c.beta)}</td>
                        <td className="px-3 py-1.5">{fmt(c.product)}</td>
                        <td className="px-3 py-1.5 font-semibold" style={{ color: STATE_COLORS[c.state] }}>
                          {pct(c.gamma)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-ink-600 text-slate-400">
                      <td className="px-3 py-1.5" colSpan={3}>
                        Σ α·β = P(O | λ)
                      </td>
                      <td className="px-3 py-1.5">{fmt(item.cells.reduce((a, c) => a + c.product, 0))}</td>
                      <td className="px-3 py-1.5">100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="space-y-2">
                {item.cells.map((c) => (
                  <CalcLine
                    key={`${s}-${c.state}`}
                    color={STATE_COLORS[c.state]}
                    title={
                      <span>
                        γ<sub>{s}</sub>({STATE_SHORT[c.state]}) = <span className="num font-semibold text-white">{pct(c.gamma)}</span>
                      </span>
                    }
                    tex={[
                      String.raw`\gamma_{${s}}(${texState(c.state)}) = \frac{\alpha_{${s}}(${texState(c.state)})\,\beta_{${s}}(${texState(c.state)})}{P(O\mid\lambda)} = \frac{${tex(c.alpha)} \times ${tex(c.beta)}}{${tex(data.likelihood)}} = \frac{${tex(c.product)}}{${tex(data.likelihood)}} = \mathbf{${tex(c.gamma)}}`,
                    ]}
                  />
                ))}
                <div className="pt-1">
                  <div className="mb-1 text-xs text-slate-500">Posterior at t = {s}</div>
                  <StackedBar values={item.posterior} height={10} />
                  <div className="mt-1 text-xs text-slate-400">
                    Most likely: <span style={{ color: STATE_COLORS[item.most_likely_state] }}>{item.most_likely_state_name}</span> · online (forward-only) belief was{' '}
                    {item.filtered.map((v, i) => `${STATE_SHORT[i][0]} ${pct(v, 0)}`).join(' / ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Posterior timeline" subtitle="Stacked γ_t: each column sums to 100%">
          <StateProbabilityChart matrix={data.gamma} observations={data.observations} />
        </Card>
        <Card title="Posterior table γ_t(i)" subtitle="Bold = most likely intention at that step">
          <MatrixTable
            values={gammaT}
            rowLabels={STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)}
            colLabels={data.observations.map((o, t) => <ColumnLabel key={t} t={t + 1} obs={o} />)}
            corner="γ_t(i)"
            highlight={(r, c) => data.posterior_path[c] === r}
            normalizeHeat="column"
            format={(v) => (v === null ? 'n/a' : pct(v))}
          />
          <div className="mt-4">
            <JourneyTimeline seq={data.observations} states={data.posterior_path} distributions={data.gamma} />
          </div>
        </Card>
      </div>

      <Card
        title="Transition posteriors ξ_t(i, j)"
        subtitle="Expected transitions used by Baum-Welch"
        action={<Toggle checked={showXi} onChange={setShowXi} label="Show ξ" />}
      >
        {showXi ? (
          T < 2 ? (
            <p className="text-sm text-slate-500">ξ needs at least two observations.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.xi.map((m, t) => (
                <div key={t}>
                  <div className="mb-1 text-xs text-slate-400">
                    ξ<sub>{t + 1}</sub>: {data.observations[t]} → {data.observations[t + 1]}
                  </div>
                  <MatrixTable values={m} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="i \ j" compact format={(v) => (v === null ? 'n/a' : v.toFixed(3))} />
                </div>
              ))}
              <div>
                <div className="mb-1 text-xs text-slate-400">Σ_t ξ_t: expected number of each transition</div>
                <MatrixTable values={data.expected_transitions} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="i \ j" compact format={(v) => (v === null ? 'n/a' : v.toFixed(3))} />
              </div>
            </div>
          )
        ) : (
          <p className="text-sm text-slate-500">
            <Tex>{String.raw`\sum_j \xi_t(i,j) = \gamma_t(i)`}</Tex>. Toggle to inspect the {Math.max(T - 1, 0)} ξ matrices for this sequence.
          </p>
        )}
      </Card>

      <ResultPanel title="Final result">
        <p>
          Posterior intention at each step:{' '}
          {data.timeline.map((t) => `${t.observation_name} → ${STATE_SHORT[t.most_likely_state]} (${pct(t.posterior[t.most_likely_state], 0)})`).join(' · ')}.
        </p>
        <p className="mt-2">
          <strong className="text-slate-100">Interpretation:</strong> these are hindsight beliefs. Later actions can change our belief about an earlier step. For
          example, a Purchase at the end raises the probability that the preceding Cart came from a customer who was already Interested or Ready.
        </p>
      </ResultPanel>
    </div>
  )
}
