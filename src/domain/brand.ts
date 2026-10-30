// A company's color, turned into the colors the app paints with. Only the action (primary
// buttons) and the selection (current menu item, picked surfaces) follow the company:
// status colors keep their meaning whatever the brand. Every pair keeps text readable
// (4.5:1), adjusting the shade only when it has to.

export type Rgb = [number, number, number]

const WHITE = '#ffffff'
const BLACK = '#000000'
/** The app's own surfaces and ink (src/styles/base/_themes.scss). */
const LIGHT = { card: '#ffffff', ink: '#15241e' }
const DARK = { card: '#172520', ink: '#0f1a16' }
const TEXT = 4.5
const SHAPE = 3

/** '#AbC' or 'abcdef' → '#aabbcc'; null when it is not a color. */
export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(v)) return `#${[...v].map((c) => c + c).join('')}`
  if (/^[0-9a-f]{6}$/.test(v)) return `#${v}`
  return null
}

const rgb = (hex: string): Rgb => {
  const v = normalizeHex(hex) ?? '#000000'
  return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) as Rgb
}
const hexOf = (c: Rgb) => `#${c.map((x) => Math.round(Math.min(255, Math.max(0, x))).toString(16).padStart(2, '0')).join('')}`

/** `a` moved toward `b` by `t` (0 to 1). */
export const mix = (a: string, b: string, t: number) => {
  const [x, y] = [rgb(a), rgb(b)]
  return hexOf(x.map((v, i) => v + ((y[i] ?? 0) - v) * t) as Rgb)
}

const channel = (v: number) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export const luminance = (hex: string) => {
  const [r, g, b] = rgb(hex).map(channel) as Rgb
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

/** The first shade of `from` toward `to` that passes `ok` (or `to` itself). */
function shadeUntil(from: string, to: string, ok: (c: string) => boolean) {
  for (let t = 0; t <= 1; t += 0.02) {
    const c = mix(from, to, t)
    if (ok(c)) return c
  }
  return to
}

export interface BrandTokens {
  action: string
  actionHover: string
  actionInk: string
  selected: string
  selectedInk: string
}

export function brandTokens(color: string, mode: 'light' | 'dark'): BrandTokens {
  const c = normalizeHex(color) ?? LIGHT.ink
  if (mode === 'light') {
    // White or the app's ink, whichever reads better; darker or lighter only if neither does.
    const ink = contrast(c, WHITE) >= contrast(c, LIGHT.ink) ? WHITE : LIGHT.ink
    const action = shadeUntil(c, ink === WHITE ? BLACK : WHITE, (x) => contrast(x, ink) >= TEXT)
    const hover = ink === WHITE ? mix(action, BLACK, 0.14) : shadeUntil(mix(action, BLACK, 0.08), WHITE, (x) => contrast(x, ink) >= TEXT)
    const selected = mix(c, LIGHT.card, 0.86)
    return { action, actionHover: hover, actionInk: ink, selected, selectedInk: shadeUntil(c, BLACK, (x) => contrast(x, selected) >= TEXT) }
  }
  // Dark: the button must stand out on the dark card, with dark or white text on it.
  const fits = (x: string) => contrast(x, DARK.card) >= SHAPE
  const withWhite = fits(c) && contrast(c, WHITE) >= TEXT
  const action = withWhite ? c : shadeUntil(c, WHITE, (x) => fits(x) && contrast(x, DARK.ink) >= TEXT)
  const ink = withWhite ? WHITE : DARK.ink
  const hover = withWhite ? mix(action, BLACK, 0.14) : shadeUntil(mix(action, WHITE, 0.12), WHITE, (x) => contrast(x, ink) >= TEXT)
  const selected = mix(c, DARK.card, 0.8)
  return { action, actionHover: hover, actionInk: ink, selected, selectedInk: shadeUntil(c, WHITE, (x) => contrast(x, selected) >= TEXT) }
}

/** Whether the color had to change to be readable on the buttons (to say so to the admin). */
export const isAdjusted = (color: string) => {
  const c = normalizeHex(color)
  return c !== null && brandTokens(c, 'light').action !== c
}

/** The CSS custom properties that carry the brand (see src/styles/base/_themes.scss). */
export const brandVariables = (t: BrandTokens): Record<string, string> => ({
  '--action': t.action,
  '--action-hover': t.actionHover,
  '--action-ink': t.actionInk,
  '--selected': t.selected,
  '--selected-ink': t.selectedInk,
})

/** A few colors that read well, for the admin to start from. */
export const BRAND_SUGGESTIONS = ['#173b30', '#1f4e8c', '#6b4bd8', '#c2185b', '#d35400', '#00796b', '#37474f', '#b8860b']

/** A logo, at most this big (it shows at 36 px high, sharp on any screen). */
export const LOGO_MAX = { width: 720, height: 240 }

/** The size a logo is saved at: as it is if it fits, scaled down keeping its shape if not. */
export function fitLogo(width: number, height: number, max = LOGO_MAX) {
  const scale = Math.min(1, max.width / width, max.height / height)
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
