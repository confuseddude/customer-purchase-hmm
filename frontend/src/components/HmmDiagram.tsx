import { OBS_META, STATE_COLORS, STATE_NAMES } from '../lib/constants'
import type { ModelDict } from '../types'

const R = 46
const NODES: [number, number][] = [
  [150, 238],
  [380, 132],
  [610, 238],
]
// direction (radians) in which each self-loop points
const LOOP_ANGLE = [Math.PI, -Math.PI / 2, 0]
const OBS_Y = 420

type Pt = [number, number]

function quad(p1: Pt, p2: Pt, bend: number) {
  const mx = (p1[0] + p2[0]) / 2
  const my = (p1[1] + p2[1]) / 2
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const c: Pt = [mx + nx * bend, my + ny * bend]
  // shorten both ends to the node border
  const shorten = (from: Pt, to: Pt, by: number): Pt => {
    const vx = to[0] - from[0]
    const vy = to[1] - from[1]
    const l = Math.hypot(vx, vy)
    return [from[0] + (vx / l) * by, from[1] + (vy / l) * by]
  }
  const s = shorten(p1, c, R + 2)
  const e = shorten(p2, c, R + 9)
  const label: Pt = [0.25 * s[0] + 0.5 * c[0] + 0.25 * e[0], 0.25 * s[1] + 0.5 * c[1] + 0.25 * e[1]]
  return { d: `M ${s[0]} ${s[1]} Q ${c[0]} ${c[1]} ${e[0]} ${e[1]}`, label }
}

function loop(p: Pt, angle: number) {
  const a1 = angle - 0.45
  const a2 = angle + 0.45
  const s: Pt = [p[0] + Math.cos(a1) * (R + 2), p[1] + Math.sin(a1) * (R + 2)]
  const e: Pt = [p[0] + Math.cos(a2) * (R + 9), p[1] + Math.sin(a2) * (R + 9)]
  const far = R + 62
  const c1: Pt = [p[0] + Math.cos(a1 - 0.25) * far, p[1] + Math.sin(a1 - 0.25) * far]
  const c2: Pt = [p[0] + Math.cos(a2 + 0.25) * far, p[1] + Math.sin(a2 + 0.25) * far]
  const label: Pt = [p[0] + Math.cos(angle) * (far - 6), p[1] + Math.sin(angle) * (far - 6)]
  return { d: `M ${s[0]} ${s[1]} C ${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${e[0]} ${e[1]}`, label }
}

export function HmmDiagram({
  model,
  selected,
  onSelect,
  weights,
  activeObs,
  showEmissions = true,
  activeTransition,
}: {
  model: ModelDict
  selected: number | null
  onSelect?: (s: number | null) => void
  /** optional probability per state (e.g. filtered distribution) used to scale node glow */
  weights?: number[] | null
  activeObs?: number | null
  showEmissions?: boolean
  activeTransition?: boolean
}) {
  const obsX = model.observations.map((_, k) => 110 + k * 135)
  return (
    <svg viewBox="0 0 760 455" className="h-auto w-full select-none" role="img" aria-label="Hidden Markov Model state diagram">
      <defs>
        {STATE_COLORS.map((c, i) => (
          <marker
            key={i}
            id={`arrow-${i}`}
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="12"
            markerHeight="12"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
          </marker>
        ))}
      </defs>

      {/* hidden layer label */}
      <text x="20" y="30" className="fill-slate-500" fontSize="12.5">
        Hidden states (not observed)
      </text>
      <text x="20" y={OBS_Y - 50} className="fill-slate-500" fontSize="12.5">
        Observations (what we see)
      </text>
      <line x1="20" x2="740" y1={OBS_Y - 70} y2={OBS_Y - 70} stroke="#2c3859" strokeDasharray="4 6" />

      {/* emissions */}
      {showEmissions &&
        model.B.map((row, i) =>
          row.map((p, k) => {
            const dim = selected !== null && selected !== i
            const isActive = activeObs === k
            return (
              <line
                key={`e-${i}-${k}`}
                x1={NODES[i][0]}
                y1={NODES[i][1] + R}
                x2={obsX[k]}
                y2={OBS_Y - 22}
                stroke={STATE_COLORS[i]}
                strokeWidth={0.5 + p * 7}
                strokeOpacity={dim ? 0.04 : (selected === i ? 0.75 : 0.18) * (isActive ? 1.6 : 1)}
                strokeDasharray={selected === i ? undefined : '3 4'}
              />
            )
          }),
        )}
      {selected !== null &&
        showEmissions &&
        model.B[selected].map((p, k) => {
          const x = (NODES[selected][0] + obsX[k]) / 2
          const y = (NODES[selected][1] + R + OBS_Y - 22) / 2
          return (
            <g key={`el-${k}`}>
              <rect x={x - 21} y={y - 10} width="42" height="19" rx="5" fill="#0b1020" stroke={STATE_COLORS[selected]} strokeOpacity="0.5" />
              <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="#e5e9f5" fontFamily="IBM Plex Mono, monospace">
                {p.toFixed(2)}
              </text>
            </g>
          )
        })}

      {/* transitions */}
      {model.A.map((row, i) =>
        row.map((p, j) => {
          const geom = i === j ? loop(NODES[i], LOOP_ANGLE[i]) : quad(NODES[i], NODES[j], 34)
          const dim = selected !== null && selected !== i
          return (
            <g key={`t-${i}-${j}`} opacity={dim ? 0.18 : 1}>
              <path
                d={geom.d}
                fill="none"
                stroke={STATE_COLORS[i]}
                strokeWidth={0.8 + p * 6}
                strokeOpacity={activeTransition ? 0.95 : 0.7}
                markerEnd={`url(#arrow-${i})`}
                className="transition-[stroke-opacity] duration-300"
              />
              <g transform={`translate(${geom.label[0]}, ${geom.label[1]})`}>
                <rect x="-20" y="-10" width="40" height="19" rx="5" fill="#0a0f1d" stroke="#2a3558" />
                <text y="4" textAnchor="middle" fontSize="11" fill="#dfe5f5" fontFamily="IBM Plex Mono, monospace">
                  {p.toFixed(2)}
                </text>
              </g>
            </g>
          )
        }),
      )}

      {/* nodes */}
      {NODES.map(([x, y], i) => {
        const w = weights?.[i]
        const isSel = selected === i
        return (
          <g
            key={`n-${i}`}
            transform={`translate(${x}, ${y})`}
            onClick={() => onSelect?.(isSel ? null : i)}
            className={onSelect ? 'cursor-pointer' : undefined}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={(e) => {
              if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onSelect(isSel ? null : i)
              }
            }}
            aria-label={STATE_NAMES[i]}
          >
            <circle r={R} fill="#141b31" stroke={STATE_COLORS[i]} strokeWidth={isSel ? 3 : 1.6} />
            {w !== undefined && w !== null && (
              <>
                <circle r={R + 6} fill="none" stroke="#2c3859" strokeWidth="3" />
                <circle
                  r={R + 6}
                  fill="none"
                  stroke={STATE_COLORS[i]}
                  strokeWidth="3"
                  pathLength={100}
                  strokeDasharray={`${w * 100} 100`}
                  transform="rotate(-90)"
                  className="transition-[stroke-dasharray] duration-300 ease-out"
                />
              </>
            )}
            <text y={w !== undefined && w !== null ? -6 : 0} textAnchor="middle" fontSize="13" fontWeight="600" fill="#f1f4fb" dominantBaseline="middle">
              {i === 2 ? 'Ready' : STATE_NAMES[i]}
            </text>
            {i === 2 && (w === undefined || w === null) && (
              <text y="16" textAnchor="middle" fontSize="10" fill="#94a3b8">
                to Purchase
              </text>
            )}
            {w !== undefined && w !== null && (
              <text y="14" textAnchor="middle" fontSize="12" fill="#c6cedf" fontFamily="IBM Plex Mono, monospace">
                {(w * 100).toFixed(1)}%
              </text>
            )}
            <text
              x={i === 1 ? -R - 16 : 0}
              y={i === 1 ? -R + 6 : -R - 15}
              textAnchor={i === 1 ? 'end' : 'middle'}
              fontSize="10.5"
              fill="#8894b0"
              fontFamily="IBM Plex Mono, monospace"
            >
              π = {model.pi[i].toFixed(2)}
            </text>
          </g>
        )
      })}

      {/* observations */}
      {model.observations.map((o, k) => {
        const meta = OBS_META[o]
        const active = activeObs === k
        return (
          <g key={`o-${k}`} transform={`translate(${obsX[k]}, ${OBS_Y})`}>
            <rect
              x="-50"
              y="-22"
              width="100"
              height="44"
              rx="9"
              fill={active ? `${meta.color}2a` : '#141b31'}
              stroke={active ? meta.color : '#2c3859'}
              strokeWidth={active ? 2 : 1}
              className="transition-[fill,stroke-opacity] duration-150"
            />
            <text textAnchor="middle" y="5" fontSize="13" fontWeight="500" fill="#dde3ef">
              {o}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
