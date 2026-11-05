import { useState } from 'react'
import { MatrixTable } from '../../components/MatrixTable'
import { StepControls } from '../../components/StepControls'
import { Formula, Tex } from '../../components/Tex'
import { Card, Toggle } from '../../components/ui'
import { STATE_COLORS, STATE_SHORT } from '../../lib/constants'
import { fmt, tex } from '../../lib/format'
import type { ForwardResponse } from '../../types'
import { forwardCellTex } from '../../lib/calcTex'
import { AlgoIntro, CalcLine, ColumnLabel, ResultPanel, StateLabel } from './common'


export function ForwardTab({ data }: { data: ForwardResponse }) {
  const T = data.observations.length
  const [step, setStep] = useState(1)
  const [showScaled, setShowScaled] = useState(false)
  const [sel, setSel] = useState<[number, number] | null>(null)
  const s = Math.min(step, T + 1)
  const col = Math.min(s, T) - 1 // column currently being explained
  const matrix = (showScaled ? data.alpha_hat : data.alpha)
  const values = STATE_SHORT.map((_, i) => matrix.map((row) => row[i]))

  const labels = [
    'Not started',
    ...data.steps.map((st) => `t = ${st.t}: ${st.phase} (${st.observation_name})`),
    'Termination: P(O | λ)',
  ]
  const selCell = sel ? data.steps[sel[1]].cells[sel[0]] : null

  return (
    <div className="space-y-5">
      <AlgoIntro
        what={
          <p>
            Computes <strong>P(O | λ)</strong>, the probability that the model produces exactly this sequence of customer actions, by summing over
            every possible hidden-intent path at once.
          </p>
        }
        why={
          <p>
            There are N<sup>T</sup> hidden paths ({3}<sup>{T}</sup> = {3 ** T} here). Enumerating them is exponential. The forward variable α stores, for each
            time and state, the total probability of all partial paths ending there, so the work drops to <strong>O(T·N²)</strong>. α is also what we use to
            forecast the next action.
          </p>
        }
      >
        <div className="space-y-3">
          <Formula
            tex={[
              String.raw`\alpha_t(i) = P(O_1,\dots,O_t,\; q_t = i \mid \lambda)`,
              String.raw`\textbf{Init: } \alpha_1(i) = \pi_i\, b_i(O_1)`,
              String.raw`\textbf{Recursion: } \alpha_{t+1}(j) = \Big[\sum_{i=1}^{N} \alpha_t(i)\, a_{ij}\Big]\, b_j(O_{t+1})`,
              String.raw`\textbf{Termination: } P(O \mid \lambda) = \sum_{i=1}^{N} \alpha_T(i)`,
            ]}
            symbols={[
              ['\\alpha_t(i)', 'prob. of the first t actions and being in state i at time t'],
              ['\\pi_i', 'initial probability of state i'],
              ['a_{ij}', 'transition probability from state i to j (A)'],
              ['b_j(O_t)', 'probability that state j emits action O_t (B)'],
              ['N, T', 'number of hidden states (3), length of the sequence'],
              ['\\lambda', 'the model (A, B, π)'],
            ]}
          />
        </div>
      </AlgoIntro>

      <Card
        title="Step-by-step execution"
        subtitle="α table: rows are hidden states, columns are time steps. Click any revealed cell to see its full calculation."
        action={<Toggle checked={showScaled} onChange={setShowScaled} label="Show scaled α̂ (filtered)" />}
      >
        <div className="space-y-4">
          <StepControls step={s} total={T + 1} onStep={setStep} labels={labels} />
          <MatrixTable
            values={values}
            rowLabels={STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)}
            colLabels={data.observations.map((o, t) => <ColumnLabel key={t} t={t + 1} obs={o} />)}
            corner={showScaled ? 'α̂_t(i)' : 'α_t(i)'}
            revealed={(_, c) => c < s}
            highlight={(_, c) => c === col && s <= T}
            normalizeHeat="column"
            onCellClick={(r, c) => setSel([r, c])}
            selected={sel}
          />
          {showScaled && (
            <p className="text-xs text-slate-500">
              Scaled values α̂_t(i) = α_t(i) / Σ_k α_t(k) are the filtered beliefs P(q_t = i | O₁…O_t). The backend computes with these scaled values (Rabiner
              scaling) so long sequences never underflow; log P(O | λ) = Σ_t log c_t.
            </p>
          )}

          {s >= 1 && s <= T && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">
                {s === 1 ? 'Initialization' : 'Recursion'} at t = {s}: the customer did “{data.observations[col]}”
              </div>
              {data.steps[col].cells.map((c) => (
                <CalcLine
                  key={`${s}-${c.state}`}
                  color={STATE_COLORS[c.state]}
                  title={
                    <span>
                      α<sub>{s}</sub>({STATE_SHORT[c.state]}) = <span className="num font-semibold text-white">{fmt(c.value)}</span>
                    </span>
                  }
                  tex={forwardCellTex(c, s, data.observations[col])}
                />
              ))}
            </div>
          )}
          {s === T + 1 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">Termination: sum the last column</div>
              <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-3.5 py-2">
                <Tex block>{String.raw`P(O \mid \lambda) = \sum_i \alpha_{${T}}(i) = ${data.termination.terms.map((v) => tex(v)).join(' + ')} = \mathbf{${tex(data.likelihood)}}`}</Tex>
              </div>
            </div>
          )}
          {selCell && sel && (
            <div className="rounded-lg border border-accent/40 bg-accent/[0.05] px-3.5 py-2">
              <div className="mb-1 text-xs text-accent-soft">Selected cell: α_{sel[1] + 1}({STATE_SHORT[sel[0]]})</div>
              {forwardCellTex(selCell, sel[1] + 1, data.observations[sel[1]]).map((t, k) => (
                <Tex key={k} block>
                  {t}
                </Tex>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ResultPanel title="Final result">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span>
            P(O | λ) = <span className="num text-lg text-white">{fmt(data.likelihood)}</span>
          </span>
          <span>
            log P(O | λ) = <span className="num text-white">{data.log_likelihood?.toFixed(4) ?? '−∞'}</span>
          </span>
        </div>
        <p className="mt-2">
          <strong className="text-slate-100">Interpretation:</strong> out of every possible sequence of {T} actions, this model would generate exactly{' '}
          <em>{data.observations.join(' → ')}</em> with probability {fmt(data.likelihood)}. Any specific sequence is unlikely, so this number is mainly useful
          for <strong>comparing</strong> sequences or models: training (MLE / Baum-Welch) chooses λ to make the observed data's likelihood as large as possible.
          The last column, normalised, is the customer's current intent: {data.alpha_hat[T - 1].map((v, i) => `${STATE_SHORT[i]} ${(v * 100).toFixed(1)}%`).join(', ')}.
        </p>
        {data.impossible && <p className="mt-2 text-amber-300">This sequence has zero probability under the current model.</p>}
      </ResultPanel>
    </div>
  )
}
