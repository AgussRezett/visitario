import { describe, expect, it } from 'vitest'
import { androidBrowser, chromeIntent, installKind, safariVersion, shouldOffer } from './install'

const UA = {
  iphoneSafari26: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
  iphoneSafari17: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/138.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
  androidWebView: 'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0 Mobile Safari/537.36',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0',
}
const device = (ua: string, extra: Partial<{ standalone: boolean; canPrompt: boolean; touch: boolean }> = {}) => ({ ua, standalone: false, canPrompt: false, ...extra })

describe('install', () => {
  it('knows how each browser installs', () => {
    expect(installKind(device(UA.androidChrome, { standalone: true }))).toBe('installed')
    expect(installKind(device(UA.androidChrome, { canPrompt: true }))).toBe('native')
    expect(installKind(device(UA.androidChrome))).toBe('android-manual')
    expect(installKind(device(UA.androidFirefox))).toBe('android-manual')
    expect(installKind(device(UA.androidWebView))).toBe('in-app')
    expect(installKind(device(UA.iphoneSafari26))).toBe('ios-safari')
    expect(installKind(device(UA.iphoneChrome))).toBe('ios-other')
    expect(installKind(device(UA.iphoneInstagram))).toBe('in-app')
    expect(installKind(device(UA.ipad, { touch: true }))).toBe('ios-safari')
    expect(installKind(device(UA.macSafari))).toBe('desktop-safari')
    expect(installKind(device(UA.macChrome, { canPrompt: true }))).toBe('native')
    expect(installKind(device(UA.winFirefox))).toBe('unsupported')
  })

  it('reads Safari’s version and the Android browser', () => {
    expect(safariVersion(UA.iphoneSafari26)).toBe(26)
    expect(safariVersion(UA.iphoneSafari17)).toBe(17)
    expect(safariVersion(UA.androidFirefox)).toBeNull()
    expect(androidBrowser(UA.androidSamsung)).toBe('samsung')
    expect(androidBrowser(UA.androidFirefox)).toBe('firefox')
    expect(androidBrowser(UA.androidChrome)).toBe('chrome')
  })

  it('offers on phones, on computers only with one tap, and rests a week after "Ahora no"', () => {
    const now = Date.UTC(2026, 9, 20)
    const fresh = { dismissedAt: null, dismissals: 0 }
    expect(shouldOffer('ios-safari', true, fresh, now)).toBe(true)
    expect(shouldOffer('desktop-safari', false, fresh, now)).toBe(false)
    expect(shouldOffer('native', false, fresh, now)).toBe(true)
    expect(shouldOffer('installed', true, fresh, now)).toBe(false)
    expect(shouldOffer('native', true, { dismissedAt: now - 2 * 86_400_000, dismissals: 1 }, now)).toBe(false)
    expect(shouldOffer('native', true, { dismissedAt: now - 8 * 86_400_000, dismissals: 1 }, now)).toBe(true)
    expect(shouldOffer('native', true, { dismissedAt: now - 30 * 86_400_000, dismissals: 3 }, now)).toBe(false)
  })

  it('opens Chrome from an Android web view', () => {
    expect(chromeIntent('https://visitario.vercel.app/s/workday?date=2026-10-20')).toBe(
      'intent://visitario.vercel.app/s/workday?date=2026-10-20#Intent;scheme=https;package=com.android.chrome;end',
    )
  })
})
