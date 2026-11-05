import { JourneyBuilder } from '../components/Journey'
import { Card, ErrorBox, Loading, PageHeader, Tabs } from '../components/ui'
import { useAppState } from '../hooks/useAppState'
import { useAsync } from '../hooks/useAsync'
import { navigate } from '../hooks/useRoute'
import { api } from '../services/api'
import { BackwardTab } from './lab/BackwardTab'
import { ForwardBackwardTab } from './lab/ForwardBackwardTab'
import { ForwardTab } from './lab/ForwardTab'
import { LearningTab } from './lab/LearningTab'
import { ViterbiTab } from './lab/ViterbiTab'

type TabId = 'forward' | 'backward' | 'forward-backward' | 'viterbi' | 'learning'
const TABS: { id: TabId; label: string }[] = [
  { id: 'forward', label: 'Forward' },
  { id: 'backward', label: 'Backward' },
  { id: 'forward-backward', label: 'Forward-Backward' },
  { id: 'viterbi', label: 'Viterbi' },
  { id: 'learning', label: 'MLE / Baum-Welch' },
]

export function AlgorithmLabPage({ sub }: { sub?: string }) {
  const tab: TabId = (TABS.find((t) => t.id === sub)?.id ?? 'forward') as TabId
  const { sequence, setSequence, modelVersion } = useAppState()
  const seqKey = sequence.join(',')
  const enabled = sequence.length > 0

  return (
    <div className="space-y-5">
      <PageHeader title="Algorithm Lab">
        Walk through every HMM algorithm one step at a time on the current customer journey. All tables, equations and results are computed by the NumPy backend
        and returned with their intermediate values.
      </PageHeader>

      <Card title="Customer sequence under analysis" subtitle="Changes here update every tab">
        <JourneyBuilder seq={sequence} onChange={setSequence} compact />
      </Card>

      <Tabs tabs={TABS} value={tab} onChange={(t) => navigate(`/lab/${t}`)} />

      {tab === 'learning' ? (
        <LearningTab sequence={sequence} />
      ) : !enabled ? (
        <div className="rounded-xl border border-dashed border-ink-600 px-6 py-10 text-center text-sm text-slate-500">
          Add at least one action to the sequence to run the algorithms.
        </div>
      ) : (
        <TabBody key={tab} tab={tab} seqKey={`${seqKey}:${modelVersion}`} sequence={sequence} />
      )}
    </div>
  )
}

function TabBody({ tab, seqKey, sequence }: { tab: Exclude<TabId, 'learning'>; seqKey: string; sequence: string[] }) {
  const fn = {
    forward: () => api.forward(sequence),
    backward: () => api.backward(sequence),
    'forward-backward': () => api.forwardBackward(sequence),
    viterbi: () => api.viterbi(sequence),
  }[tab]
  const res = useAsync<unknown>(fn, [tab, seqKey])
  if (res.error) return <ErrorBox error={res.error} onRetry={res.reload} />
  if (res.loading || !res.data) return <Loading />
  // key on the sequence so step state resets when the journey changes
  switch (tab) {
    case 'forward':
      return <ForwardTab key={seqKey} data={res.data as Parameters<typeof ForwardTab>[0]['data']} />
    case 'backward':
      return <BackwardTab key={seqKey} data={res.data as Parameters<typeof BackwardTab>[0]['data']} />
    case 'forward-backward':
      return <ForwardBackwardTab key={seqKey} data={res.data as Parameters<typeof ForwardBackwardTab>[0]['data']} />
    case 'viterbi':
      return <ViterbiTab key={seqKey} data={res.data as Parameters<typeof ViterbiTab>[0]['data']} />
  }
}
