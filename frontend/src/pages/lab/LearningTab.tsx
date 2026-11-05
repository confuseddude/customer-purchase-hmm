import { ArrowRight, Play } from 'lucide-react'
import { useState } from 'react'
import { LikelihoodChart } from '../../charts/Charts'
import { SequenceInline, StateChip } from '../../components/Journey'
import { MatrixTable } from '../../components/MatrixTable'
import { StepControls } from '../../components/StepControls'
import { Formula, Tex } from '../../components/Tex'
import { Button, Card, ErrorBox, Field, inputCls } from '../../components/ui'
import { useAction } from '../../hooks/useAsync'
import { navigate } from '../../hooks/useRoute'
import { EXAMPLES, LABELLED_EXAMPLE, STATE_SHORT } from '../../lib/constants'
import { fmt } from '../../lib/format'
import { api } from '../../services/api'
import type { ObservationName } from '../../types'
import { AlgoIntro, ResultPanel, StateLabel } from './common'


const fmt3 = (v: number | null) => (v === null ? 'n/a' : v.toFixed(3))

export function LearningTab({ sequence }: { sequence: ObservationName[] }) {
  const [smoothing, setSmoothing] = useState(0)
  const mle = useAction(api.trainMLE)
  const bw = useAction(api.trainBaumWelch)
  const [iter, setIter] = useState(0)
  const bwSeqs = [...(sequence.length ? [sequence] : []), ...EXAMPLES.map((e) => e.observations)]

  const runBW = async () => {
    const r = await bw.run({ sequences: bwSeqs, max_iterations: 25, tolerance: 1e-6, init: 'current' })
    if (r) setIter(1)
  }
  const h = bw.data ? bw.data.history[Math.min(iter, bw.data.history.length - 1)] : null

  return (
    <div className="space-y-5">
      <AlgoIntro
        what={
          <p>
            <strong>Maximum Likelihood Estimation</strong> chooses the parameters λ = (A, B, π) that make the observed customer sequences as probable as possible:
            λ̂ = argmax<sub>λ</sub> P(O | λ). With hidden-state labels this is just counting. Without labels we use <strong>Baum-Welch</strong>, the
            Expectation-Maximization (EM) algorithm for HMMs.
          </p>
        }
        why={
          <p>
            The illustrative numbers are guesses. Training adapts them to data. Baum-Welch is needed because real logs never tell us the intention; it uses
            Forward-Backward to compute <em>expected</em> counts (E-step), re-estimates λ from them (M-step), and repeats. Each iteration never decreases the
            likelihood.
          </p>
        }
      >
        <Formula
          tex={[
            String.raw`\text{Supervised: } \hat a_{ij} = \frac{C(i \to j) + s}{\sum_k C(i \to k) + N s}, \qquad \hat b_i(k) = \frac{C(i, k) + s}{C(i) + M s}`,
            String.raw`\text{E-step: } \gamma_t(i),\; \xi_t(i,j) \text{ from Forward-Backward}`,
            String.raw`\text{M-step: } \hat\pi_i = \gamma_1(i), \quad \hat a_{ij} = \frac{\sum_{t=1}^{T-1}\xi_t(i,j)}{\sum_{t=1}^{T-1}\gamma_t(i)}, \quad \hat b_i(k) = \frac{\sum_{t: O_t = k}\gamma_t(i)}{\sum_t \gamma_t(i)}`,
          ]}
          symbols={[
            ['C(i \\to j)', 'number of observed transitions from i to j'],
            ['s', 'additive (Laplace) smoothing count'],
            ['\\gamma_t(i)', 'expected occupancy of state i at t'],
            ['\\xi_t(i,j)', 'expected transition i → j at t'],
          ]}
        />
      </AlgoIntro>

      <Card title="Supervised MLE by frequency counting" subtitle="When hidden states are labelled, the MLE is a normalised count">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-3">
            <div className="text-xs text-slate-500">Labelled training journeys (labels are inputs, as if annotated by an analyst):</div>
            {LABELLED_EXAMPLE.map((l, k) => (
              <div key={k} className="rounded-lg border border-ink-700 bg-ink-900/50 p-2.5">
                <SequenceInline seq={l.observations} />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {l.hidden_states.map((s, i) => (
                    <StateChip key={i} state={STATE_SHORT.indexOf(s as (typeof STATE_SHORT)[number])} size="sm" />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex items-end gap-3">
              <Field label="Smoothing s" hint="0 = pure MLE; zeros stay zero">
                <input type="number" min={0} step={0.5} value={smoothing} onChange={(e) => setSmoothing(Math.max(0, Number(e.target.value)))} className={`${inputCls} w-24`} />
              </Field>
              <Button variant="primary" onClick={() => mle.run({ sequences: LABELLED_EXAMPLE, smoothing })} loading={mle.loading}>
                <Play className="size-4" /> Estimate
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            <ErrorBox error={mle.error} />
            {mle.data ? (
              <>
                <div>
                  <div className="mb-1 text-xs text-slate-400">Transition counts C(i → j)</div>
                  <MatrixTable values={mle.data.counts.A} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="from \ to" compact />
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-400">Estimated Â (each row = counts ÷ row total{smoothing ? `, with +${smoothing} smoothing` : ''})</div>
                  <MatrixTable values={mle.data.after.A} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="from \ to" compact rowSums format={fmt3} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-400">Estimated B̂</div>
                  <MatrixTable values={mle.data.after.B} rowLabels={[...STATE_SHORT]} colLabels={mle.data.after.observations} corner="state" compact rowSums format={fmt3} />
                </div>
                <div className="text-xs text-slate-500">
                  π̂ = [{mle.data.after.pi.map((v) => v.toFixed(3)).join(', ')}] from first-state counts [{mle.data.counts.pi.join(', ')}].
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Press Estimate to count transitions and emissions on the backend.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Unsupervised Baum-Welch (EM), iteration by iteration" subtitle="Trains on the current journey plus examples A–D, without any state labels">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" onClick={runBW} loading={bw.loading}>
              <Play className="size-4" /> Run Baum-Welch (up to 25 iterations)
            </Button>
            <span className="text-xs text-slate-500">{bwSeqs.length} training sequences · starts from the active model</span>
          </div>
          <ErrorBox error={bw.error} />
          {bw.data && h && (
            <>
              <StepControls
                step={iter}
                total={bw.data.history.length - 1}
                onStep={setIter}
                labels={bw.data.history.map((x) => `Iteration ${x.iteration} · log L = ${x.log_likelihood.toFixed(4)}`)}
              />
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <div className="mb-1 text-xs text-slate-400">Log-likelihood after each M-step</div>
                  <LikelihoodChart history={bw.data.history.slice(0, iter + 1)} height={220} />
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs text-slate-400">A at iteration {h.iteration}</div>
                    <MatrixTable values={h.params.A} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="from \ to" compact format={fmt3} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-slate-400">B at iteration {h.iteration}</div>
                    <MatrixTable values={h.params.B} rowLabels={[...STATE_SHORT]} colLabels={h.params.observations} corner="state" compact format={fmt3} />
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-slate-400">
                  E-step example: γ for <span className="text-slate-300">{bw.data.example_estep.observations.join(' → ')}</span> under the initial model
                </div>
                <MatrixTable
                  values={STATE_SHORT.map((_, i) => bw.data!.example_estep.gamma.map((r) => r[i]))}
                  rowLabels={STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)}
                  colLabels={bw.data.example_estep.observations.map((o, t) => `${t + 1}·${o}`)}
                  corner="γ_t(i)"
                  compact
                  normalizeHeat="column"
                  format={fmt3}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      {bw.data && (
        <ResultPanel title="Result">
          <p>
            {bw.data.converged ? 'Converged' : 'Stopped at the iteration limit'} after <span className="num text-white">{bw.data.iterations}</span> iterations.
            log P(O | λ) improved from <span className="num text-white">{fmt(bw.data.initial_log_likelihood)}</span> to{' '}
            <span className="num text-white">{fmt(bw.data.final_log_likelihood)}</span>
            {bw.data.monotonic ? ', never decreasing, as EM guarantees.' : '.'}
          </p>
          <p className="mt-2">
            <strong className="text-slate-100">Interpretation:</strong> with only {bw.data.n_sequences} short sequences the model quickly over-fits them. Train on
            the 600-sequence synthetic dataset on the Model Training page for a meaningful fit. Note that EM finds a <em>local</em> maximum and the states it
            learns are not guaranteed to keep their original meaning.
          </p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={() => navigate('/training')}>
              Open Model Training <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </ResultPanel>
      )}

      <Card title="How it all fits together">
        <div className="prose-lab grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <p>
            <strong>MLE</strong> is the goal: maximise <Tex>{String.raw`P(O\mid\lambda)`}</Tex>. <strong>EM</strong> is a general strategy to reach it when some
            variables are hidden. <strong>Baum-Welch</strong> is EM specialised to HMMs, and <strong>Forward-Backward</strong> is the subroutine that performs its
            E-step efficiently.
          </p>
          <p>
            <strong>Training vs inference.</strong> Training changes λ using many sequences. Inference (Forward, Viterbi, prediction) keeps λ fixed and reasons about
            one customer. You can apply trained parameters to the active model on the Model Training page.
          </p>
        </div>
      </Card>
    </div>
  )
}
