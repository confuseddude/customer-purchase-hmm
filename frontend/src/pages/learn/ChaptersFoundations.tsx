import { useState } from 'react'
import { BernoulliChart } from '../../charts/Charts'
import { DistributionBars } from '../../components/Distribution'
import { HmmDiagram } from '../../components/HmmDiagram'
import { ObsChip, SequenceInline, StateChip } from '../../components/Journey'
import { MatrixTable } from '../../components/MatrixTable'
import { Formula, Tex } from '../../components/Tex'
import { Button, Callout, ErrorBox, Loading, cx } from '../../components/ui'
import { useAppState } from '../../hooks/useAppState'
import { useAction, useAsync } from '../../hooks/useAsync'
import { LABELLED_EXAMPLE, OBS_META, STATE_COLORS, STATE_NAMES, STATE_SHORT } from '../../lib/constants'
import { fmt, pct } from '../../lib/format'
import { api } from '../../services/api'
import type { ObservationName } from '../../types'
import { Demo, H, KeyIdea, Prose } from './shared'

/* ---------------------------------------------------------------- Chapter 1 */

const ORDER_A: ObservationName[] = ['View', 'View', 'Cart', 'Checkout']
const ORDER_B: ObservationName[] = ['Checkout', 'Cart', 'View', 'View']

export function Chapter1() {
  const { modelVersion } = useAppState()
  const cmp = useAsync(
    () =>
      api.compare([
        { name: 'Order A', observations: ORDER_A },
        { name: 'Order B', observations: ORDER_B },
      ]),
    [modelVersion],
  )
  return (
    <>
      <Prose>
        <p>
          Imagine an online electronics store. A visitor opens a laptop page, opens another, adds one laptop to the cart, starts checkout… and the platform has to
          decide, <em>right now</em>, whether to show a discount, a shipping reminder, or nothing at all. That decision depends on one question:{' '}
          <strong>how likely is this customer to buy?</strong>
        </p>
        <p>
          <strong>Customer purchase prediction</strong> means estimating that probability from behaviour. Here we predict something precise and modest: the
          probability that the customer’s <em>next action</em> is a Purchase, given everything they have done in the session so far.
        </p>
      </Prose>

      <H>Customer behaviour is sequential</H>
      <Prose>
        <p>
          Actions arrive in order, and order carries meaning. “View → Cart → Checkout” describes someone moving towards a decision; “Checkout → Cart → View → View”
          describes someone who abandoned checkout and drifted back to browsing. Both journeys contain the <strong>same four actions</strong>. A model that only
          counts clicks (two Views, one Cart, one Checkout) cannot tell them apart.
        </p>
      </Prose>

      <Demo title="same clicks, different order">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[ORDER_A, ORDER_B].map((seq, k) => {
            const row = cmp.data?.journeys[k]
            return (
              <div key={k} className="rounded-lg border border-ink-700 bg-ink-900/60 p-4">
                <div className="mb-2 text-xs text-slate-500">Order {k === 0 ? 'A' : 'B'}</div>
                <SequenceInline seq={seq} />
                <div className="mt-3 text-sm text-slate-400">
                  P(next action = Purchase):{' '}
                  {row?.purchase_probability !== undefined ? <span className="num text-lg text-white">{pct(row.purchase_probability)}</span> : '…'}
                </div>
                {row?.filtered_distribution && (
                  <div className="mt-3">
                    <DistributionBars values={row.filtered_distribution} dense />
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <ErrorBox error={cmp.error} />
        <p className="mt-3 text-xs text-slate-500">Computed live by the backend HMM. Identical click counts, different predictions: the order matters.</p>
      </Demo>

      <H>Why isolated clicks are insufficient</H>
      <Prose>
        <ul>
          <li>A single “Cart” click can come from a committed buyer or from someone saving an item for later.</li>
          <li>Repeated views can mean careful comparison (rising interest) or aimless scrolling (low interest). Context decides.</li>
          <li>Recent actions should matter more for “what happens next” than actions from the start of the session.</li>
        </ul>
      </Prose>

      <H>What “hidden customer intention” means</H>
      <Prose>
        <p>
          Behind the clicks is a state of mind we can never observe directly. We model it with three <strong>hidden states</strong>:{' '}
          <span style={{ color: STATE_COLORS[0] }}>Browsing</span> (exploring with no specific goal), <span style={{ color: STATE_COLORS[1] }}>Interested</span>{' '}
          (found something relevant, evaluating it) and <span style={{ color: STATE_COLORS[2] }}>Ready to Purchase</span> (effectively decided).
        </p>
        <p>
          These states are <strong>modelling assumptions</strong>. No database stores “Interested”; we choose these three because they give a useful,
          interpretable story. The model’s job is to infer, from the observed actions, how probable each intention is at each moment.
        </p>
      </Prose>
      <KeyIdea>
        Observed: actions. Hidden: intentions. Goal: reason backwards from actions to intentions, then forwards from intentions to the likely next action.
      </KeyIdea>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 2 */

const PATH_OBS: ObservationName[] = ['View', 'Cart', 'Purchase']

export function Chapter2() {
  const { model } = useAppState()
  const [path, setPath] = useState<number[]>([0, 1, 2])
  const joint = useAsync(() => api.joint(PATH_OBS, path), [path.join(','), model?.id])

  return (
    <>
      <H>Start with a Markov model</H>
      <Prose>
        <p>
          A <strong>Markov chain</strong> is a system that moves between states over time, where the probability of the next state depends only on the current
          state, not on how we got there. Weather is the classic example: if today is rainy, tomorrow is rainy with some probability, regardless of last week.
        </p>
        <p>
          Applied to customers: if a customer is Interested now, there is some fixed probability they are Ready at the next step, some probability they stay
          Interested, and some probability they drift back to Browsing.
        </p>
      </Prose>
      <Formula label="Markov assumption" tex={String.raw`P(q_{t+1} \mid q_t, q_{t-1}, \dots, q_1) = P(q_{t+1} \mid q_t)`} />

      <H>What makes it hidden</H>
      <Prose>
        <p>
          In a plain Markov chain we can see the states. In a <strong>Hidden Markov Model</strong> we cannot: we only see <strong>observations</strong> that each
          hidden state produces probabilistically. A Browsing customer usually emits View, but sometimes Cart. A Ready customer usually emits Purchase, but
          sometimes another Cart. Observations are noisy clues about the hidden state.
        </p>
      </Prose>
      <Formula label="Output (conditional) independence" tex={String.raw`P(O_t \mid q_1,\dots,q_T,\, O_1,\dots,O_{t-1}) = P(O_t \mid q_t)`} />
      <Prose>
        <p>The current observation depends only on the current hidden state. Together the two assumptions make the joint probability factorise into simple pieces.</p>
      </Prose>

      {model && (
        <div className="my-5 rounded-xl border border-ink-700 bg-ink-900/50 p-2">
          <HmmDiagram model={model} selected={null} />
        </div>
      )}

      <H>The five ingredients</H>
      <div className="grid grid-cols-1 max-w-4xl gap-3 sm:grid-cols-2">
        {[
          ['Hidden states  S', 'Browsing, Interested, Ready to Purchase (N = 3). The quantity we want to infer.'],
          ['Observations  V', 'View, Cart, Checkout, Purchase, Exit (M = 5). What the platform logs.'],
          ['Initial probabilities  π', 'How likely each intention is at the first action of a session.'],
          ['Transition probabilities  A', 'How intention evolves from one action to the next.'],
          ['Emission probabilities  B', 'How likely each intention is to produce each action.'],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-ink-700 bg-ink-900/60 p-3.5">
            <div className="text-sm font-semibold text-slate-100">{t}</div>
            <div className="mt-1 text-[0.8125rem] text-slate-400">{d}</div>
          </div>
        ))}
      </div>

      <H>Probability of one complete story</H>
      <Formula
        tex={String.raw`P(O, Q \mid \lambda) = \pi_{q_1}\, b_{q_1}(O_1) \cdot a_{q_1 q_2}\, b_{q_2}(O_2) \cdots a_{q_{T-1} q_T}\, b_{q_T}(O_T)`}
        symbols={[
          ['O', 'observed action sequence'],
          ['Q', 'one hypothesised hidden-state sequence'],
        ]}
      />
      <Demo title="choose a hidden story for View → Cart → Purchase">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PATH_OBS.map((o, t) => (
            <div key={t} className="rounded-lg border border-ink-700 bg-ink-900/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="num text-xs text-slate-500">t = {t + 1}</span>
                <ObsChip name={o} size="sm" />
              </div>
              <div className="flex flex-col gap-1">
                {STATE_SHORT.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setPath(path.map((p, k) => (k === t ? i : p)))}
                    className={cx(
                      'rounded-md border px-2 py-1 text-left text-[0.8125rem] transition-colors',
                      path[t] === i ? 'text-white' : 'border-ink-700 text-slate-400 hover:border-ink-500',
                    )}
                    style={path[t] === i ? { borderColor: STATE_COLORS[i], backgroundColor: `${STATE_COLORS[i]}1c` } : undefined}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {joint.data && (
          <div className="mt-4 space-y-2 text-sm">
            <div className="num flex flex-wrap items-center gap-1.5 text-[0.8125rem] text-slate-400">
              {joint.data.factors.map((f, k) => (
                <span key={k} className="flex items-center gap-1.5">
                  {k > 0 && <span className="text-slate-600">×</span>}
                  <span className="rounded border border-ink-700 bg-ink-900 px-1.5 py-0.5" title={f.symbol}>
                    {f.value.toFixed(2)}
                  </span>
                </span>
              ))}
              <span className="text-slate-600">=</span>
              <span className="text-base text-white">{fmt(joint.data.probability)}</span>
            </div>
            <div className="text-xs text-slate-500">
              Factors in order: π, emission, then (transition, emission) for each later step. The best possible story (Viterbi) has probability{' '}
              <span className="num text-slate-300">{fmt(joint.data.viterbi_probability)}</span>
              {joint.data.is_viterbi_path ? ': you found it.' : '. Try to find it.'}
            </div>
          </div>
        )}
        <ErrorBox error={joint.error} />
      </Demo>
      <KeyIdea>
        There are N<sup>T</sup> possible stories. The HMM algorithms either <strong>sum</strong> over all of them (Forward: how likely are the observations?) or
        pick the <strong>max</strong> (Viterbi: which story is best?), without listing them one by one.
      </KeyIdea>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 3 */

export function Chapter3() {
  const { model } = useAppState()
  const [cellA, setCellA] = useState<[number, number]>([1, 2])
  const [cellB, setCellB] = useState<[number, number]>([2, 3])
  if (!model) return <Loading />
  return (
    <>
      <Prose>
        <p>
          An HMM is completely specified by three parameter groups, written together as <Tex>{String.raw`\lambda = (A, B, \pi)`}</Tex>. Below are the actual
          numbers this application is using right now (the active model). They are <strong>illustrative, simulated values</strong>.
        </p>
      </Prose>

      <H>π: initial state distribution</H>
      <Prose>
        <p>
          <Tex>{String.raw`\pi_i = P(q_1 = i)`}</Tex>: the probability that a session starts in state i. With π = ({model.pi.map((v) => v.toFixed(2)).join(', ')}),
          most sessions begin with a Browsing customer and only {pct(model.pi[2], 0)} begin already Ready. The entries must sum to 1.
        </p>
      </Prose>
      <div className="my-4 max-w-xl">
        <DistributionBars values={model.pi} highlightMax={false} />
      </div>

      <H>A: transition matrix</H>
      <Prose>
        <p>
          <Tex>{String.raw`a_{ij} = P(q_{t+1} = j \mid q_t = i)`}</Tex>. <strong>Read a row</strong>: “if the customer is in this state now, where are they
          next?”. Every row is a probability distribution, so it sums to 1. The diagonal is the probability of <em>staying</em> in a state; large diagonal values
          mean intentions are persistent. Click a cell.
        </p>
      </Prose>
      <div className="my-4 max-w-2xl">
        <MatrixTable
          values={model.A}
          rowLabels={STATE_NAMES.map((s, i) => (
            <span key={s} style={{ color: STATE_COLORS[i] }}>
              {s}
            </span>
          ))}
          colLabels={[...STATE_SHORT]}
          corner="now \ next"
          rowSums
          onCellClick={(r, c) => setCellA([r, c])}
          selected={cellA}
        />
        <Callout kind="tip">
          <span className="num">a</span>
          <sub>
            {STATE_SHORT[cellA[0]]}→{STATE_SHORT[cellA[1]]}
          </sub>{' '}
          = {model.A[cellA[0]][cellA[1]].toFixed(2)}: a customer who is <strong>{STATE_NAMES[cellA[0]]}</strong> now has a {pct(model.A[cellA[0]][cellA[1]], 0)} chance of
          being <strong>{STATE_NAMES[cellA[1]]}</strong> at the next action.
        </Callout>
      </div>

      <H>B: emission matrix</H>
      <Prose>
        <p>
          <Tex>{String.raw`b_i(k) = P(O_t = k \mid q_t = i)`}</Tex>. Each <strong>row</strong> is the action distribution of one hidden state and sums to 1. (The
          project presentation draws the same matrix transposed, with actions as rows and states as columns; then each <em>column</em> sums to 1.) Compare
          columns to see which state best explains an action: Purchase has emission probability {model.B[2][3].toFixed(2)} from Ready but only{' '}
          {model.B[0][3].toFixed(2)} from Browsing.
        </p>
      </Prose>
      <div className="my-4 max-w-3xl">
        <MatrixTable
          values={model.B}
          rowLabels={STATE_NAMES.map((s, i) => (
            <span key={s} style={{ color: STATE_COLORS[i] }}>
              {s}
            </span>
          ))}
          colLabels={model.observations.map((o) => (
            <span key={o} style={{ color: OBS_META[o].color }}>
              {o}
            </span>
          ))}
          corner="state \ action"
          rowSums
          onCellClick={(r, c) => setCellB([r, c])}
          selected={cellB}
        />
        <Callout kind="tip">
          b<sub>{STATE_SHORT[cellB[0]]}</sub>({model.observations[cellB[1]]}) = {model.B[cellB[0]][cellB[1]].toFixed(2)}: when a customer is{' '}
          <strong>{STATE_NAMES[cellB[0]]}</strong>, {pct(model.B[cellB[0]][cellB[1]], 0)} of their actions are <strong>{model.observations[cellB[1]]}</strong>.
        </Callout>
      </div>
      <Callout kind="info" title="Where the numbers come from">
        View, Cart and Purchase emissions follow the project presentation. Checkout and Exit emissions are additional synthetic values chosen so that each state’s
        distribution sums to 1. You can change any value on the Model Configuration page or learn them from data on the Model Training page.
      </Callout>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 4 */

export function Chapter4() {
  const [k, setK] = useState(7)
  const curve = useAsync(() => api.likelihoodCurve(k, 10), [k])
  const mle = useAction(api.trainMLE)
  return (
    <>
      <H>What likelihood means</H>
      <Prose>
        <p>
          Probability and likelihood use the same formula but answer different questions. <strong>Probability</strong> fixes the parameters and asks how likely
          the data is. <strong>Likelihood</strong> fixes the data we actually observed and asks how plausible each parameter value is:{' '}
          <Tex>{String.raw`L(\lambda) = P(O \mid \lambda)`}</Tex>.
        </p>
        <p>
          <strong>Maximum likelihood estimation</strong> picks the parameters under which the observed data would have been most probable:{' '}
          <Tex>{String.raw`\hat\lambda = \arg\max_\lambda P(O \mid \lambda)`}</Tex>. In practice we maximise the log-likelihood, which has the same maximiser and
          turns products into sums.
        </p>
      </Prose>

      <Demo title="a one-parameter example">
        <Prose>
          <p>
            Suppose a Browsing customer performed 10 actions and <strong>{k}</strong> of them were View. Model each action as View with unknown probability p. The
            likelihood is <Tex>{String.raw`L(p) = p^{${k}} (1-p)^{${10 - k}}`}</Tex>. Move the slider and watch the peak.
          </p>
        </Prose>
        <div className="my-3 flex items-center gap-3">
          <span className="text-xs text-slate-500">Views k =</span>
          <input type="range" min={0} max={10} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-56 accent-[#7c8cff]" />
          <span className="num text-sm text-white">{k} / 10</span>
        </div>
        {curve.data && <BernoulliChart curve={curve.data.curve} mle={curve.data.mle} />}
        <p className="mt-2 text-xs text-slate-500">
          The curve peaks exactly at p̂ = k / n = {curve.data?.mle ?? '…'}. Setting <Tex>{String.raw`\tfrac{d}{dp}\log L = \tfrac{k}{p} - \tfrac{n-k}{1-p} = 0`}</Tex>{' '}
          gives <Tex>{String.raw`\hat p = k/n`}</Tex>: <strong>the MLE is the observed frequency</strong>.
        </p>
      </Demo>

      <H>Why frequency counts work when the states are known</H>
      <Prose>
        <p>
          If every action came with its hidden-state label, the complete-data likelihood <Tex>{String.raw`P(O, Q \mid \lambda)`}</Tex> splits into independent
          pieces: one multinomial per row of A, one per row of B, and one for π. Each piece is the same problem as the slider above, so each MLE is a normalised
          count:
        </p>
      </Prose>
      <Formula
        tex={[
          String.raw`\hat\pi_i = \frac{\#\{\text{sequences starting in } i\}}{\#\text{sequences}}, \qquad \hat a_{ij} = \frac{C(i \to j)}{\sum_k C(i \to k)}, \qquad \hat b_i(k) = \frac{C(i \text{ emits } k)}{C(i)}`,
        ]}
      />
      <Demo title="count transitions in four labelled journeys">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            {LABELLED_EXAMPLE.map((l, i) => (
              <div key={i} className="rounded-lg border border-ink-700 bg-ink-900/60 p-2.5">
                <SequenceInline seq={l.observations} />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {l.hidden_states.map((s, j) => (
                    <StateChip key={j} state={STATE_SHORT.indexOf(s as (typeof STATE_SHORT)[number])} size="sm" />
                  ))}
                </div>
              </div>
            ))}
            <Button variant="primary" size="sm" onClick={() => mle.run({ sequences: LABELLED_EXAMPLE, smoothing: 0 })} loading={mle.loading}>
              Count and estimate
            </Button>
          </div>
          <div className="space-y-3">
            <ErrorBox error={mle.error} />
            {mle.data ? (
              <>
                <div className="text-xs text-slate-400">Transition counts C(i → j)</div>
                <MatrixTable values={mle.data.counts.A} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="from \ to" compact />
                <div className="text-xs text-slate-400">Â = each row divided by its total</div>
                <MatrixTable values={mle.data.after.A} rowLabels={[...STATE_SHORT]} colLabels={[...STATE_SHORT]} corner="from \ to" compact format={(v) => (v === null ? 'n/a' : v.toFixed(3))} />
                <p className="text-xs text-slate-500">
                  For example, Browsing was followed {mle.data.counts.A[0].join(', ')} times by (Browsing, Interested, Ready), so its row becomes{' '}
                  {mle.data.after.A[0].map((v) => v.toFixed(2)).join(', ')}. Zero counts give zero probabilities, which is why smoothing (adding a small count to
                  every cell) is used on real data.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Press the button to run supervised MLE on the backend.</p>
            )}
          </div>
        </div>
      </Demo>

      <H>Why hidden states require an iterative method</H>
      <Prose>
        <p>
          Real clickstreams have no labels. The likelihood we can actually compute sums over every possible hidden story,{' '}
          <Tex>{String.raw`P(O\mid\lambda) = \sum_Q P(O, Q \mid \lambda)`}</Tex>, and the logarithm of a sum does not split into independent pieces. There is no
          closed-form maximiser.
        </p>
        <p>
          The way out is to <em>guess</em> the counts: with the current parameters, compute the <strong>expected</strong> number of times each transition and
          emission happened (using Forward-Backward), then re-estimate the parameters from these soft counts exactly as above, and repeat. That loop is the{' '}
          <strong>Baum-Welch</strong> algorithm (Chapter 10).
        </p>
      </Prose>
    </>
  )
}
