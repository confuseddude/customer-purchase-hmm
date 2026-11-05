import { useEffect, useState } from 'react'

/** Minimal hash router: "#/lab/viterbi" -> ["lab", "viterbi"]. */
export function useRoute(): string[] {
  const parse = () =>
    window.location.hash
      .replace(/^#\/?/, '')
      .split('/')
      .filter(Boolean)
  const [parts, setParts] = useState<string[]>(parse)
  useEffect(() => {
    const on = () => {
      setParts(parse())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parts
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('/') ? path : `/${path}`
}
