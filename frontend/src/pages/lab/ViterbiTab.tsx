import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { JourneyTimeline, StateChip } from '../../components/Journey'
import { MatrixTable } from '../../components/MatrixTable'
import { StepControls } from '../../components/StepControls'
import { Formula, Tex } from '../../components/Tex'
import { Card } from '../../components/ui'
import { STATE_COLORS, STATE_SHORT } from '../../lib/constants'
import { fmt, tex, texState } from '../../lib/format'
import type { ViterbiResponse } from '../../types'
import { viterbiCellTex } from '../../lib/calcTex'
import { AlgoIntro, CalcLine, ColumnLabel, ResultPanel, StateLabel } from './common'


export function ViterbiTab({ data }: { data: ViterbiResponse }) {
  const T = data.observations.length
  const [step, setStep] = useState(1)
  // steps: 1..T forward columns, T+1 termination, T+2 .. T+1+T backtracking (one state per click)
  const total = 2 * T + 1
  const s = Math.min(step, total)
  const fwdCols = Math.min(s, T)
  const backCount = Math.max(0, s - T - 1) // how many path states recovered
  const recovered = new Set(Array.from({ length: backCount }, (_, k) => T - 1 - k))
  const col = s <= T ? s - 1 : -1
  const delta = STATE_SHORT.map((_, i) => data.delta.map((row) => row[i]))
  const psi = STATE_SHORT.map((_, i) => data.backpointers.map((row) => row[i]))

  const labels = [
    'Not started',
    ...data.steps.map((st) => `t = ${st.t}: ${st.phase}`),
    'Termination: best final state',
    ...data.backtracking.map((b) => `Backtrack t = ${b.t}`),
  ]

  return (
    <div className="space-y-5">
      <AlgoIntro
        what={
          <p>
            Finds the <strong>single most likely complete sequence</strong> of hidden intentions, Q* = argmax<sub>Q</sub> P(Q | O, λ), e.g. Browsing → Interested →
            Ready.
          </p>
        }
        why={
          <p>
            We often want one coherent story of the customer, not a separate distribution at each step. Trying all {3 ** T} paths is exponential. Viterbi is
            dynamic programming: it replaces the Forward algorithm’s <strong>sum</strong> with a <strong>max</strong> and remembers which predecessor won (the
            backpointer ψ), giving O(T·N²).
          </p>
        }
      >
        <Formula
          tex={[
            String.raw`\textbf{Init: } \delta_1(i) = \pi_i\, b_i(O_1), \quad \psi_1(i) = 0`,
            String.raw`\textbf{Recursion: } \delta_t(j) = \max_i \big[\delta_{t-1}(i)\, a_{ij}\big]\, b_j(O_t)`,
            String.raw`\psi_t(j) = \arg\max_i \big[\delta_{t-1}(i)\, a_{ij}\big]`,
            String.raw`\textbf{Termination: } P^* = \max_i \delta_T(i), \quad q_T^* = \arg\max_i \delta_T(i)`,
            String.raw`\textbf{Backtracking: } q_t^* = \psi_{t+1}(q_{t+1}^*)`,
          ]}
          symbols={[
            ['\\delta_t(j)', 'probability of the best path ending in state j at time t'],
            ['\\psi_t(j)', 'backpointer: best previous state for that path'],
            ['P^*', 'joint probability P(O, Q* | λ) of the best path'],
            ['q_t^*', 'state at time t on the optimal path'],
          ]}
        />
      </AlgoIntro>

      <Card title="Step-by-step execution" subtitle="Fill the δ table left to right, then follow the backpointers right to left">
        <div className="space-y-4">
          <StepControls step={s} total={total} onStep={setStep} labels={labels} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-slate-400">Dynamic programming table δ_t(i)</div>
              <MatrixTable
                values={delta}
                rowLabels={STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)}
                colLabels={data.observations.map((o, t) => <ColumnLabel key={t} t={t + 1} obs={o} />)}
                corner="δ_t(i)"
                revealed={(_, c) => c < fwdCols}
                highlight={(r, c) => c === col || (recovered.has(c) && data.path[c] === r) || (s === T + 1 && c === T - 1 && r === data.path[T - 1])}
                normalizeHeat="column"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-slate-400">Backpointer table ψ_t(i)</div>
              <MatrixTable
                values={psi.map((r) => r.map((v) => (v === null ? null : v)))}
                rowLabels={STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)}
                colLabels={data.observations.map((o, t) => <ColumnLabel key={t} t={t + 1} obs={o} />)}
                corner="ψ_t(i)"
                heat={false}
                revealed={(_, c) => c < fwdCols}
                highlight={(r, c) => recovered.has(c - 1) && c > 0 && data.path[c] === r}
                format={(v) => (v === null ? 'n/a' : STATE_SHORT[v])}
              />
            </div>
          </div>

          {col >= 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-300">
                t = {col + 1}: the customer did “{data.observations[col]}”. {col === 0 ? 'Initialization.' : 'For each state keep only the best way of arriving there.'}
              </div>
              {data.steps[col].cells.map((c) => (
                <CalcLine
                  key={`${s}-${c.state}`}
                  color={STATE_COLORS[c.state]}
                  title={
                    <span>
                      δ<sub>{col + 1}</sub>({STATE_SHORT[c.state]}) = <span className="num font-semibold text-white">{fmt(c.value)}</span>
                      {c.best_from !== null && <span className="text-slate-500"> · ψ = {STATE_SHORT[c.best_from]}</span>}
                    </span>
                  }
                  tex={viterbiCellTex(c, col + 1, data.observations[col])}
                />
              ))}
            </div>
          )}
          {s === T + 1 && (
            <div className="rounded-lg border border-ink-700 bg-ink-900/60 px-3.5 py-2">
              <Tex block>
                {String.raw`P^* = \max\{${data.termination.final_delta.map((v) => tex(v)).join(',\\;')}\} = \mathbf{${tex(data.best_probability)}}, \quad q_{${T}}^* = ${texState(data.path[T - 1])}`}
              </Tex>
            </div>
          )}
          {backCount > 0 && (
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-slate-300">Backtracking</div>
              {data.backtracking.slice(0, backCount).map((b) => (
                <div key={b.t} className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
                  <ArrowLeft className="size-3.5 text-slate-600" />
                  <span className="num">q*<sub>{b.t}</sub></span> = <StateChip state={b.state} size="sm" />
                  <span className="num text-xs text-slate-500">via {b.via}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      <ResultPanel title="Final decoded sequence">
        <div className="mb-3">
          <JourneyTimeline seq={data.observations} states={data.path} />
        </div>
        <p>
          Most likely intention path: <strong className="text-white">{data.path_names.join(' → ')}</strong>, with joint probability P(O, Q* | λ) ={' '}
          <span className="num text-white">{fmt(data.best_probability)}</span>.
        </p>
        <p className="mt-2">
          <strong className="text-slate-100">Interpretation:</strong> this is the single best explanation of the journey under the current parameters. It is
          computed, not looked up. Change the sequence or the model and the path updates.
        </p>
      </ResultPanel>
    </div>
  )
}
