import { useSyncExternalStore } from 'react'
import { MAX_DISMISSALS, installKind, isMobile, type Device, type InstallKind, type InstallMemo } from '@/domain/install'

/**
 * The install dialog of Chrome, Edge and Samsung Internet: the browser fires
 * beforeinstallprompt once the app can be installed. We keep it (and stop the browser's
 * own mini bar) to open it from our button. Imported by main.tsx, so the event is not missed.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installedNow = false
const listeners = new Set<() => void>()
const notify = () => listeners.forEach((l) => l())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as InstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferred = null
    installedNow = true
    notify()
  })
  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', notify)
}

function device(): Device {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  return { ua: navigator.userAgent, standalone: standalone || installedNow, canPrompt: Boolean(deferred), touch: navigator.maxTouchPoints > 1 }
}

let snapshot = ''
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
/** A string snapshot (kind|mobile) keeps useSyncExternalStore stable between renders. */
const read = () => {
  const d = device()
  const next = `${installKind(d)}|${isMobile(d) ? 1 : 0}`
  if (next !== snapshot) snapshot = next
  return snapshot
}

export function useInstall() {
  const [kind, mobile] = useSyncExternalStore(subscribe, read).split('|') as [InstallKind, string]
  return { kind, mobile: mobile === '1', ua: navigator.userAgent }
}

/** Opens the browser's install dialog. "unavailable" when it is gone (used, or installed). */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = deferred
  if (!e) return 'unavailable'
  deferred = null // single use: the browser fires it again if it can
  notify()
  await e.prompt()
  return (await e.userChoice).outcome
}

const KEY = 'visitario.install'

/** This device's "Ahora no" (browser storage: it may be missing, it is only a courtesy). */
export function readMemo(): InstallMemo {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<InstallMemo> | null
    return { dismissedAt: typeof raw?.dismissedAt === 'number' ? raw.dismissedAt : null, dismissals: typeof raw?.dismissals === 'number' ? raw.dismissals : 0 }
  } catch {
    return { dismissedAt: null, dismissals: 0 }
  }
}

/** "Ahora no" rests a week; "Ya lo instalé" stops offering on this browser (it stays in the profile). */
export function rememberDismissal(installed = false, now = Date.now()) {
  const memo = readMemo()
  try {
    localStorage.setItem(KEY, JSON.stringify({ dismissedAt: now, dismissals: installed ? MAX_DISMISSALS : memo.dismissals + 1 }))
  } catch {
    // Without storage it simply offers again next time.
  }
}
