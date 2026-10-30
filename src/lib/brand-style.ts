import { brandTokens, brandVariables, normalizeHex } from '@/domain/brand'

const ID = 'company-brand'
const block = (selector: string, vars: Record<string, string>) => `${selector}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}`

/**
 * Paints the app with a company's color: its action and selection colors, for light and
 * dark (each theme gets its own readable shades). null goes back to Visitario's own.
 * `:root:root` outranks the theme's own `:root`, whatever order the styles load in.
 */
export function applyBrand(color: string | null) {
  const hex = color ? normalizeHex(color) : null
  let style = document.getElementById(ID)
  if (!hex) {
    style?.remove()
    return
  }
  if (!style) {
    style = document.createElement('style')
    style.id = ID
    document.head.append(style)
  }
  style.textContent = [
    block(':root:root', brandVariables(brandTokens(hex, 'light'))),
    block(":root:root[data-theme='dark']", brandVariables(brandTokens(hex, 'dark'))),
  ].join('\n')
}
