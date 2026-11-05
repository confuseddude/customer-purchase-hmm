import { useState } from 'react'
import { DistributionBars, StateLegend } from '../components/Distribution'
import { HmmDiagram } from '../components/HmmDiagram'
import { JourneyBuilder, JourneyTimeline, ObsChip } from '../components/Journey'
import { StepControls } from '../components/StepControls'
import { Tex } from '../components/Tex'
import { Callout, Card, ErrorBox, Loading, PageHeader, Tabs } from '../components/ui'
import { useAppState } from '../hooks/useAppState'
import { useAsync } from '../hooks/useAsync'
import { OBS_META, STATE_COLORS, STATE_NAMES } from '../lib/constants'
import { pct } from '../lib/format'
import { api } from '../services/api'

export function VisualizationPage() {
  const { model, sequence, setSequence, modelVersion } = useAppState()
  const [selected, setSelected] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [view, setView] = useState<'filtered' | 'smoothed'>('filtered')

  const fb = useAsync(() => api.forwardBackward(sequence), [sequence.join(','), modelVersion], sequence.length > 0)

  if (!model) return <Loading label="Loading model…" />

  const T = sequence.length
  const s = Math.min(step, T)
  const weights =
    s === 0 ? model.pi : fb.data ? (view === 'filtered' ? fb.data.filtered[s - 1] : fb.data.gamma[s - 1]) : null
  const activeObs = s > 0 ? model.observations.indexOf(sequence[s - 1]) : null

  return (
    <div className="space-y-6">
      <PageHeader title="HMM Visualization">
        Three hidden intentions are connected by transition probabilities (arrows, A). Each hidden state <em>generates</em> observable actions with its own
        emission probabilities (lines down to the actions, B). Click a state to inspect it.
      </PageHeader>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="State diagram" subtitle="Arrow thickness shows transition probability, line thickness shows emission probability" pad={false}>
          <div className="px-3 pt-3 pb-1">
            <HmmDiagram model={model} selected={selected} onSelect={setSelected} weights={T > 0 || s === 0 ? weights : null} activeObs={activeObs} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-ink-700/70 px-5 py-3 text-xs text-slate-500">
            <StateLegend note="The ring around a state shows its probability at the current step." />
          </div>
        </Card>

        <div className="space-y-5">
          {selected === null ? (
            <Card title="Select a state">
              <p className="text-sm leading-relaxed text-slate-400">
                Click <span style={{ color: STATE_COLORS[0] }}>Browsing</span>, <span style={{ color: STATE_COLORS[1] }}>Interested</span> or{' '}
                <span style={{ color: STATE_COLORS[2] }}>Ready to Purchase</span> in the diagram to see what it means and its initial, transition and emission
                probabilities.
              </p>
              <div className="mt-4">
                <Callout kind="info">Hidden states are modelling assumptions. No customer is ever labelled “Interested”; the model infers it from behaviour.</Callout>
              </div>
            </Card>
          ) : (
            <StateDetail i={selected} />
          )}
        </div>
      </div>

      <Card title="Step-by-step: how the model reads a customer sequence" subtitle="Values come from the backend Forward-Backward call for the current journey">
        <div className="space-y-5">
          <JourneyBuilder seq={sequence} onChange={(q) => { setSequence(q); setStep(0) }} compact />
          {T === 0 ? (
            <p className="text-sm text-slate-500">Add at least one action to animate the inference.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs
                  tabs={[
                    { id: 'filtered', label: 'Online (Forward, filtered)' },
                    { id: 'smoothed', label: 'Hindsight (Forward-Backward)' },
                  ]}
                  value={view}
                  onChange={setView}
                />
                <span className="text-xs text-slate-500">
                  {view === 'filtered' ? (
                    <Tex>{String.raw`P(q_t = i \mid O_1,\dots,O_t)`}</Tex>
                  ) : (
                    <Tex>{String.raw`P(q_t = i \mid O_1,\dots,O_T)`}</Tex>
                  )}
                </span>
              </div>
              <StepControls
                step={s}
                total={T}
                onStep={setStep}
                labels={['Before any action: π', ...sequence.map((o, i) => `t = ${i + 1} · observed ${o}`)]}
              />
              <ErrorBox error={fb.error} />
              {fb.loading && <Loading />}
              {fb.data && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                  <JourneyTimeline
                    seq={sequence}
                    distributions={(view === 'filtered' ? fb.data.filtered : fb.data.gamma).map((d, i) => (i < s ? d : [0, 0, 0]))}
                    activeIndex={s > 0 ? s - 1 : undefined}
                  />
                  <div className="rounded-lg border border-ink-700 bg-ink-900/50 p-4">
                    <div className="mb-3 text-sm text-slate-300">
                      {s === 0 ? (
                        'Before seeing anything, the model believes the initial distribution π.'
                      ) : (
                        <>
                          At <span className="num">t = {s}</span> the customer did <ObsChip name={sequence[s - 1]} size="sm" />. {narrate(view, s, T)}
                        </>
                      )}
                    </div>
                    {weights && <DistributionBars values={weights} />}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Card title="Hidden states generate observable actions">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="prose-lab text-sm">
            <p>
              <strong>Generative story.</strong> At time 1 the customer’s intention is drawn from π. At every step they emit an action drawn from the row of B
              for their current intention, then their intention moves according to the row of A.
            </p>
          </div>
          <div className="prose-lab text-sm">
            <p>
              <strong>Inference reverses it.</strong> We only see the actions. Bayes’ rule, applied efficiently by the Forward and Backward recursions, turns the
              observed actions back into probabilities over hidden intentions.
            </p>
          </div>
          <div className="text-sm">
            <Tex block>{String.raw`P(O, Q \mid \lambda) = \pi_{q_1} b_{q_1}(O_1) \prod_{t=2}^{T} a_{q_{t-1} q_t}\, b_{q_t}(O_t)`}</Tex>
          </div>
        </div>
      </Card>
    </div>
  )

  function StateDetail({ i }: { i: number }) {
    const m = model!
    const color = STATE_COLORS[i]
    return (
      <Card title={<span style={{ color }}>{STATE_NAMES[i]}</span>} subtitle={m.state_descriptions[STATE_NAMES[i]]}>
        <div className="space-y-5">
          <div className="flex items-baseline justify-between">
            <span className="text-[0.8125rem] text-slate-400">Initial probability π</span>
            <span className="num text-lg text-white">{m.pi[i].toFixed(2)}</span>
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] text-slate-400">Transitions out of this state (row {i + 1} of A)</div>
            <DistributionBars values={m.A[i]} highlightMax={false} dense />
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] text-slate-400">Transitions into this state (column {i + 1} of A)</div>
            <ul className="space-y-1 text-[0.8125rem] text-slate-300">
              {m.A.map((row, k) => (
                <li key={k} className="flex justify-between">
                  <span style={{ color: STATE_COLORS[k] }}>from {STATE_NAMES[k]}</span>
                  <span className="num">{row[i].toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="mb-2 text-[0.8125rem] text-slate-400">Emission probabilities (row {i + 1} of B)</div>
            <DistributionBars values={m.B[i]} labels={m.observations} colors={m.observations.map((o) => OBS_META[o].color)} highlightMax dense />
          </div>
          <p className="text-xs text-slate-500">
            Most typical action: <strong className="text-slate-300">{m.observations[m.B[i].indexOf(Math.max(...m.B[i]))]}</strong> ({pct(Math.max(...m.B[i]))}). Probability
            of staying in this state for the next step: <strong className="text-slate-300">{pct(m.A[i][i], 0)}</strong>.
          </p>
        </div>
      </Card>
    )
  }
}

function narrate(view: 'filtered' | 'smoothed', s: number, T: number) {
  if (view === 'filtered') return 'Using only actions up to now, the belief over intentions is:'
  if (s === T) return 'At the last step, hindsight and online beliefs coincide:'
  return `Using all ${T} actions (including the ${T - s} that come later), the belief at this step is:`
}
