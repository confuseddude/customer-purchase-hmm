import type { ReactNode } from 'react'
import { fmt } from '../lib/format'
import { cx } from './ui'

/**
 * Displays a numeric matrix with labelled rows/columns and optional heat shading.
 * Values are rendered exactly as received from the backend.
 */
export function MatrixTable({
  values,
  rowLabels,
  colLabels,
  corner,
  color = '#7c8cff',
  heat = true,
  rowSums = false,
  highlight,
  revealed,
  onCellClick,
  selected,
  compact = false,
  format = fmt,
  normalizeHeat = 'global',
}: {
  values: (number | null)[][]
  rowLabels: ReactNode[]
  colLabels: ReactNode[]
  corner?: ReactNode
  color?: string
  heat?: boolean
  rowSums?: boolean
  highlight?: (r: number, c: number) => boolean
  revealed?: (r: number, c: number) => boolean
  onCellClick?: (r: number, c: number) => void
  selected?: [number, number] | null
  compact?: boolean
  format?: (x: number | null) => string
  normalizeHeat?: 'global' | 'column' | 'row'
}) {
  const flat = values.flat().filter((v): v is number => typeof v === 'number')
  const gmax = Math.max(...flat, 1e-300)
  const colMax = colLabels.map((_, c) => Math.max(...values.map((r) => r[c] ?? 0), 1e-300))
  const rowMax = values.map((r) => Math.max(...r.map((v) => v ?? 0), 1e-300))
  const intensity = (v: number, r: number, c: number) =>
    normalizeHeat === 'column' ? v / colMax[c] : normalizeHeat === 'row' ? v / rowMax[r] : v / gmax

  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full border-separate border-spacing-0 text-left', compact ? 'text-[0.8125rem]' : 'text-sm')}>
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-ink-850 px-2.5 py-2 text-xs font-medium text-slate-500">{corner}</th>
            {colLabels.map((l, i) => (
              <th key={i} className="px-2.5 py-2 text-center text-xs font-medium whitespace-nowrap text-slate-400">
                {l}
              </th>
            ))}
            {rowSums && <th className="px-2.5 py-2 text-center text-xs font-medium text-slate-500">Σ row</th>}
          </tr>
        </thead>
        <tbody>
          {values.map((row, r) => {
            const sum = row.reduce<number>((a, b) => a + (b ?? 0), 0)
            return (
              <tr key={r}>
                <th className="sticky left-0 z-10 border-t border-ink-700/60 bg-ink-850 px-2.5 py-1.5 text-[0.8125rem] font-medium whitespace-nowrap text-slate-300">
                  {rowLabels[r]}
                </th>
                {row.map((v, c) => {
                  const shown = revealed ? revealed(r, c) : true
                  const isSel = selected && selected[0] === r && selected[1] === c
                  const hl = highlight?.(r, c)
                  const a = shown && heat && typeof v === 'number' ? Math.min(1, intensity(v, r, c)) : 0
                  return (
                    <td
                      key={c}
                      onClick={onCellClick && shown ? () => onCellClick(r, c) : undefined}
                      className={cx(
                        'num border-t border-ink-700/60 px-2.5 py-1.5 text-center whitespace-nowrap transition-colors',
                        onCellClick && shown && 'cursor-pointer hover:outline hover:outline-1 hover:outline-accent/60',
                        isSel && 'outline outline-2 -outline-offset-2 outline-accent',
                        hl && 'font-semibold text-white',
                        !shown && 'text-slate-700',
                      )}
                      style={{
                        backgroundColor: shown && heat ? `${color}${Math.round(a * 0.42 * 255).toString(16).padStart(2, '0')}` : undefined,
                        boxShadow: hl ? `inset 0 0 0 1.5px ${color}` : undefined,
                        color: shown && !hl ? (a > 0.55 ? '#ffffff' : '#c8d0e6') : undefined,
                      }}
                    >
                      {shown ? format(v) : '·'}
                    </td>
                  )
                })}
                {rowSums && (
                  <td
                    className={cx(
                      'num border-t border-ink-700/60 px-2.5 py-1.5 text-center text-[0.8125rem]',
                      Math.abs(sum - 1) < 1e-6 ? 'text-emerald-400/80' : 'text-red-400',
                    )}
                  >
                    {sum.toFixed(3)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
