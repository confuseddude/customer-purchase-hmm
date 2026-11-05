import type { ReactNode } from 'react'
import { useAppState } from '../../hooks/useAppState'
import { useAsync } from '../../hooks/useAsync'
import { api } from '../../services/api'
import type { ObservationName } from '../../types'

/** The running example used throughout the Learn chapters. */
export const WORKED: ObservationName[] = ['View', 'Cart', 'Checkout', 'Purchase']

export function H({ children }: { children: ReactNode }) {
  return <h3 className="mt-10 mb-3 text-lg font-semibold tracking-[-0.01em] text-white first:mt-0">{children}</h3>
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="prose-lab max-w-[68ch]">{children}</div>
}

export function Demo({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="my-6 rounded-xl border border-ink-700 bg-ink-850 p-4 sm:p-5">
      <div className="mb-3 text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-100">Try it: {title}</div>
      {children}
    </div>
  )
}

export function KeyIdea({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 max-w-[68ch] rounded-lg bg-ink-800/70 px-4 py-3 leading-relaxed text-slate-200">
      <span className="mr-1 font-semibold text-accent-soft">Key idea.</span>
      {children}
    </div>
  )
}

/** Backend results for the worked example under the active model, shared by chapters 5-9. */
export function useWorked() {
  const { modelVersion } = useAppState()
  const fwd = useAsync(() => api.forward(WORKED), [modelVersion])
  const bwd = useAsync(() => api.backward(WORKED), [modelVersion])
  const fb = useAsync(() => api.forwardBackward(WORKED), [modelVersion])
  const vit = useAsync(() => api.viterbi(WORKED), [modelVersion])
  return { fwd, bwd, fb, vit }
}
