import { useState } from 'react'
import { MatrixTable } from '../../components/MatrixTable'
import { StepControls } from '../../components/StepControls'
import { Formula, Tex } from '../../components/Tex'
import { Card } from '../../components/ui'
import { STATE_COLORS, STATE_SHORT } from '../../lib/constants'
import { fmt, tex, texObs } from '../../lib/format'
import type { BackwardResponse } from '../../types'
import { backwardCellTex } from '../../lib/calcTex'
import { AlgoIntro, CalcLine, ColumnLabel, ResultPanel, StateLabel } from './common'


export function BackwardTab({ data }: { data: BackwardResponse }) {
  const T = data.observations.length
  const [step, setStep] = useState(1)
  const s = Math.min(step, T + 1)
  // steps[] are ordered t = T .. 1; step k reveals columns T-1 .. T-k (0-based)
  const revealedFrom = T - Math.min(s, T)
  const currentCol = s <= T ? T - s : -1
  const values = STATE_SHORT.map((_, i) => data.beta.map((row) => row[i]))
  const labels = ['Not started', ...data.steps.map((st) => `t = ${st.t}: ${st.phase}`), 'Termination check']

  return (
    <div className="space-y-5">
      <AlgoIntro
        what={
          <p>
            Computes β<sub>t</sub>(i): the probability of all <strong>future</strong> actions after time t, assuming the customer is in state i at time t. It runs
            from the last action back to the first.
          </p>
        }
        why={
          <p>
            α summarises the past; β summarises the future. Combining them (Forward-Backward) gives the probability of each intention at each step using the{' '}
            <strong>entire</strong> journey. Baum-Welch needs both to re-estimate the parameters. It also gives a second, independent route to P(O | λ), which is a
            useful correctness check.
          </p>
        }
      >
        <Formula
          tex={[
            String.raw`\beta_t(i) = P(O_{t+1},\dots,O_T \mid q_t = i,\, \lambda)`,
            String.raw`\textbf{Init: } \beta_T(i) = 1`,
            String.raw`\textbf{Recursion: } \beta_t(i) = \sum_{j=1}^{N} a_{ij}\, b_j(O_{t+1})\, \beta_{t+1}(j)`,
            String.raw`\textbf{Check: } P(O\mid\lambda) = \sum_i \pi_i\, b_i(O_1)\, \beta_1(i)`,
          ]}
          symbols={[
            ['\\beta_t(i)', 'prob. of the remaining actions given state i at time t'],
            ['a_{ij}', 'move from i now to j next'],
            ['b_j(O_{t+1})', 'state j explains the next action'],
            ['\\beta_{t+1}(j)', 'everything after that, already computed'],
          ]}
        />
      </AlgoIntro>

      <Card title="Step-by-step execution (right to left)" subtitle="β table. The last column is initialised to 1, then each earlier column is computed from the one to its right.">
        <div className="space-y-4">
          <StepControls step={s} total={T + 1} onStep={setStep} labels={labels} />
          <MatrixTable
            values={values}
            rowLabels={STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)}
            colLabels={data.observations.map((o, t) => <ColumnLabel key={t} t={t + 1} obs={o} />)}
            corner="β_t(i)"
            revealed={(_, c) => s > 0 && c >= revealedFrom}
            highlight={(_, c) => c === currentCol}
            normalizeHeat="column"
          />
          {s >= 1 && s <= T && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">
                t = {data.steps[s - 1].t}
                {data.steps[s - 1].next_observation_name && <> · uses the next action “{data.steps[s - 1].next_observation_name}”</>}
              </div>
              {data.steps[s - 1].cells.map((c) => (
                <CalcLine
                  key={`${s}-${c.state}`}
                  color={STATE_COLORS[c.state]}
                  title={
                    <span>
                      β<sub>{data.steps[s - 1].t}</sub>({STATE_SHORT[c.state]}) = <span className="num font-semibold text-white">{fmt(c.value)}</span>
                    </span>
                  }
                  tex={backwardCellTex(data.steps[s - 1], c.state)}
                />
              ))}
            </div>
          )}
          {s === T + 1 && (
            <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-3.5 py-2">
              <Tex block>
                {String.raw`P(O\mid\lambda) = \sum_i \pi_i\, b_i(${texObs(data.observations[0])})\, \beta_1(i) = ${data.termination.terms
                  .map((t) => `${tex(t.pi)}\\times${tex(t.emission)}\\times${tex(t.beta)}`)
                  .join(' + ')} = \mathbf{${tex(data.likelihood)}}`}
              </Tex>
            </div>
          )}
        </div>
      </Card>

      <ResultPanel title="Final result">
        <p>
          Backward route: P(O | λ) = <span className="num text-white">{fmt(data.likelihood)}</span> (log ={' '}
          <span className="num text-white">{data.log_likelihood?.toFixed(4) ?? '−∞'}</span>). This matches the Forward algorithm, as it must.
        </p>
        <p className="mt-2">
          <strong className="text-slate-100">Interpretation:</strong> β<sub>1</sub> says how well each starting intention explains the rest of the journey:{' '}
          {data.beta[0].map((v, i) => `${STATE_SHORT[i]} ${fmt(v)}`).join(', ')}. A larger value means the future actions are more consistent with that state.
        </p>
      </ResultPanel>
    </div>
  )
}
