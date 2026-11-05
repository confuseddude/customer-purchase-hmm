import { ArrowRight, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { EXAMPLES, OBS_META, OBS_NAMES, STATE_COLORS, STATE_SHORT } from '../lib/constants'
import type { ObservationName } from '../types'
import { Button, cx } from './ui'

export function ObsChip({ name, size = 'md', active }: { name: ObservationName; size?: 'sm' | 'md'; active?: boolean }) {
  const meta = OBS_META[name]
  const Icon = meta.icon
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md bg-ink-800 font-medium whitespace-nowrap text-slate-200',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-[0.8125rem]',
        active && 'ring-2 ring-accent/70',
      )}
    >
      <Icon className={size === 'sm' ? 'size-3' : 'size-3.5'} style={{ color: meta.color }} />
      {name}
    </span>
  )
}

export function StateChip({ state, size = 'md', prob }: { state: number; size?: 'sm' | 'md'; prob?: number }) {
  const c = STATE_COLORS[state]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-md bg-ink-800 font-medium whitespace-nowrap text-slate-100',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-[0.8125rem]',
      )}
    >
      <span className="size-2 rounded-[2px]" style={{ backgroundColor: c }} />
      {STATE_SHORT[state]}
      {prob !== undefined && <span className="num text-[0.9em] opacity-80">{(prob * 100).toFixed(0)}%</span>}
    </span>
  )
}

/** Inline "View → Cart → …" sequence. */
export function SequenceInline({ seq, size = 'sm' }: { seq: ObservationName[]; size?: 'sm' | 'md' }) {
  if (seq.length === 0) return <span className="text-sm text-slate-500 italic">empty journey</span>
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {seq.map((o, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          {i > 0 && <ArrowRight className="size-3 text-slate-600" />}
          <ObsChip name={o} size={size} />
        </span>
      ))}
    </span>
  )
}

/** Horizontal timeline. Optionally annotates each step with a hidden-state distribution from the backend. */
export function JourneyTimeline({
  seq,
  states,
  distributions,
  activeIndex,
  onRemove,
}: {
  seq: ObservationName[]
  states?: number[]
  distributions?: number[][]
  activeIndex?: number
  onRemove?: (i: number) => void
}) {
  if (seq.length === 0)
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-ink-600 text-sm text-slate-500">
        No actions yet. Add customer actions to build a journey.
      </div>
    )
  return (
    <div className="overflow-x-auto pt-2 pr-2 pb-2">
      <ol className="flex min-w-max items-start gap-0">
        {seq.map((o, i) => {
          const meta = OBS_META[o]
          const Icon = meta.icon
          return (
            <li key={i} className="flex items-start">
              {i > 0 && <div className="mt-9 h-px w-4 bg-ink-600 sm:w-5" />}
              <div
                className={cx(
                  'group relative flex w-[92px] flex-col items-center gap-1.5 rounded-lg px-2 py-2.5 transition-colors duration-150',
                  activeIndex === i ? 'bg-accent/15 ring-1 ring-accent/60' : 'bg-ink-800/70',
                )}
              >
                <span className="num text-xs text-slate-500">t = {i + 1}</span>
                <Icon className="size-5" style={{ color: meta.color }} />
                <span className="text-[0.8125rem] font-medium text-slate-200">{o}</span>
                {states && states[i] !== undefined && <StateChip state={states[i]} size="sm" />}
                {distributions && distributions[i] && (
                  <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-ink-700" title="hidden-state distribution">
                    {distributions[i].map((p, s) => (
                      <div key={s} style={{ width: `${p * 100}%`, backgroundColor: STATE_COLORS[s] }} />
                    ))}
                  </div>
                )}
                {onRemove && (
                  <button
                    onClick={() => onRemove(i)}
                    className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-ink-600 bg-ink-800 text-slate-300 opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-red-300 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
                    aria-label={`Remove step ${i + 1}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** Action buttons + timeline + example journeys. Writes to the provided setter. */
export function JourneyBuilder({
  seq,
  onChange,
  compact = false,
  maxLength = 30,
}: {
  seq: ObservationName[]
  onChange: (s: ObservationName[]) => void
  compact?: boolean
  maxLength?: number
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {OBS_NAMES.map((o) => {
          const meta = OBS_META[o]
          const Icon = meta.icon
          return (
            <button
              key={o}
              disabled={seq.length >= maxLength}
              onClick={() => onChange([...seq, o])}
              title={meta.hint}
              className={cx(
                'group inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 font-medium text-slate-200 transition-[background-color,border-color,transform] duration-150 ease-out hover:border-ink-500 hover:bg-ink-700 active:scale-[0.97] disabled:opacity-40',
                compact ? 'h-8 px-2.5 text-[0.8125rem]' : 'h-10 px-3.5 text-sm',
              )}
            >
              <Plus className="size-3 text-slate-400 group-hover:text-slate-200" />
              <Icon className="size-4" style={{ color: meta.color }} />
              {o}
            </button>
          )
        })}
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => onChange(seq.slice(0, -1))} disabled={seq.length === 0}>
            <Trash2 className="size-3.5" /> Undo
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onChange([])} disabled={seq.length === 0}>
            <RotateCcw className="size-3.5" /> Reset
          </Button>
        </div>
      </div>
      {!compact && <JourneyTimeline seq={seq} onRemove={(i) => onChange(seq.filter((_, k) => k !== i))} />}
      {compact && (
        <div className="min-h-8 rounded-lg bg-ink-900 px-3 py-2">
          <SequenceInline seq={seq} />
        </div>
      )}
      {compact && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Examples:</span>
          {EXAMPLES.map((e) => (
            <button
              key={e.id}
              onClick={() => onChange([...e.observations])}
              className="rounded-md bg-ink-800 px-2 py-1 text-xs text-slate-300 transition-colors duration-150 hover:bg-ink-700 hover:text-white"
              title={e.observations.join(' → ')}
            >
              <span className="font-semibold text-accent-soft">{e.id}</span> {e.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
