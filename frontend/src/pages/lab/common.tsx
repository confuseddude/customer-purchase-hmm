import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Tex } from '../../components/Tex'
import { Card, cx } from '../../components/ui'
import { STATE_COLORS, STATE_SHORT } from '../../lib/constants'

/** The fixed explanatory frame shared by every Algorithm Lab tab. */
export function AlgoIntro({ what, why, children }: { what: ReactNode; why: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <Card>
        <div className="prose-lab space-y-4 text-sm">
          <div>
            <h3 className="mb-1 text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-100">What it does</h3>
            {what}
          </div>
          <div>
            <h3 className="mb-1 text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-100">Why it is necessary</h3>
            {why}
          </div>
        </div>
      </Card>
      <Card title="Mathematical formulation">{children}</Card>
    </div>
  )
}

export function StateLabel({ i }: { i: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="size-2 rounded-[2px]" style={{ backgroundColor: STATE_COLORS[i] }} />
      {STATE_SHORT[i]}
    </span>
  )
}

export function ColumnLabel({ t, obs }: { t: number; obs: string }) {
  return (
    <span className="flex flex-col items-center leading-tight">
      <span className="num text-xs text-slate-500">t = {t}</span>
      <span className="text-slate-300">{obs}</span>
    </span>
  )
}

/** An expandable equation with numerical substitution. */
export function CalcLine({ title, tex, defaultOpen = false, color }: { title: ReactNode; tex: string[]; defaultOpen?: boolean; color?: string }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-lg bg-ink-900">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm text-slate-200 transition-colors duration-150 hover:bg-ink-800/60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {color && <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />}
          <span className="min-w-0">{title}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs text-accent-soft">
          {open ? 'Hide' : 'Show'} calculation
          <ChevronDown className={cx('size-3.5 transition-transform duration-150', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="animate-fade-up border-t border-ink-700 px-3.5 py-2">
          {tex.map((t, k) => (
            <Tex key={k} block>
              {t}
            </Tex>
          ))}
        </div>
      )}
    </div>
  )
}

export function ResultPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-accent/30 bg-ink-850 p-5">
      <h3 className="mb-2 text-[0.9375rem] font-semibold tracking-[-0.01em] text-white">{title}</h3>
      <div className="text-[0.9375rem] leading-relaxed text-slate-300">{children}</div>
    </div>
  )
}
