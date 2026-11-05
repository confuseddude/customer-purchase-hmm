import { RotateCcw, Save, Scale } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Callout, Card, ErrorBox, Loading, PageHeader, cx, inputCls } from '../components/ui'
import { useAppState } from '../hooks/useAppState'
import { useAction, useAsync } from '../hooks/useAsync'
import { STATE_COLORS, STATE_NAMES, STATE_SHORT } from '../lib/constants'
import { api } from '../services/api'

type Grid = string[][]

const toGrid = (m: number[][]): Grid => m.map((r) => r.map((v) => String(Number(v.toFixed(6)))))
const parse = (g: Grid) => g.map((r) => r.map((v) => (v.trim() === '' ? NaN : Number(v))))

export function ConfigPage() {
  const { model, setModel } = useAppState()
  const [pi, setPi] = useState<Grid>([])
  const [A, setA] = useState<Grid>([])
  const [B, setB] = useState<Grid>([])
  const [name, setName] = useState('Custom configuration')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const save = useAction(api.saveParameters)
  const reset = useAction(api.resetParameters)
  const history = useAsync(() => api.modelHistory(8), [model?.id])

  const load = () => {
    if (!model) return
    setPi(toGrid([model.pi]))
    setA(toGrid(model.A))
    setB(toGrid(model.B))
  }
  useEffect(load, [model?.id])

  if (!model || pi.length === 0) return <Loading label="Loading parameters…" />

  const P = parse(pi)[0]
  const AA = parse(A)
  const BB = parse(B)
  const issues = localIssues(P, AA, BB)

  const doSave = async () => {
    setSavedMsg(null)
    const cfg = await save.run({ pi: P, A: AA, B: BB, name })
    if (cfg) {
      setModel(cfg)
      setSavedMsg(`Saved “${cfg.name}” and made it the active model.`)
    }
  }
  const doReset = async () => {
    setSavedMsg(null)
    const cfg = await reset.run()
    if (cfg) {
      setModel(cfg)
      setSavedMsg('Restored the illustrative default parameters.')
    }
  }
  // Normalising user input rows is an editing convenience, not a model computation.
  const normalise = (g: Grid, set: (g: Grid) => void) =>
    set(
      parse(g).map((r) => {
        const s = r.reduce((a, b) => a + (Number.isFinite(b) && b > 0 ? b : 0), 0)
        return r.map((v) => (s > 0 && Number.isFinite(v) && v > 0 ? String(Number((v / s).toFixed(6))) : '0'))
      }),
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Model Configuration"
        actions={
          <>
            <Button variant="danger" onClick={doReset} loading={reset.loading}>
              <RotateCcw className="size-4" /> Reset to defaults
            </Button>
            <Button variant="primary" onClick={doSave} loading={save.loading} disabled={issues.length > 0}>
              <Save className="size-4" /> Validate &amp; save
            </Button>
          </>
        }
      >
        Edit every probability of λ = (A, B, π). The backend validates the parameters again before saving, and every page immediately uses the new active model.
      </PageHeader>

      <Callout kind="info">
        The defaults are <strong>illustrative, simulated parameters</strong>. The View, Cart and Purchase emissions follow the project presentation; Checkout and Exit
        were added to complete the model. They are not estimated from real customers.
      </Callout>

      <ErrorBox error={save.error} />
      <ErrorBox error={reset.error} />
      {savedMsg && <Callout kind="tip">{savedMsg}</Callout>}
      {issues.length > 0 && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          <div className="mb-1 font-medium">Fix these before saving:</div>
          <ul className="list-disc pl-5 text-amber-200/90">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}

      <Card title="Configuration name">
        <input className={cx(inputCls.replace('num ', ''), 'max-w-md')} value={name} onChange={(e) => setName(e.target.value)} />
      </Card>

      <EditGrid title="π: initial state distribution" subtitle="Must sum to 1" grid={pi} setGrid={setPi} rows={['π']} cols={[...STATE_NAMES]} onNormalise={() => normalise(pi, setPi)} />
      <EditGrid title="A: transition matrix" subtitle="Row = current state, column = next state. Each row must sum to 1." grid={A} setGrid={setA} rows={[...STATE_NAMES]} cols={[...STATE_SHORT]} onNormalise={() => normalise(A, setA)} />
      <EditGrid
        title="B: emission matrix"
        subtitle="Row = hidden state, column = observed action. Each state's emission distribution must sum to 1."
        grid={B}
        setGrid={setB}
        rows={[...STATE_NAMES]}
        cols={model.observations}
        onNormalise={() => normalise(B, setB)}
      />

      <Card title="Saved configurations" subtitle="Most recent first (stored in SQLite)">
        {history.data ? (
          <ul className="divide-y divide-ink-700/60 text-[0.8125rem]">
            {history.data.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span className={h.is_active ? 'font-medium text-white' : 'text-slate-400'}>
                  {h.name} {h.is_active && <span className="ml-1 text-xs text-emerald-400">active</span>}
                </span>
                <span className="num text-xs text-slate-500">
                  {h.source} · {new Date(h.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Loading />
        )}
      </Card>
    </div>
  )
}

function EditGrid({
  title,
  subtitle,
  grid,
  setGrid,
  rows,
  cols,
  onNormalise,
}: {
  title: string
  subtitle: string
  grid: Grid
  setGrid: (g: Grid) => void
  rows: string[]
  cols: string[]
  onNormalise: () => void
}) {
  const nums = parse(grid)
  return (
    <Card
      title={title}
      subtitle={subtitle}
      action={
        <Button size="sm" variant="ghost" onClick={onNormalise} title="Rescale each row to sum to 1">
          <Scale className="size-3.5" /> Normalise rows
        </Button>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-1.5 text-sm">
          <thead>
            <tr>
              <th />
              {cols.map((c) => (
                <th key={c} className="px-1 text-center text-xs font-medium text-slate-400">
                  {c}
                </th>
              ))}
              <th className="px-1 text-center text-xs font-medium text-slate-500">Σ</th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => {
              const sum = nums[r].reduce((a, b) => a + (Number.isFinite(b) ? b : NaN), 0)
              const ok = Math.abs(sum - 1) <= 1e-6
              return (
                <tr key={r}>
                  <th className="pr-2 text-left text-[0.8125rem] font-medium whitespace-nowrap" style={{ color: rows.length === 3 ? STATE_COLORS[r] : '#cbd5e1' }}>
                    {rows[r]}
                  </th>
                  {row.map((v, c) => {
                    const n = nums[r][c]
                    const bad = !Number.isFinite(n) || n < 0 || n > 1
                    return (
                      <td key={c}>
                        <input
                          className={cx(inputCls, 'min-w-20 text-center', bad && 'border-red-500/70')}
                          inputMode="decimal"
                          value={v}
                          onChange={(e) => {
                            const next = grid.map((rr) => [...rr])
                            next[r][c] = e.target.value
                            setGrid(next)
                          }}
                          aria-label={`${rows[r]} ${cols[c]}`}
                        />
                      </td>
                    )
                  })}
                  <td className={cx('num px-2 text-center text-[0.8125rem]', ok ? 'text-emerald-400' : 'text-red-400')}>{Number.isFinite(sum) ? sum.toFixed(4) : 'n/a'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/** Client-side input checks for immediate feedback. The backend performs the authoritative validation. */
function localIssues(pi: number[], A: number[][], B: number[][]): string[] {
  const out: string[] = []
  const all = [...pi, ...A.flat(), ...B.flat()]
  if (all.some((v) => !Number.isFinite(v))) out.push('Every field must contain a number.')
  if (all.some((v) => v < 0)) out.push('Probabilities cannot be negative.')
  if (all.some((v) => v > 1)) out.push('Probabilities cannot exceed 1.')
  const sum = (r: number[]) => r.reduce((a, b) => a + b, 0)
  if (Math.abs(sum(pi) - 1) > 1e-6) out.push('Initial probabilities must sum to 1.')
  A.forEach((r, i) => Math.abs(sum(r) - 1) > 1e-6 && out.push(`Transition row “${STATE_NAMES[i]}” must sum to 1.`))
  B.forEach((r, i) => Math.abs(sum(r) - 1) > 1e-6 && out.push(`Emission distribution of “${STATE_NAMES[i]}” must sum to 1.`))
  return out
}
