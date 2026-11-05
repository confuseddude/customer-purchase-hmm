import { OBS_META, STATE_COLORS, STATE_NAMES, STATE_SHORT } from '../lib/constants'
import { pct } from '../lib/format'
import type { ObservationName } from '../types'
import { StateLegend } from './Distribution'

const W = 1000
const GAP = 2
/** Drawn top to bottom, so belief climbs towards Ready as a journey warms up. */
const STACK_ORDER = [2, 1, 0]

interface Segment {
  state: number
  y0: number
  y1: number
}

function stack(dist: number[], height: number): Segment[] {
  const usable = height - GAP * (STACK_ORDER.length - 1)
  let y = 0
  return STACK_ORDER.map((state) => {
    const h = dist[state] * usable
    const seg = { state, y0: y, y1: y + h }
    y += h + GAP
    return seg
  })
}

/**
 * The HMM drawn as it is defined: a hidden lane above an observed lane.
 * Bars are backend probabilities for each step; ribbons link the same state across steps.
 */
export function IntentTrellis({
  observations,
  beliefs,
  path,
  height = 148,
}: {
  observations: ObservationName[]
  beliefs: number[][]
  path?: number[]
  height?: number
}) {
  const T = observations.length
  const col = W / T
  const half = Math.min(col * 0.2, 64)
  const center = (t: number) => col * (t + 0.5)
  const stacks = beliefs.map((d) => stack(d, height))
  const columns = { gridTemplateColumns: `repeat(${T}, minmax(0, 1fr))` }

  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div style={{ minWidth: T * 72 }}>
          {path && (
            <div className="mb-2 grid" style={columns}>
              {path.map((s, t) => (
                <div key={t} className="truncate text-center text-xs font-medium text-slate-200">
                  {STATE_SHORT[s]}
                </div>
              ))}
            </div>
          )}

          <svg
            key={beliefs.flat().join()}
            viewBox={`0 0 ${W} ${height}`}
            preserveAspectRatio="none"
            className="animate-reveal block w-full"
            style={{ height }}
            role="img"
            aria-label={`Hidden-state probabilities over ${T} steps`}
          >
            {stacks.slice(0, -1).map((segs, t) =>
              segs.map((a, k) => {
                const b = stacks[t + 1][k]
                const x0 = center(t) + half
                const x1 = center(t + 1) - half
                const mid = (x0 + x1) / 2
                return (
                  <path
                    key={`r-${t}-${a.state}`}
                    d={`M ${x0} ${a.y0} C ${mid} ${a.y0} ${mid} ${b.y0} ${x1} ${b.y0} L ${x1} ${b.y1} C ${mid} ${b.y1} ${mid} ${a.y1} ${x0} ${a.y1} Z`}
                    fill={STATE_COLORS[a.state]}
                    opacity={0.2}
                  />
                )
              }),
            )}
            {stacks.map((segs, t) =>
              segs.map((s) => (
                <rect key={`b-${t}-${s.state}`} x={center(t) - half} width={half * 2} y={s.y0} height={Math.max(0, s.y1 - s.y0)} fill={STATE_COLORS[s.state]}>
                  <title>{`t = ${t + 1}, ${STATE_NAMES[s.state]}: ${pct(beliefs[t][s.state])}`}</title>
                </rect>
              )),
            )}
          </svg>

          <div className="mt-3 border-t border-dashed border-ink-600 pt-3">
            <div className="grid" style={columns}>
              {observations.map((o, t) => {
                const { icon: Icon, color } = OBS_META[o]
                return (
                  <div key={t} className="flex min-w-0 flex-col items-center gap-0.5">
                    <Icon className="size-4" style={{ color }} />
                    <span className="max-w-full truncate text-[0.8125rem] font-medium text-slate-200">{o}</span>
                    <span className="num text-xs text-slate-500">t = {t + 1}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <StateLegend note="Above the dashed line is inferred, below it is observed." />
      </div>
    </div>
  )
}
