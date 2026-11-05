import { BarChart3, BellRing, Gauge, Layers, ShoppingBag, Users } from 'lucide-react'
import { LikelihoodChart } from '../../charts/Charts'
import { JourneyBuilder, StateChip } from '../../components/Journey'
import { MatrixTable } from '../../components/MatrixTable'
import { Formula, Tex } from '../../components/Tex'
import { Button, Callout, ErrorBox, Loading } from '../../components/ui'
import { useAppState } from '../../hooks/useAppState'
import { useAction, useAsync } from '../../hooks/useAsync'
import { STATE_SHORT } from '../../lib/constants'
import { fmt, pct } from '../../lib/format'
import { api } from '../../services/api'
import { Demo, H, KeyIdea, Prose } from './shared'

/* ---------------------------------------------------------------- Chapter 9 */

export function Chapter9() {
  const { sequence, setSequence, modelVersion } = useAppState()
  const enabled = sequence.length > 0
  const key = `${sequence.join(',')}:${modelVersion}`
  const vit = useAsync(() => api.viterbi(sequence), [key], enabled)
  const fb = useAsync(() => api.forwardBackward(sequence), [key], enabled)
  const rows: [string, string, string][] = [
    ['Question answered', 'What is the single most likely complete sequence of intentions?', 'What is the probability of each intention at each step?'],
    ['Core operation', 'Maximisation (max over predecessors)', 'Summation (sum over predecessors)'],
    ['Output', 'One path q*₁ … q*_T', 'A distribution γ_t for every time step'],
    ['Uncertainty', 'Lost: one answer, no confidence', 'Kept: e.g. 55% Interested, 40% Ready'],
    ['Consistency', 'Always a valid path (respects A)', 'Step-wise argmax may be an impossible path'],
    ['Extra memory', 'Backpointers ψ', 'α and β tables'],
    ['Used for', 'Segmenting / labelling a journey', 'Probabilistic analysis, Baum-Welch E-step'],
    ['Complexity', 'O(T·N²)', 'O(T·N²)'],
  ]
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full max-w-4xl text-sm">
          <thead>
            <tr className="text-left">
              <th className="w-44 py-2 pr-3 text-slate-500" />
              <th className="py-2 pr-3 font-semibold text-amber-300">Viterbi</th>
              <th className="py-2 font-semibold text-emerald-300">Forward-Backward</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([k, a, b]) => (
              <tr key={k} className="border-t border-ink-700/70 align-top">
                <td className="py-2 pr-3 text-slate-400">{k}</td>
                <td className="py-2 pr-3 text-slate-200">{a}</td>
                <td className="py-2 text-slate-200">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <H>When to use each</H>
      <Prose>
        <ul>
          <li>
            <strong>Viterbi</strong> when you need one coherent story to act on or to report, such as tagging each step of a session as Browsing / Interested /
            Ready for a dashboard.
          </li>
          <li>
            <strong>Forward-Backward</strong> when you need probabilities and uncertainty, such as “how confident are we the customer was ready at the Cart step?”,
            and whenever you train with Baum-Welch.
          </li>
          <li>
            <strong>Forward only (filtering)</strong> for live, real-time decisions: the future isn’t known yet, so β cannot be used. This is what the purchase
            forecast does.
          </li>
        </ul>
      </Prose>

      <Demo title="side by side on the current journey">
        <JourneyBuilder seq={sequence} onChange={setSequence} compact />
        {!enabled ? (
          <p className="mt-3 text-sm text-slate-500">Add actions to compare.</p>
        ) : vit.data && fb.data ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-[0.8125rem]">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">t</th>
                  <th className="py-1.5 pr-3 font-medium">action</th>
                  <th className="py-1.5 pr-3 font-medium">Viterbi state</th>
                  <th className="py-1.5 pr-3 font-medium">Posterior argmax</th>
                  <th className="py-1.5 font-medium">γ (B / I / R)</th>
                </tr>
              </thead>
              <tbody>
                {fb.data.timeline.map((t, k) => (
                  <tr key={k} className="border-t border-ink-700/60">
                    <td className="num py-1.5 pr-3 text-slate-500">{t.t}</td>
                    <td className="py-1.5 pr-3 text-slate-300">{t.observation_name}</td>
                    <td className="py-1.5 pr-3">
                      <StateChip state={vit.data!.path[k]} size="sm" />
                    </td>
                    <td className="py-1.5 pr-3">
                      <StateChip state={t.most_likely_state} size="sm" />
                    </td>
                    <td className="num py-1.5 text-slate-400">{t.posterior.map((p) => pct(p, 0)).join(' / ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">
              {vit.data.path.every((s, k) => s === fb.data!.posterior_path[k])
                ? 'Here both methods agree. They can disagree when two paths are close in probability.'
                : 'Here the methods disagree: the best whole path is not the same as picking the best state at each step separately.'}
            </p>
          </div>
        ) : (
          <Loading />
        )}
        <ErrorBox error={vit.error ?? fb.error} />
      </Demo>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 10 */

export function Chapter10() {
  const bw = useAction(api.trainBaumWelch)
  return (
    <>
      <H>Expectation-Maximization in one paragraph</H>
      <Prose>
        <p>
          <strong>EM</strong> is a general recipe for maximum likelihood when part of the data is missing. If we knew the hidden states, estimation would be
          counting (Chapter 4). We don’t, so we alternate: <strong>E-step</strong>, use the current parameters to compute the expected value of the missing
          information; <strong>M-step</strong>, re-estimate the parameters as if those expectations were real counts. Each round provably does not decrease the
          likelihood, so the procedure climbs to a (local) maximum.
        </p>
      </Prose>
      <H>Why it suits hidden-state models</H>
      <Prose>
        <p>
          The quantity that blocks closed-form MLE is the sum over hidden paths. EM never needs to maximise that sum directly. It only needs posterior
          probabilities of states and transitions, and for an HMM those come cheaply from Forward-Backward.
        </p>
      </Prose>
      <H>E-step: soft counts from Forward-Backward</H>
      <Formula
        tex={[
          String.raw`\gamma_t(i) = \frac{\alpha_t(i)\beta_t(i)}{P(O\mid\lambda)} \qquad \xi_t(i,j) = \frac{\alpha_t(i)\, a_{ij}\, b_j(O_{t+1})\, \beta_{t+1}(j)}{P(O\mid\lambda)}`,
          String.raw`\mathbb{E}[\#\, i \to j] = \sum_{t=1}^{T-1} \xi_t(i,j), \qquad \mathbb{E}[\#\text{ time in } i] = \sum_{t=1}^{T} \gamma_t(i)`,
        ]}
      />
      <H>M-step: re-estimate λ</H>
      <Formula
        tex={[
          String.raw`\hat\pi_i = \frac{1}{K}\sum_{k} \gamma^{(k)}_1(i)`,
          String.raw`\hat a_{ij} = \frac{\sum_k \sum_{t=1}^{T_k-1} \xi^{(k)}_t(i,j)}{\sum_k \sum_{t=1}^{T_k-1} \gamma^{(k)}_t(i)} \qquad \hat b_i(v) = \frac{\sum_k \sum_{t:\,O_t = v} \gamma^{(k)}_t(i)}{\sum_k \sum_{t} \gamma^{(k)}_t(i)}`,
        ]}
        symbols={[
          ['K', 'number of training sequences'],
          ['(k)', 'quantity computed on sequence k'],
        ]}
      />
      <Prose>
        <p>
          Compare with supervised MLE: the formulas are identical, except the hard counts C(i → j) are replaced by expected counts. Then repeat: E-step with the
          new λ, M-step again, until the log-likelihood improves by less than the tolerance.
        </p>
      </Prose>
      <Demo title="100 simulated sequences, 30 iterations, random start">
        <Button variant="primary" size="sm" loading={bw.loading} onClick={() => bw.run({ limit: 100, max_iterations: 30, tolerance: 1e-6, init: 'random', seed: 3 })}>
          Run Baum-Welch on the backend
        </Button>
        <ErrorBox error={bw.error} />
        {bw.data && (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <LikelihoodChart history={bw.data.history} height={230} />
              <p className="mt-1 text-xs text-slate-500">
                log L: {fmt(bw.data.initial_log_likelihood)} → {fmt(bw.data.final_log_likelihood)} in {bw.data.iterations} iterations
                {bw.data.converged ? ' (converged)' : ''}. Monotone: {bw.data.monotonic ? 'yes' : 'no'}.
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-400">Learned A (from a random start)</div>
              <MatrixTable values={bw.data.after.A} rowLabels={['S1', 'S2', 'S3']} colLabels={['S1', 'S2', 'S3']} compact format={(v) => (v === null ? 'n/a' : v.toFixed(3))} />
              <div className="text-xs text-slate-400">Learned B</div>
              <MatrixTable values={bw.data.after.B} rowLabels={['S1', 'S2', 'S3']} colLabels={bw.data.after.observations} compact format={(v) => (v === null ? 'n/a' : v.toFixed(3))} />
              <p className="text-xs text-slate-500">
                States are labelled S1 to S3 because EM from a random start does not know which learned state is “Browsing”. Interpreting them requires looking at
                their emission rows (label switching).
              </p>
            </div>
          </div>
        )}
      </Demo>
      <KeyIdea>
        MLE is the objective. EM is the strategy. Baum-Welch is EM for HMMs. Forward-Backward is the engine of its E-step.
      </KeyIdea>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 11 */

export function Chapter11() {
  const items = [
    {
      icon: ShoppingBag,
      title: 'Personalized recommendations',
      body: 'Browsing customers benefit from discovery (similar items, popular products). Interested customers benefit from comparison help (reviews, specs). Ready customers benefit from fewer distractions.',
    },
    {
      icon: Users,
      title: 'Customer segmentation',
      body: 'Decoded state paths and posterior summaries (e.g. time spent Interested) are behavioural features for clustering sessions into segments such as window-shoppers or decisive buyers.',
    },
    {
      icon: BellRing,
      title: 'Marketing intervention',
      body: 'Trigger a saved-cart reminder or a time-limited offer when the model believes the customer is Interested but drifting back to Browsing, not when they are about to buy anyway.',
    },
    {
      icon: Gauge,
      title: 'Purchase readiness estimation',
      body: 'P(next action = Purchase | history) is a live readiness score. It can prioritise support chat, choose which checkout variant to show, or forecast short-term demand.',
    },
    {
      icon: BarChart3,
      title: 'Real-time e-commerce analytics',
      body: 'The forward recursion updates in O(N²) per click, so beliefs can be maintained for thousands of concurrent sessions and aggregated into a live intent dashboard.',
    },
    {
      icon: Layers,
      title: 'Beyond e-commerce',
      body: 'The same machinery underlies speech recognition, part-of-speech tagging, gene finding and fraud detection: any problem where a hidden regime produces noisy observations over time.',
    },
  ]
  return (
    <>
      <Prose>
        <p>
          Once intent can be inferred, it can drive decisions. All of the following use exactly the quantities computed in this application: filtered
          beliefs, posterior probabilities, decoded paths and next-action forecasts.
        </p>
      </Prose>
      <div className="mt-5 grid grid-cols-1 max-w-5xl gap-3 md:grid-cols-2">
        {items.map((it) => (
          <div key={it.title} className="rounded-xl border border-ink-700 bg-ink-900/60 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-100">
              <it.icon className="size-4 text-accent-soft" />
              {it.title}
            </div>
            <p className="text-sm leading-relaxed text-slate-400">{it.body}</p>
          </div>
        ))}
      </div>
      <Callout kind="info" title="Ethics">
        Intent models influence what people see and pay. Interventions should help customers (clearer information, fewer obstacles) rather than exploit moments of
        hesitation, and behavioural data must be collected and stored with consent.
      </Callout>
    </>
  )
}

/* ---------------------------------------------------------------- Chapter 12 */

export function Chapter12() {
  const limits = [
    ['Synthetic training data', 'All 600 sequences are simulated from a known generator. A model trained on them describes the simulator, not real shoppers.'],
    ['Assumed hidden states', 'Three intentions is a design choice. Real behaviour may need more states, and nothing guarantees learned states match human labels.'],
    ['Simplified behaviour', 'Five action types ignore products, prices, time between clicks, device and traffic source. Exit does not end the modelled session.'],
    ['First-order Markov assumption', 'The next intention depends only on the current one. Long-range effects (e.g. a visit last week) are ignored.'],
    ['Fixed, time-homogeneous parameters', 'The same A and B apply to every customer and every moment. Different customer types are mixed together.'],
    ['No guarantee of purchase', 'The output is a model probability for the next action, not a calibrated conversion rate. It has not been validated against real outcomes.'],
    ['Local optima', 'Baum-Welch converges to a local maximum that depends on initialisation.'],
  ]
  const future = [
    'Validate on real clickstream data (e.g. public e-commerce session datasets such as RetailRocket or YOOCHOOSE) with held-out purchase outcomes.',
    'Choose the number of hidden states with cross-validated likelihood, AIC or BIC.',
    'Add context: input-output HMMs or features such as dwell time, price and product category.',
    'Explicit-duration or hierarchical HMMs to model session length and customer segments.',
    'Calibrate the purchase probability (e.g. Platt scaling) and compare against logistic regression, gradient boosting and recurrent neural networks.',
    'Deploy the forward recursion as a streaming service for real-time scoring.',
  ]
  const viva = [
    ['Why an HMM rather than a classifier?', 'The customer’s intent is a latent variable that evolves over time; an HMM models that evolution and the noisy link to observed actions explicitly, and gives interpretable parameters.'],
    ['What does P(O | λ) tell you?', 'How well the model explains a sequence. It is used to compare models and is the objective that training maximises.'],
    ['Why not predict on a journey containing Purchase?', 'That would be target leakage: the answer is already in the input. We forecast only from prefixes before the purchase.'],
    ['How do you avoid underflow?', 'Scaled forward/backward variables with log-likelihood accumulated from the scale factors, and Viterbi in log space.'],
    ['What is the complexity?', 'O(T·N²) time for Forward, Backward and Viterbi; Baum-Welch is O(I·K·T·N²) for I iterations over K sequences.'],
    ['How did you verify correctness?', 'Automated tests compare Forward, Backward, posteriors and Viterbi with brute-force enumeration over all paths, and check that Baum-Welch never decreases the likelihood.'],
  ]
  return (
    <>
      <H>Limitations</H>
      <div className="max-w-4xl space-y-2">
        {limits.map(([t, d]) => (
          <div key={t} className="rounded-lg border border-ink-700 bg-ink-900/60 px-4 py-3">
            <div className="text-sm font-semibold text-slate-100">{t}</div>
            <div className="mt-0.5 text-sm text-slate-400">{d}</div>
          </div>
        ))}
      </div>
      <H>Future scope</H>
      <Prose>
        <ul>
          {future.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </Prose>
      <H>Questions to prepare for a presentation or viva</H>
      <div className="max-w-4xl divide-y divide-ink-700/70 rounded-xl border border-ink-700 bg-ink-900/50">
        {viva.map(([q, a]) => (
          <details key={q} className="group px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-medium text-slate-200 marker:hidden">
              <span className="mr-2 text-accent-soft group-open:rotate-90">›</span>
              {q}
            </summary>
            <p className="mt-2 pl-4 text-sm leading-relaxed text-slate-400">{a}</p>
          </details>
        ))}
      </div>
      <KeyIdea>
        This project demonstrates the <em>mechanics</em> of HMM-based intent inference end to end. Turning it into a production system requires real data, validation
        and calibration.
      </KeyIdea>
      <Prose>
        <p className="text-slate-500">
          Model summary: N = 3 states ({STATE_SHORT.join(', ')}), M = 5 observations, <Tex>{String.raw`\lambda = (A, B, \pi)`}</Tex>.
        </p>
      </Prose>
    </>
  )
}
