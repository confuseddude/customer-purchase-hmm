import {
  BookOpen,
  BrainCircuit,
  ChartSpline,
  Database,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Network,
  SlidersHorizontal,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { cx } from './components/ui'
import { useAppState } from './hooks/useAppState'
import { useRoute } from './hooks/useRoute'
import { AlgorithmLabPage } from './pages/AlgorithmLabPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { ConfigPage } from './pages/ConfigPage'
import { DatasetPage } from './pages/DatasetPage'
import { LearnPage } from './pages/LearnPage'
import { OverviewPage } from './pages/OverviewPage'
import { SimulatorPage } from './pages/SimulatorPage'
import { TrainingPage } from './pages/TrainingPage'
import { VisualizationPage } from './pages/VisualizationPage'

interface NavItem {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
  page: ComponentType<{ sub?: string }>
}

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Workspace',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard, page: OverviewPage },
      { id: 'simulator', label: 'Customer Simulator', icon: UserRound, page: SimulatorPage },
      { id: 'model', label: 'HMM Visualization', icon: Network, page: VisualizationPage },
      { id: 'lab', label: 'Algorithm Lab', icon: FlaskConical, page: AlgorithmLabPage },
      { id: 'analysis', label: 'Prediction Analysis', icon: ChartSpline, page: AnalysisPage },
    ],
  },
  {
    group: 'Model',
    items: [
      { id: 'training', label: 'Model Training', icon: BrainCircuit, page: TrainingPage },
      { id: 'dataset', label: 'Dataset Explorer', icon: Database, page: DatasetPage },
      { id: 'config', label: 'Model Configuration', icon: SlidersHorizontal, page: ConfigPage },
    ],
  },
  {
    group: 'Learn',
    items: [{ id: 'learn', label: 'Learn the Project', icon: GraduationCap, page: LearnPage }],
  },
]

const ALL = NAV.flatMap((g) => g.items)

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M12.5 11h7M11 14l3 6M21 14l-3 6" stroke="#8894b0" strokeWidth="1.5" />
      <circle cx="9" cy="11" r="4" fill="#4288e0" />
      <circle cx="23" cy="11" r="4" fill="#c4872a" />
      <circle cx="16" cy="23" r="4" fill="#1fa97c" />
    </svg>
  )
}

export default function App() {
  const [section = 'overview', sub] = useRoute()
  const { health, modelError, model } = useAppState()
  const [open, setOpen] = useState(false)
  const current = ALL.find((n) => n.id === section) ?? ALL[0]
  const Page = current.page

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const nav = (
    <nav className="flex min-h-full flex-col gap-6 px-3 py-5">
      <a href="#/overview" className="flex items-center gap-2.5 rounded-lg px-2" onClick={() => setOpen(false)}>
        <Logo className="size-8" />
        <div className="leading-tight">
          <div className="text-[0.9375rem] font-semibold text-white">Purchase Intent</div>
          <div className="text-xs text-slate-400">Hidden Markov Model Lab</div>
        </div>
      </a>
      {NAV.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 px-2.5 text-xs font-medium text-slate-500">{g.group}</div>
          <ul className="space-y-0.5">
            {g.items.map((n) => {
              const active = n.id === current.id
              return (
                <li key={n.id}>
                  <a
                    href={`#/${n.id}`}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150',
                      active ? 'bg-ink-800 font-medium text-white' : 'text-slate-400 hover:bg-ink-800/70 hover:text-slate-200',
                    )}
                  >
                    <n.icon className={cx('size-4', active ? 'text-accent-soft' : 'text-slate-500')} />
                    {n.label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-1.5 border-t border-ink-700 px-2.5 pt-4 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <span className={cx('size-2 rounded-full', modelError ? 'bg-red-400' : health ? 'bg-emerald-400' : 'bg-amber-400')} />
          {modelError ? 'Backend offline' : health ? 'Backend connected' : 'Connecting…'}
        </div>
        {model && (
          <div className="text-slate-400">
            Active model: <span className="text-slate-200">{model.name}</span>
          </div>
        )}
        <div className="flex items-start gap-1.5 text-slate-400">
          <BookOpen className="mt-0.5 size-3 shrink-0" /> Simulated data and illustrative parameters
        </div>
      </div>
    </nav>
  )

  return (
    <div className="min-h-dvh lg:grid grid-cols-1 lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto border-r border-ink-700 bg-ink-900 lg:block">{nav}</aside>

      {/* mobile header */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-700 bg-ink-900 px-4 py-2.5 lg:hidden">
        <a href="#/overview" className="flex items-center gap-2 text-sm font-semibold text-white">
          <Logo className="size-6" /> Purchase Intent HMM Lab
        </a>
        <button onClick={() => setOpen(true)} className="flex size-10 items-center justify-center rounded-lg text-slate-300 hover:bg-ink-800" aria-label="Open navigation">
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink-950/70" onClick={() => setOpen(false)} />
          <aside className="animate-drawer absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-ink-700 bg-ink-900">
            <button onClick={() => setOpen(false)} className="absolute top-3.5 right-2 flex size-10 items-center justify-center rounded-lg text-slate-400 hover:bg-ink-800" aria-label="Close navigation">
              <X className="size-5" />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        {modelError && (
          <div role="alert" className="mb-6 rounded-lg border border-red-400/30 bg-ink-800/50 px-4 py-3 text-sm text-red-200">
            <strong className="font-semibold">Backend unavailable.</strong> {modelError.message} Start it with{' '}
            <code className="num rounded bg-ink-800 px-1.5 py-0.5 text-red-100">uvicorn app.main:app --port 8000</code> in the{' '}
            <code className="num">backend</code> folder, then reload.
          </div>
        )}
        <div className="animate-fade-up mx-auto max-w-[1240px]" key={current.id + (sub ?? '')}>
          <Page sub={sub} />
        </div>
      </main>
    </div>
  )
}
