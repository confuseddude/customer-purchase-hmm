import { AlertTriangle, Info, Loader2, Lightbulb } from 'lucide-react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ApiError } from '../services/api'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Card({
  title,
  subtitle,
  action,
  children,
  className,
  pad = true,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  pad?: boolean
}) {
  const hasHeader = title || action
  return (
    <section className={cx('rounded-xl border border-ink-700 bg-ink-850', className)}>
      {hasHeader && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0 flex-1 basis-64">
            {title && <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[0.8125rem] text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={pad ? (hasHeader ? 'px-5 pt-4 pb-5' : 'p-5') : hasHeader ? 'pt-3' : ''}>{children}</div>
    </section>
  )
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="max-w-[46rem]">
        <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-white md:text-[2rem]">{title}</h1>
        {children && <div className="mt-3 max-w-[68ch] leading-relaxed text-slate-400">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean }) {
  const base =
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100'
  const sizes = { sm: 'h-8 px-3 text-[0.8125rem]', md: 'h-10 px-4 text-sm' }
  const variants: Record<Variant, string> = {
    primary: 'bg-accent text-ink-950 hover:bg-accent-soft',
    secondary: 'border border-ink-600 bg-ink-800 text-slate-200 hover:border-ink-500 hover:bg-ink-700',
    ghost: 'text-slate-300 hover:bg-ink-800 hover:text-white',
    danger: 'border border-red-400/30 text-red-300 hover:bg-red-400/10',
  }
  return (
    <button className={cx(base, sizes[size], variants[variant], className)} disabled={loading || rest.disabled} {...rest}>
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Badge({ children, color, className }: { children: ReactNode; color?: string; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md bg-ink-800 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-slate-300', className)}>
      {color && <span className="size-2 rounded-[2px]" style={{ backgroundColor: color }} />}
      {children}
    </span>
  )
}

export function Callout({ kind = 'info', title, children }: { kind?: 'info' | 'warn' | 'tip'; title?: string; children: ReactNode }) {
  const styles = {
    info: { Icon: Info, cls: 'border-ink-600', icon: 'text-accent-soft' },
    warn: { Icon: AlertTriangle, cls: 'border-amber-400/30', icon: 'text-amber-300' },
    tip: { Icon: Lightbulb, cls: 'border-ink-600', icon: 'text-accent-soft' },
  }[kind]
  return (
    <div className={cx('flex gap-3 rounded-lg border bg-ink-800/50 px-4 py-3 text-sm leading-relaxed', styles.cls)}>
      <styles.Icon className={cx('mt-0.5 size-4 shrink-0', styles.icon)} />
      <div className="min-w-0 text-slate-300">
        {title && <div className="mb-0.5 font-semibold text-slate-100">{title}</div>}
        {children}
      </div>
    </div>
  )
}

export function ErrorBox({ error, onRetry }: { error: ApiError | null; onRetry?: () => void }) {
  if (!error) return null
  return (
    <div role="alert" className="rounded-lg border border-red-400/30 bg-ink-800/50 px-4 py-3 text-sm text-red-200">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-300" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{error.message}</div>
          {error.errors.length > 1 && (
            <ul className="mt-1 list-disc pl-4 text-red-200/90">
              {error.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        )}
      </div>
    </div>
  )
}

export function Loading({ label = 'Computing…' }: { label?: string }) {
  return (
    <div role="status" className="space-y-2.5 py-3">
      <div className="skeleton h-3 w-3/5" />
      <div className="skeleton h-3 w-4/5" />
      <div className="skeleton h-3 w-2/5" />
      <div className="pt-1 text-[0.8125rem] text-slate-400">{label}</div>
    </div>
  )
}

/** A labelled value. `color` adds a state swatch; the value itself stays in text colour. */
export function Stat({ label, value, hint, color }: { label: string; value: ReactNode; hint?: ReactNode; color?: string }) {
  const numeric = typeof value === 'number' || (typeof value === 'string' && /^[-+−]?[\d.]/.test(value))
  return (
    <div className="min-w-0 border-t border-ink-700 pt-3">
      <div className="text-[0.8125rem] text-slate-400">{label}</div>
      <div className={cx('mt-1 flex items-center gap-2 text-xl font-medium text-white', numeric && 'num')}>
        {color && <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />}
        <span className="min-w-0">{value}</span>
      </div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex max-w-full gap-6 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-ink-700)]" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'shrink-0 border-b-2 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 focus-visible:-outline-offset-2',
            value === t.id ? 'border-accent text-white' : 'border-transparent text-slate-400 hover:text-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-300 select-none">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cx(
          'relative inline-block h-5 w-9 rounded-full border transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          checked ? 'border-accent/60 bg-accent/30' : 'border-ink-600 bg-ink-800',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 left-0.5 size-3.5 rounded-full transition-[transform,background-color] duration-150 ease-out',
            checked ? 'translate-x-4 bg-accent-soft' : 'bg-slate-500',
          )}
        />
      </span>
      {label}
    </label>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[0.8125rem] font-medium text-slate-300">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'num h-9 w-full rounded-md border border-ink-600 bg-ink-900 px-2.5 text-sm text-slate-100 outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-slate-500 hover:border-ink-500 focus:border-accent focus:shadow-[0_0_0_1px_var(--color-accent)]'
