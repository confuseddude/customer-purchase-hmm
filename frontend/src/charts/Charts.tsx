import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { StateLegend } from '../components/Distribution'
import { STATE_COLORS, STATE_NAMES } from '../lib/constants'
import { fmt, pct } from '../lib/format'
import type { Matrix, ObservationName, TrajectoryPoint } from '../types'

const SURFACE = '#0e1426'
const ACCENT = '#7c8cff'
const MUTED_BAR = '#414f7a'
const INK_SECONDARY = '#a4aec6'
const INK_MUTED = '#8894b0'

const tick = { fill: INK_MUTED, fontSize: 11 }
const axis = { stroke: '#2c3859', tick, tickLine: false }
const grid = <CartesianGrid stroke="#1e2842" vertical={false} />
const tooltipStyle = {
  contentStyle: {
    background: '#141b31',
    border: '1px solid #2c3859',
    borderRadius: 8,
    fontSize: 12,
    color: '#dde3ef',
  },
  labelStyle: { color: INK_SECONDARY, marginBottom: 4 },
  itemStyle: { padding: 0, color: '#dde3ef' },
}
const pctTick = (v: number) => `${Math.round(v * 100)}%`
const dot = (fill: string) => ({ r: 4, strokeWidth: 2, stroke: SURFACE, fill })

/** Hidden-state probabilities over time (stacked area = distribution sums to 1). */
export function StateProbabilityChart({
  matrix,
  observations,
  height = 260,
  variant = 'area',
}: {
  matrix: Matrix
  observations: ObservationName[]
  height?: number
  variant?: 'area' | 'line'
}) {
  const data = matrix.map((row, t) => ({
    label: `${t + 1}·${observations[t]}`,
    [STATE_NAMES[0]]: row[0],
    [STATE_NAMES[1]]: row[1],
    [STATE_NAMES[2]]: row[2],
  }))
  return (
    <div>
    <ResponsiveContainer width="100%" height={height}>
      {variant === 'area' ? (
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          {grid}
          <XAxis dataKey="label" {...axis} />
          <YAxis domain={[0, 1]} tickFormatter={pctTick} {...axis} axisLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => pct(Number(v))} />
          {STATE_NAMES.map((s, i) => (
            <Area key={s} type="linear" dataKey={s} stackId="1" stroke={SURFACE} strokeWidth={2} fill={STATE_COLORS[i]} fillOpacity={0.9} isAnimationActive={false} />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          {grid}
          <XAxis dataKey="label" {...axis} />
          <YAxis domain={[0, 1]} tickFormatter={pctTick} {...axis} axisLine={false} />
          <Tooltip {...tooltipStyle} formatter={(v) => pct(Number(v))} />
          {STATE_NAMES.map((s, i) => (
            <Line key={s} type="linear" dataKey={s} stroke={STATE_COLORS[i]} strokeWidth={2} dot={dot(STATE_COLORS[i])} isAnimationActive={false} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
    <div className="mt-2 flex justify-center">
      <StateLegend />
    </div>
    </div>
  )
}

export function LikelihoodChart({ history, height = 260 }: { history: { iteration: number; log_likelihood: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={history} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
        {grid}
        <XAxis dataKey="iteration" {...axis} label={{ value: 'iteration', position: 'insideBottomRight', offset: -2, fill: INK_MUTED, fontSize: 11 }} />
        <YAxis {...axis} axisLine={false} domain={['auto', 'auto']} tickFormatter={(v) => Number(v).toFixed(0)} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v) => [Number(v).toFixed(4), 'log P(O | λ)']} labelFormatter={(l) => `Iteration ${l}`} />
        <Line type="linear" dataKey="log_likelihood" stroke={ACCENT} strokeWidth={2} dot={false} activeDot={dot(ACCENT)} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function PurchaseTrajectoryChart({
  trajectory,
  ceiling,
  height = 240,
}: {
  trajectory: TrajectoryPoint[]
  ceiling?: number
  height?: number
}) {
  const data = trajectory.map((p) => ({
    label: p.t === 0 ? 'start' : `${p.t}·${p.after}`,
    value: p.purchase_probability,
  }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: -10, bottom: 0 }}>
        {grid}
        <XAxis dataKey="label" {...axis} />
        <YAxis domain={[0, Math.max(0.6, ceiling ?? 0)]} tickFormatter={pctTick} {...axis} axisLine={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => [pct(Number(v)), 'P(Purchase next)']} />
        {ceiling !== undefined && (
          <ReferenceLine y={ceiling} stroke={INK_MUTED} strokeDasharray="4 4" label={{ value: 'model maximum', fill: INK_SECONDARY, fontSize: 11, position: 'insideTopRight' }} />
        )}
        <Line type="linear" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={dot(ACCENT)} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function NextActionChart({ distribution, observations, height = 200 }: { distribution: number[]; observations: ObservationName[]; height?: number }) {
  const data = observations.map((o, k) => ({ action: o, p: distribution[k] }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 18, right: 8, left: -14, bottom: 0 }}>
        {grid}
        <XAxis dataKey="action" {...axis} />
        <YAxis domain={[0, (max: number) => Math.min(1, Math.ceil(max * 10) / 10)]} tickCount={6} tickFormatter={pctTick} {...axis} axisLine={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#ffffff08' }} formatter={(v) => [pct(Number(v)), 'P(next action)']} />
        <Bar
          dataKey="p"
          radius={[4, 4, 0, 0]}
          maxBarSize={56}
          isAnimationActive={false}
          label={{ position: 'top', fill: INK_SECONDARY, fontSize: 11, formatter: (v: unknown) => pct(Number(v)) }}
        >
          {data.map((d) => (
            <Cell key={d.action} fill={d.action === 'Purchase' ? ACCENT : MUTED_BAR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CompareChart({ rows, height = 260 }: { rows: { name: string; p: number; highlight?: boolean }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, left: 8, bottom: 4 }}>
        <CartesianGrid stroke="#1e2842" horizontal={false} />
        <XAxis type="number" domain={[0, 'auto']} tickFormatter={pctTick} {...axis} />
        <YAxis type="category" dataKey="name" width={150} {...axis} axisLine={false} tick={{ fill: INK_SECONDARY, fontSize: 11 }} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#ffffff08' }} formatter={(v) => [pct(Number(v)), 'P(Purchase next)']} />
        <Bar dataKey="p" radius={[0, 4, 4, 0]} maxBarSize={22} isAnimationActive={false} label={{ position: 'right', fill: '#c6cedf', fontSize: 11, formatter: (v: unknown) => pct(Number(v)) }}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.highlight ? ACCENT : MUTED_BAR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function CountBarChart({
  data,
  xKey,
  color = ACCENT,
  height = 220,
  angled = false,
}: {
  data: Record<string, string | number>[]
  xKey: string
  color?: string
  height?: number
  angled?: boolean
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
        {grid}
        <XAxis
          dataKey={xKey}
          {...axis}
          interval={0}
          tick={{ fontSize: 11, fill: INK_MUTED }}
          angle={angled ? -30 : 0}
          textAnchor={angled ? 'end' : 'middle'}
          height={angled ? 68 : 30}
        />
        <YAxis {...axis} axisLine={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: '#ffffff08' }} formatter={(v) => [fmt(Number(v)), 'count']} />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function BernoulliChart({ curve, mle, height = 220 }: { curve: { p: number; likelihood: number }[]; mle: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={curve} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
        {grid}
        <XAxis dataKey="p" type="number" domain={[0, 1]} tickFormatter={(v) => Number(v).toFixed(1)} {...axis} />
        <YAxis tickFormatter={(v) => fmt(Number(v), 2)} {...axis} axisLine={false} width={58} />
        <Tooltip {...tooltipStyle} formatter={(v) => [fmt(Number(v)), 'L(p)']} labelFormatter={(l) => `p = ${Number(l).toFixed(2)}`} />
        <ReferenceLine x={mle} stroke={INK_SECONDARY} strokeDasharray="4 4" label={{ value: `MLE p̂ = ${mle}`, fill: '#c6cedf', fontSize: 11, position: 'insideTopLeft' }} />
        <Area dataKey="likelihood" stroke={ACCENT} fill={ACCENT} fillOpacity={0.22} strokeWidth={2} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
