import { ArrowLeft, ArrowRight } from 'lucide-react'
import type { ComponentType } from 'react'
import { Button, cx } from '../components/ui'
import { navigate } from '../hooks/useRoute'
import { Chapter10, Chapter11, Chapter12, Chapter9 } from './learn/ChaptersAdvanced'
import { Chapter1, Chapter2, Chapter3, Chapter4 } from './learn/ChaptersFoundations'
import { Chapter5, Chapter6, Chapter7, Chapter8 } from './learn/ChaptersInference'

const CHAPTERS: { title: string; blurb: string; body: ComponentType }[] = [
  { title: 'The Problem', blurb: 'Purchase prediction, sequential behaviour and hidden intention', body: Chapter1 },
  { title: 'What is a Hidden Markov Model?', blurb: 'Markov chains, hidden states, observations and the two assumptions', body: Chapter2 },
  { title: 'Understanding λ = (A, B, π)', blurb: 'How to read every row and column of the parameters', body: Chapter3 },
  { title: 'Maximum Likelihood Estimation', blurb: 'Likelihood, frequency counts and why hidden states need iteration', body: Chapter4 },
  { title: 'The Forward Algorithm', blurb: 'α, summing over states, and P(O | λ)', body: Chapter5 },
  { title: 'The Backward Algorithm', blurb: 'β and how future actions explain the present', body: Chapter6 },
  { title: 'Forward-Backward', blurb: 'Posterior intent at every step', body: Chapter7 },
  { title: 'The Viterbi Algorithm', blurb: 'Dynamic programming for the single best path', body: Chapter8 },
  { title: 'Viterbi vs Forward-Backward', blurb: 'Max vs sum, one path vs distributions', body: Chapter9 },
  { title: 'Baum-Welch and EM', blurb: 'Learning parameters without labels', body: Chapter10 },
  { title: 'Practical Applications', blurb: 'From inferred intent to business decisions', body: Chapter11 },
  { title: 'Limitations and Future Scope', blurb: 'What this project does not show, and what comes next', body: Chapter12 },
]

export function LearnPage({ sub }: { sub?: string }) {
  const n = Math.min(Math.max(Number(sub) || 1, 1), CHAPTERS.length)
  const ch = CHAPTERS[n - 1]
  const Body = ch.body
  const go = (k: number) => navigate(`/learn/${k}`)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <div className="mb-3 px-2.5 text-sm font-semibold text-slate-100">Learn the project</div>
        <ol className="flex gap-1 overflow-x-auto pb-2 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
          {CHAPTERS.map((c, i) => (
            <li key={c.title} className="shrink-0">
              <a
                href={`#/learn/${i + 1}`}
                className={cx(
                  'flex items-baseline gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                  i + 1 === n ? 'bg-ink-800 font-medium text-white' : 'text-slate-400 hover:bg-ink-800/70 hover:text-slate-200',
                )}
              >
                <span className="num w-5 shrink-0 text-right text-xs text-slate-500">{i + 1}</span>
                <span className="whitespace-nowrap lg:whitespace-normal">{c.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </aside>

      <article className="min-w-0">
        <header className="mb-8">
          <div className="mb-2 text-sm text-slate-400 tabular-nums">Chapter {n} of {CHAPTERS.length}</div>
          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-white md:text-[2rem]">{ch.title}</h1>
          <p className="mt-2 max-w-[68ch] text-slate-400">{ch.blurb}</p>
        </header>
        <Body key={n} />
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-ink-700 pt-6">
          {n > 1 ? (
            <Button variant="ghost" onClick={() => go(n - 1)}>
              <ArrowLeft className="size-4" /> {CHAPTERS[n - 2].title}
            </Button>
          ) : (
            <span />
          )}
          {n < CHAPTERS.length && (
            <Button variant="primary" onClick={() => go(n + 1)}>
              {CHAPTERS[n].title} <ArrowRight className="size-4" />
            </Button>
          )}
        </footer>
      </article>
    </div>
  )
}
