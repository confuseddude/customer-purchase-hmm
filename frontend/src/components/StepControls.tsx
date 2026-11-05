import { ChevronLeft, ChevronRight, FastForward, Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui'

/** Step-through controller used by every algorithm walkthrough. step ranges over 0..total. */
export function StepControls({
  step,
  total,
  onStep,
  labels,
}: {
  step: number
  total: number
  onStep: (s: number) => void
  labels?: string[]
}) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => {
    if (!playing) return
    if (step >= total) {
      setPlaying(false)
      return
    }
    const id = window.setTimeout(() => onStep(step + 1), 900)
    return () => window.clearTimeout(id)
  }, [playing, step, total, onStep])

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-ink-900 px-3 py-2">
      <Button size="sm" variant="ghost" onClick={() => onStep(0)} disabled={step === 0} aria-label="Reset">
        <RotateCcw className="size-3.5" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onStep(Math.max(0, step - 1))} disabled={step === 0}>
        <ChevronLeft className="size-4" /> Prev
      </Button>
      <Button size="sm" variant="primary" onClick={() => onStep(Math.min(total, step + 1))} disabled={step >= total}>
        Next Step <ChevronRight className="size-4" />
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)} disabled={step >= total && !playing}>
        {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
        {playing ? 'Pause' : 'Auto-play'}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => onStep(total)} disabled={step >= total}>
        <FastForward className="size-3.5" /> Show all
      </Button>
      <div className="ml-auto flex items-center gap-3">
        <div className="hidden h-1.5 w-32 overflow-hidden rounded-full bg-ink-700 sm:block">
          <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${(step / Math.max(total, 1)) * 100}%` }} />
        </div>
        <span className="text-xs text-slate-300 tabular-nums">
          {labels?.[step] ?? `Step ${step} / ${total}`}
        </span>
      </div>
    </div>
  )
}
