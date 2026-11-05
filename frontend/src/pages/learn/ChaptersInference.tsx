import { StateProbabilityChart } from '../../charts/Charts'
import { JourneyTimeline, SequenceInline, StateChip } from '../../components/Journey'
import { MatrixTable } from '../../components/MatrixTable'
import { Formula, Tex } from '../../components/Tex'
import { ErrorBox, Loading } from '../../components/ui'
import { STATE_COLORS, STATE_SHORT } from '../../lib/constants'
import { fmt, pct, tex } from '../../lib/format'
import { navigate } from '../../hooks/useRoute'
import { backwardCellTex, forwardCellTex, viterbiCellTex } from '../../lib/calcTex'
import { CalcLine, ColumnLabel, StateLabel } from '../lab/common'
import { Demo, H, KeyIdea, Prose, WORKED, useWorked } from './shared'

function LabLink({ tab, label }: { tab: string; label: string }) {
  return (
    <button onClick={() => navigate(`/lab/${tab}`)} className="text-accent-soft underline decoration-accent/40 underline-offset-2 hover:text-white">
      {label}
    </button>
  )
}

const rows = STATE_SHORT.map((_, i) => <StateLabel key={i} i={i} />)
const cols = WORKED.map((o, t) => <ColumnLabel key={t} t={t + 1} obs={o} />)
const transpose = (m: number[][]) => STATE_SHORT.map((_, i) => m.map((r) => r[i]))

/* ---------------------------------------------------------------- Chapter 5 */

export function Chapter5() {
  const { fwd } = useWorked()
  const d = fwd.data
  return (
    <>
      <Prose>
        <p>
          The Forward algorithm answers: <strong>how probable is this sequence of actions under the model?</strong> Our running example is{' '}
          <SequenceInline seq={WORKED} />.
        </p>
      </Prose>
      <H>The alpha variable</H>
      <Formula
        tex={String.raw`\alpha_t(i) = P(O_1, \dots, O_t,\; q_t = i \mid \lambda)`}
        symbols={[['\\alpha_t(i)', 'probability of seeing the first t actions AND being in state i at time t, summed over every way of getting there']]}
      />
      <Prose>
        <p>
          Think of α<sub>t</sub>(i) as a running total. Every possible hidden path that produces the first t actions and ends in state i contributes its
          probability. Because paths that end in the same state share their future, we can merge them and never track them individually.
        </p>
      </Prose>

      <H>Initialization, recursion, termination</H>
      <Formula
        tex={[
          String.raw`\alpha_1(i) = \pi_i\, b_i(O_1)`,
          String.raw`\alpha_{t+1}(j) = \Big[\sum_{i} \alpha_t(i)\, a_{ij}\Big] b_j(O_{t+1})`,
          String.raw`P(O\mid\lambda) = \sum_i \alpha_T(i)`,
        ]}
      />
      <Prose>
        <p>
          <strong>Why sum over states?</strong> To be in state j at time t+1, the customer was in <em>some</em> state at time t: Browsing, Interested or Ready.
          These possibilities are mutually exclusive, so their probabilities add. Each is weighted by how likely it was (α<sub>t</sub>(i)) and how likely the move
          into j is (a<sub>ij</sub>). Finally j must explain the new action (b<sub>j</sub>).
        </p>
      </Prose>

      <ErrorBox error={fwd.error} />
      {!d ? (
        <Loading />
      ) : (
        <Demo title="worked example (live values)">
          <MatrixTable values={transpose(d.alpha)} rowLabels={rows} colLabels={cols} corner="α_t(i)" normalizeHeat="column" />
          <div className="mt-4 space-y-2">
            {d.steps.map((st) =>
              st.cells.map((c) => (
                <CalcLine
                  key={`${st.t}-${c.state}`}
                  defaultOpen={st.t <= 2 && c.state === 1}
                  color={STATE_COLORS[c.state]}
                  title={
                    <span>
                      t = {st.t} ({st.observation_name}) · α<sub>{st.t}</sub>({STATE_SHORT[c.state]}) = <span className="num text-white">{fmt(c.value)}</span>
                    </span>
                  }
                  tex={forwardCellTex(c, st.t, st.observation_name)}
                />
              )),
            )}
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] px-3.5 py-2">
              <Tex block>{String.raw`P(O\mid\lambda) = ${d.termination.terms.map((v) => tex(v)).join(' + ')} = \mathbf{${tex(d.likelihood)}}`}</Tex>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Work: T·N² = {WORKED.length}·9 = {WORKED.length * 9} multiplications instead of enumerating 3<sup>{WORKED.length}</sup> = {3 ** WORKED.length} paths. Step
            through it in the <LabLink tab="forward" label="Algorithm Lab" />.
          </p>
        </Demo>
      )}
      <H>Numerical stability</H>
      <Prose>
        <p>
          α values shrink by roughly a constant factor per step. After a few hundred actions they fall below the smallest number a computer can store (underflow).
          The backend therefore normalises each column (scaling factor c<sub>t</sub> = Σ<sub>i</sub> α<sub>t</sub>(i)) and accumulates{' '}
          <Tex>{String.raw`\log P(O\mid\lambda) = \sum_t \log c_t`}</Tex>. The normalised column is exactly the filtered belief{' '}
          <Tex>{String.raw`P(q_t = i \mid O_1..O_t)`}</Tex> used for live prediction.
        </p>
      </Prose>
      {d && (
        <KeyIdea>
          After the last action the normalised α gives the current intent: {d.alpha_hat[WORKED.length - 1].map((v, i) => `${STATE_SHORT[i]} ${pct(v)}`).join(', ')}.
          Multiplying by A and then B gives the next-action forecast.
        </KeyIdea>
      )}
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 6 */

export function Chapter6() {
  const { bwd } = useWorked()
  const d = bwd.data
  return (
    <>
      <H>The beta variable</H>
      <Formula
        tex={String.raw`\beta_t(i) = P(O_{t+1}, \dots, O_T \mid q_t = i, \lambda)`}
        symbols={[['\\beta_t(i)', 'probability of all FUTURE actions, given the customer is in state i at time t']]}
      />
      <Prose>
        <p>
          α looks backwards in time (what has happened); β looks forwards (what will happen). If the customer is Interested at step 2, how well does that explain
          the Checkout and Purchase that follow? That is β<sub>2</sub>(Interested).
        </p>
      </Prose>
      <Formula
        tex={[String.raw`\beta_T(i) = 1`, String.raw`\beta_t(i) = \sum_j a_{ij}\, b_j(O_{t+1})\, \beta_{t+1}(j)`, String.raw`P(O\mid\lambda) = \sum_i \pi_i\, b_i(O_1)\, \beta_1(i)`]}
      />
      <Prose>
        <p>
          <strong>Initialization</strong> sets β<sub>T</sub> = 1 because nothing is left to explain after the last action. <strong>Recursion</strong> walks
          backwards: from state i the customer moves to some j, j emits the next action, and β<sub>t+1</sub>(j) covers everything after that.
        </p>
      </Prose>
      <ErrorBox error={bwd.error} />
      {!d ? (
        <Loading />
      ) : (
        <Demo title="walking backwards through the sequence">
          <MatrixTable values={transpose(d.beta)} rowLabels={rows} colLabels={cols} corner="β_t(i)" normalizeHeat="column" />
          <div className="mt-4 space-y-2">
            {d.steps.map((st) =>
              st.cells.map((c) => (
                <CalcLine
                  key={`${st.t}-${c.state}`}
                  defaultOpen={st.t === WORKED.length - 1 && c.state === 1}
                  color={STATE_COLORS[c.state]}
                  title={
                    <span>
                      t = {st.t} · β<sub>{st.t}</sub>({STATE_SHORT[c.state]}) = <span className="num text-white">{fmt(c.value)}</span>
                    </span>
                  }
                  tex={backwardCellTex(st, c.state)}
                />
              )),
            )}
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.05] px-3.5 py-2">
              <Tex block>{String.raw`\sum_i \pi_i b_i(O_1) \beta_1(i) = \mathbf{${tex(d.likelihood)}} \quad (\text{same as Forward})`}</Tex>
            </div>
          </div>
        </Demo>
      )}
      <KeyIdea>
        For every t, <Tex>{String.raw`\sum_i \alpha_t(i)\beta_t(i) = P(O\mid\lambda)`}</Tex>. Past and future meet at time t; that identity is what
        Forward-Backward exploits.
      </KeyIdea>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 7 */

export function Chapter7() {
  const { fb } = useWorked()
  const d = fb.data
  return (
    <>
      <H>Why combine Forward and Backward?</H>
      <Prose>
        <p>
          The filtered belief from α alone uses only the past. But when we analyse a finished session we know what came <em>later</em>, and that is informative:
          a Cart followed by Purchase was more likely made by an Interested or Ready customer than the same Cart followed by Exit. Combining α (past) with β
          (future) gives the probability of each intention at each step given the <strong>whole journey</strong>.
        </p>
      </Prose>
      <Formula
        tex={[
          String.raw`\gamma_t(i) = P(q_t = i \mid O, \lambda) = \frac{\alpha_t(i)\,\beta_t(i)}{P(O\mid\lambda)}`,
          String.raw`\sum_i \gamma_t(i) = 1 \quad\text{for every } t`,
        ]}
        symbols={[
          ['\\alpha_t(i)\\beta_t(i)', '= P(O, q_t = i | λ): the whole sequence AND state i at t'],
          ['P(O\\mid\\lambda)', 'dividing by it is Bayes’ rule; it makes the column sum to 1'],
        ]}
      />
      <ErrorBox error={fb.error} />
      {!d ? (
        <Loading />
      ) : (
        <Demo title="posterior intent for View → Cart → Checkout → Purchase">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <MatrixTable
                values={transpose(d.gamma)}
                rowLabels={rows}
                colLabels={cols}
                corner="γ_t(i)"
                normalizeHeat="column"
                highlight={(r, c) => d.posterior_path[c] === r}
                format={(v) => (v === null ? 'n/a' : pct(v))}
              />
              <div className="mt-3 space-y-2">
                {d.timeline[1].cells.map((c) => (
                  <CalcLine
                    key={c.state}
                    defaultOpen={c.state === 1}
                    color={STATE_COLORS[c.state]}
                    title={
                      <span>
                        γ<sub>2</sub>({STATE_SHORT[c.state]}) = {pct(c.gamma)}
                      </span>
                    }
                    tex={[String.raw`\gamma_2 = \frac{${tex(c.alpha)} \times ${tex(c.beta)}}{${tex(d.likelihood)}} = ${tex(c.gamma)}`]}
                  />
                ))}
              </div>
            </div>
            <StateProbabilityChart matrix={d.gamma} observations={d.observations} height={250} />
          </div>
          <div className="mt-4">
            <JourneyTimeline seq={d.observations} states={d.posterior_path} distributions={d.gamma} />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Compare with the online belief at t = 2 (Cart), which ignores the future:{' '}
            {d.timeline[1].filtered.map((v, i) => `${STATE_SHORT[i]} ${pct(v)}`).join(', ')}. Knowing that Checkout and Purchase follow shifts the belief.
          </p>
        </Demo>
      )}
      <KeyIdea>Forward-Backward returns a full probability distribution at every step, not just a single label, so it also tells you how uncertain the model is.</KeyIdea>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 8 */

export function Chapter8() {
  const { vit } = useWorked()
  const d = vit.data
  return (
    <>
      <H>Why we need the maximum operation</H>
      <Prose>
        <p>
          Sometimes we want <strong>one</strong> explanation: “this customer went Browsing → Interested → Interested → Ready”. The best path is{' '}
          <Tex>{String.raw`Q^* = \arg\max_Q P(O, Q \mid \lambda)`}</Tex>. Replacing the Forward algorithm’s <em>sum</em> over predecessors by a <em>max</em>{' '}
          keeps only the best way of reaching each state.
        </p>
      </Prose>
      <H>Dynamic programming</H>
      <Prose>
        <p>
          The trick is the <strong>principle of optimality</strong>: the best path to state j at time t must extend the best path to <em>some</em> state at time
          t−1. So we only need to remember, for each state and time, the best score δ<sub>t</sub>(j) and which predecessor achieved it, the{' '}
          <strong>backpointer</strong> ψ<sub>t</sub>(j). The table is filled left to right in O(T·N²).
        </p>
      </Prose>
      <Formula
        tex={[
          String.raw`\textbf{Initialization: } \delta_1(i) = \pi_i\, b_i(O_1)`,
          String.raw`\textbf{Recursion: } \delta_t(j) = \max_i\big[\delta_{t-1}(i)\, a_{ij}\big] b_j(O_t),\quad \psi_t(j) = \arg\max_i \big[\delta_{t-1}(i)\, a_{ij}\big]`,
          String.raw`\textbf{Termination: } P^* = \max_i \delta_T(i),\quad q^*_T = \arg\max_i \delta_T(i)`,
          String.raw`\textbf{Backtracking: } q^*_t = \psi_{t+1}(q^*_{t+1}),\; t = T-1, \dots, 1`,
        ]}
      />
      <ErrorBox error={vit.error} />
      {!d ? (
        <Loading />
      ) : (
        <Demo title="complete worked example">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <div className="mb-1 text-xs text-slate-400">δ table</div>
              <MatrixTable values={transpose(d.delta)} rowLabels={rows} colLabels={cols} corner="δ_t(i)" normalizeHeat="column" highlight={(r, c) => d.path[c] === r} />
            </div>
            <div>
              <div className="mb-1 text-xs text-slate-400">ψ backpointers</div>
              <MatrixTable
                values={STATE_SHORT.map((_, i) => d.backpointers.map((r) => r[i]))}
                rowLabels={rows}
                colLabels={cols}
                corner="ψ_t(i)"
                heat={false}
                highlight={(r, c) => c > 0 && d.path[c] === r}
                format={(v) => (v === null ? 'n/a' : STATE_SHORT[v])}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {d.steps.map((st) =>
              st.cells.map((c) => (
                <CalcLine
                  key={`${st.t}-${c.state}`}
                  defaultOpen={st.t === 2 && c.state === 1}
                  color={STATE_COLORS[c.state]}
                  title={
                    <span>
                      t = {st.t} ({st.observation_name}) · δ<sub>{st.t}</sub>({STATE_SHORT[c.state]}) = <span className="num text-white">{fmt(c.value)}</span>
                      {c.best_from !== null && <span className="text-slate-500"> · came from {STATE_SHORT[c.best_from]}</span>}
                    </span>
                  }
                  tex={viterbiCellTex(c, st.t, st.observation_name)}
                />
              )),
            )}
          </div>
          <div className="mt-4 rounded-lg border border-ink-700 bg-ink-900/60 p-3 text-sm text-slate-300">
            <div className="mb-2 font-medium">Termination and backtracking</div>
            <Tex block>{String.raw`P^* = \max\{${d.termination.final_delta.map((v) => tex(v)).join(',\\;')}\} = ${tex(d.best_probability)}`}</Tex>
            <ol className="mt-2 space-y-1 text-sm">
              {d.backtracking.map((b) => (
                <li key={b.t} className="flex flex-wrap items-center gap-2">
                  <span className="num text-slate-500">q*{b.t}</span> = <StateChip state={b.state} size="sm" />
                  <span className="text-xs text-slate-500">({b.via})</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="mt-4">
            <JourneyTimeline seq={d.observations} states={d.path} />
          </div>
          <p className="mt-2 text-sm text-slate-300">
            Decoded path: <strong className="text-white">{d.path_names.join(' → ')}</strong>. This comes from the algorithm and the current parameters; change the
            model and it can change.
          </p>
        </Demo>
      )}
    </>
  )
}
