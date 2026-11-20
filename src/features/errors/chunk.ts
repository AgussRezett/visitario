import { readSession, writeSession } from '@/lib/storage'

const KEY = 'visitario.reloadedForUpdate'

/**
 * After a new version is published, a phone still running the old one asks for screens
 * (code files) that no longer exist. That is not a bug to show: reloading gets the new version.
 */
export function isStaleVersion(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError|Loading chunk [\w-]+ failed|Unable to preload CSS/i.test(text)
}

/** Reloads once for a stale version; false when it already did in the last minute (then show the error). */
export function reloadForUpdate(): boolean {
  // Without signal a reload would only show the browser's offline page.
  if (navigator.onLine === false) return false
  const last = Number(readSession(KEY) ?? 0)
  if (Date.now() - last < 60_000) return false
  writeSession(KEY, String(Date.now()))
  location.reload()
  return true
}

/** A request that never reached the server (no signal, airplane mode). */
export function isOffline(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  // With signal, code that does not load is an old version, not a lack of signal.
  if (isStaleVersion(error)) return false
  const text = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed/i.test(text)
}
