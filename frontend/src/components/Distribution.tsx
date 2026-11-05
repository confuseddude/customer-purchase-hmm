import { STATE_COLORS, STATE_NAMES } from '../lib/constants'
import { pct } from '../lib/format'
import { cx } from './ui'

/** The key for state colours, shared by every chart that uses them. */
export function StateLegend({ note }: { note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
      {STATE_NAMES.map((n, i) => (
        <span key={n} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: STATE_COLORS[i] }} />
          {n}
        </span>
      ))}
      {note && <span className="text-slate-500">{note}</span>}
    </div>
  )
}

/** Horizontal bars for a probability vector (from the backend). */
export function DistributionBars({
  values,
  labels = [...STATE_NAMES],
  colors = [...STATE_COLORS],
  highlightMax = true,
  dense = false,
}: {
  values: number[]
  labels?: string[]
  colors?: string[]
  highlightMax?: boolean
  dense?: boolean
}) {
  const max = Math.max(...values)
  return (
    <div className={cx(dense ? 'space-y-1.5' : 'space-y-2.5')}>
      {values.map((v, i) => {
        const isMax = highlightMax && v === max
        return (
          <div key={i} className="grid grid-cols-[minmax(0,8.5rem)_1fr_3.6rem] items-center gap-3">
            <span className={cx('truncate text-[0.8125rem]', isMax ? 'font-semibold text-white' : 'text-slate-400')}>{labels[i]}</span>
            <div className={cx('overflow-hidden rounded-full bg-ink-700/70', dense ? 'h-1.5' : 'h-2.5')}>
              <div
                className="h-full rounded-full transition-[width] duration-300 ease-out"
                style={{ width: `${Math.max(v * 100, 0.5)}%`, backgroundColor: colors[i % colors.length] }}
              />
            </div>
            <span className={cx('num text-right text-[0.8125rem]', isMax ? 'text-white' : 'text-slate-400')}>{pct(v)}</span>
          </div>
        )
      })}
    </div>
  )
}

/** A single stacked bar of a distribution. */
export function StackedBar({ values, height = 8 }: { values: number[]; height?: number }) {
  return (
    <div className="flex w-full overflow-hidden rounded-full bg-ink-700" style={{ height }}>
      {values.map((p, s) => (
        <div key={s} title={`${STATE_NAMES[s]}: ${pct(p)}`} style={{ width: `${p * 100}%`, backgroundColor: STATE_COLORS[s] }} />
      ))}
    </div>
  )
}
