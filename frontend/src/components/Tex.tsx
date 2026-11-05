import katex from 'katex'
import { useMemo } from 'react'

/** Renders a TeX string with KaTeX. `block` renders display-style math. */
export function Tex({ children, block = false, className }: { children: string; block?: boolean; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(children, { displayMode: block, throwOnError: false, strict: 'ignore' }),
    [children, block],
  )
  return block ? (
    <div className={className} dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
  )
}

/** A formula with a list of symbol explanations underneath. */
export function Formula({
  label,
  tex,
  symbols,
}: {
  label?: string
  tex: string | string[]
  symbols?: [string, string][]
}) {
  const list = Array.isArray(tex) ? tex : [tex]
  return (
    <div className="my-4 rounded-lg bg-ink-900 px-4 py-3 first:mt-0 last:mb-0">
      {label && <div className="mb-1 text-[0.8125rem] font-medium text-slate-400">{label}</div>}
      {list.map((t) => (
        <Tex key={t} block>
          {t}
        </Tex>
      ))}
      {symbols && symbols.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-ink-700/70 pt-3 text-[0.8125rem] sm:grid-cols-2">
          {symbols.map(([s, d]) => (
            <div key={s} className="flex gap-2">
              <dt className="w-24 shrink-0 text-slate-200">
                <Tex>{s}</Tex>
              </dt>
              <dd className="text-slate-400">{d}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
