/**
 * Choosing a photo opens another app (the gallery, or the phone's camera). Android may
 * close the browser meanwhile to free memory, and the photo never comes back. A mark kept
 * for the session tells the screen, after it opens again, that this is what happened.
 */
const KEY = 'visitario.picking'
const RECENT_MS = 5 * 60_000

function read(): { path: string; at: number } | null {
  try {
    const v: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    return v && typeof v === 'object' && 'path' in v && 'at' in v ? { path: String(v.path), at: Number(v.at) } : null
  } catch {
    return null
  }
}

const clear = () => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Storage blocked: nothing to clear.
  }
}

/** About to leave for another app. Coming back normally (with or without a photo) clears it. */
export function markPicking() {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path: window.location.pathname, at: Date.now() }))
  } catch {
    return
  }
  const back = () => {
    if (document.visibilityState !== 'visible') return
    document.removeEventListener('visibilitychange', back)
    // The chosen file arrives right after the page shows again.
    setTimeout(clear, 1500)
  }
  document.addEventListener('visibilitychange', back)
}

export const pickingDone = clear

/** True once, when this screen opened again because the phone closed it while choosing a photo. */
export function wasInterrupted(path = window.location.pathname, now = Date.now()) {
  const mark = read()
  if (!mark) return false
  clear()
  return mark.path === path && now - mark.at < RECENT_MS
}
