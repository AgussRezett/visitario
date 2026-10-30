import { describe, expect, it } from 'vitest'
import { brandTokens, BRAND_SUGGESTIONS, contrast, fitLogo, isAdjusted, mix, normalizeHex } from './brand'

const readable = (t: ReturnType<typeof brandTokens>) =>
  contrast(t.action, t.actionInk) >= 4.5 && contrast(t.actionHover, t.actionInk) >= 4.5 && contrast(t.selected, t.selectedInk) >= 4.5

describe('brand colors', () => {
  it('reads colors as people type them', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex(' d6336c ')).toBe('#d6336c')
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('#12345')).toBeNull()
  })

  it('measures contrast as WCAG does', () => {
    expect(contrast('#ffffff', '#000000')).toBeCloseTo(21, 0)
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1)
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('a dark color keeps its shade, with white text', () => {
    const t = brandTokens('#1f4e8c', 'light')
    expect(t.action).toBe('#1f4e8c')
    expect(t.actionInk).toBe('#ffffff')
    expect(isAdjusted('#1f4e8c')).toBe(false)
  })

  it('a light color gets dark text; a middle one is darkened just enough', () => {
    const yellow = brandTokens('#ffd400', 'light')
    expect(yellow.actionInk).toBe('#15241e')
    expect(yellow.action).toBe('#ffd400')
    const orange = brandTokens('#ff7a00', 'light')
    expect(contrast(orange.action, orange.actionInk)).toBeGreaterThanOrEqual(4.5)
  })

  it('every pair stays readable, in light and dark, whatever the color', () => {
    for (const c of [...BRAND_SUGGESTIONS, '#ffffff', '#000000', '#ffd400', '#00ff00', '#ff0000', '#808080', '#0000ff']) {
      expect(readable(brandTokens(c, 'light')), `${c} light`).toBe(true)
      expect(readable(brandTokens(c, 'dark')), `${c} dark`).toBe(true)
      expect(contrast(brandTokens(c, 'dark').action, '#172520'), `${c} dark button`).toBeGreaterThanOrEqual(3)
    }
  })

  it('a logo keeps its shape, and only shrinks', () => {
    expect(fitLogo(1440, 240)).toEqual({ width: 720, height: 120 })
    expect(fitLogo(500, 500)).toEqual({ width: 240, height: 240 })
    expect(fitLogo(300, 80)).toEqual({ width: 300, height: 80 })
  })
})
