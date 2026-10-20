/**
 * Installing Visitario (it is a PWA, and almost nobody knows it). Each browser installs
 * differently: Chrome, Edge and Samsung Internet let the page open the install dialog
 * (beforeinstallprompt); Safari on iPhone and the rest need steps in their menus; inside
 * another app (Instagram, Facebook, an Android web view) it has to open in the browser first.
 */

export type InstallKind =
  | 'installed' // already opened as the app
  | 'native' // the browser lets us open its install dialog
  | 'ios-safari'
  | 'ios-other' // Chrome, Firefox or Edge on iPhone: Share → Add to Home Screen, or Safari
  | 'android-manual' // Android without the dialog (yet): from the browser menu
  | 'in-app' // inside Instagram, Facebook, TikTok… or an Android web view
  | 'desktop-safari' // macOS Safari 17+: File → Add to Dock
  | 'unsupported' // desktop Firefox and the like

export type AndroidBrowser = 'chrome' | 'samsung' | 'firefox' | 'other'

export interface Device {
  ua: string
  /** display-mode: standalone, or navigator.standalone on iOS. */
  standalone: boolean
  /** A beforeinstallprompt event is waiting to be used. */
  canPrompt: boolean
  /** maxTouchPoints > 1: an iPad says "Macintosh" in its user agent. */
  touch?: boolean
}

const IN_APP = /FBAN|FBAV|FB_IAB|Instagram|Line\/|LinkedInApp|TikTok|musical_ly|Snapchat|Pinterest|; wv\)/i

export const isIos = (d: Pick<Device, 'ua' | 'touch'>) => /iPhone|iPad|iPod/.test(d.ua) || (/Macintosh/.test(d.ua) && Boolean(d.touch))
export const isAndroid = (ua: string) => /Android/i.test(ua)
/** Phones and tablets: where installing matters most (and the offer opens by itself). */
export const isMobile = (d: Pick<Device, 'ua' | 'touch'>) => isIos(d) || isAndroid(d.ua)

export function installKind(d: Device): InstallKind {
  if (d.standalone) return 'installed'
  if (IN_APP.test(d.ua)) return 'in-app'
  if (d.canPrompt) return 'native'
  if (isIos(d)) return /CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(d.ua) ? 'ios-other' : 'ios-safari'
  if (isAndroid(d.ua)) return 'android-manual'
  if (/Macintosh/.test(d.ua) && /Version\/\d+.*Safari/.test(d.ua) && !/Chrome|Chromium|Edg\//.test(d.ua)) return 'desktop-safari'
  return 'unsupported'
}

/** Safari's version ("Version/26.0"): iOS 26 moved Share into the "···" menu. */
export function safariVersion(ua: string): number | null {
  const v = /Version\/(\d+)/.exec(ua)?.[1]
  return v ? Number(v) : null
}

export function androidBrowser(ua: string): AndroidBrowser {
  if (/SamsungBrowser/i.test(ua)) return 'samsung'
  if (/Firefox/i.test(ua)) return 'firefox'
  if (/Chrome/i.test(ua)) return 'chrome'
  return 'other'
}

/** What this device remembers about the offer. */
export interface InstallMemo {
  dismissedAt: number | null
  dismissals: number
}

const WEEK_MS = 7 * 24 * 60 * 60_000
/** After this many "Ahora no", the offer stays only in the profile. */
export const MAX_DISMISSALS = 3

/**
 * Whether the offer opens by itself: on phones whenever it can be installed, on a computer
 * only when the browser installs with one tap. Never again for a week after "Ahora no".
 */
export function shouldOffer(kind: InstallKind, mobile: boolean, memo: InstallMemo, now: number) {
  if (kind === 'installed' || kind === 'unsupported') return false
  if (!mobile && kind !== 'native') return false
  if (memo.dismissals >= MAX_DISMISSALS) return false
  return memo.dismissedAt === null || now - memo.dismissedAt >= WEEK_MS
}

/** Android web views open Chrome with an intent link; elsewhere the person copies the link. */
export function chromeIntent(url: string) {
  const u = new URL(url)
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`
}
