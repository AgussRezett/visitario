import { useCallback, useState } from 'react'

/**
 * What was already sent to WhatsApp from a visit, on this phone. Kept in the browser so
 * that coming back from WhatsApp (the phone may reload the app) does not start over.
 * Only a convenience: it is never shared or read by anyone else; a week later it is dropped.
 */
const PREFIX = 'visitario.sent.'
const WEEK = 7 * 24 * 60 * 60_000

function read(visitId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFIX + visitId) ?? 'null')
    const keys = value && typeof value === 'object' && 'keys' in value ? value.keys : null
    return Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string') : []
  } catch {
    return []
  }
}

function prune() {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i)
    if (!key?.startsWith(PREFIX)) continue
    try {
      const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null')
      const at = value && typeof value === 'object' && 'at' in value ? Number(value.at) : 0
      if (!(at > Date.now() - WEEK)) localStorage.removeItem(key)
    } catch {
      localStorage.removeItem(key)
    }
  }
}

function write(visitId: string, keys: string[]) {
  try {
    localStorage.setItem(PREFIX + visitId, JSON.stringify({ keys, at: Date.now() }))
    prune()
  } catch {
    // Private mode or storage blocked: it is remembered while the app stays open.
  }
}

export function useSent(visitId: string) {
  const [sent, setSent] = useState<ReadonlySet<string>>(() => new Set(read(visitId)))
  const mark = useCallback(
    (key: string) =>
      setSent((prev) => {
        const next = new Set(prev).add(key)
        write(visitId, [...next])
        return next
      }),
    [visitId],
  )
  return { sent, mark }
}
