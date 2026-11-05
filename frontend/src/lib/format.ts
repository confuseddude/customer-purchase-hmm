// Formatting only. These helpers never compute model quantities.

export function fmt(x: number | null | undefined, sig = 4): string {
  if (x === null || x === undefined || Number.isNaN(x)) return 'n/a'
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e-3 && a < 1e5) {
    const s = Number(x.toPrecision(sig)).toString()
    return s
  }
  const [m, e] = x.toExponential(sig - 1).split('e')
  return `${Number(m)}e${Number(e)}`
}

export function fixed(x: number | null | undefined, d = 4): string {
  if (x === null || x === undefined || Number.isNaN(x)) return 'n/a'
  return x.toFixed(d)
}

export function pct(x: number | null | undefined, d = 1): string {
  if (x === null || x === undefined || Number.isNaN(x)) return 'n/a'
  return `${(x * 100).toFixed(d)}%`
}

/** Number formatted for KaTeX: small values use ×10^{k}. */
export function tex(x: number | null | undefined, sig = 4): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '\\text{n/a}'
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e-3 && a < 1e5) return Number(x.toPrecision(sig)).toString()
  const [m, e] = x.toExponential(sig - 1).split('e')
  return `${Number(m)}\\times10^{${Number(e)}}`
}

const SHORT_STATE = ['Browsing', 'Interested', 'Ready']

/** TeX label for state i, e.g. \text{Interested}. */
export function texState(i: number | null | undefined): string {
  return i === null || i === undefined ? '' : `\\text{${SHORT_STATE[i] ?? `S${i}`}}`
}

export function texObs(name: string): string {
  return `\\text{${name.replace(/[{}\\]/g, '')}}`
}
