import { describe, expect, it } from 'vitest'
import { cropPixels, fromStored, moveBy, resizeBy, shownAspect, toStored, WHOLE } from './crop'

describe('crop', () => {
  it('stores the whole picture as no crop, and rounds the rest', () => {
    expect(toStored(WHOLE)).toBeNull()
    expect(toStored(null)).toBeNull()
    expect(toStored({ x: 0.123456, y: 0, w: 0.5, h: 0.75 })).toEqual([0.1235, 0, 0.5, 0.75])
  })

  it('reads a stored crop, and ignores a malformed one', () => {
    expect(fromStored([0.1, 0.2, 0.5, 0.5])).toEqual({ x: 0.1, y: 0.2, w: 0.5, h: 0.5 })
    expect(fromStored(null)).toBeNull()
    expect(fromStored([0.1, 0.2])).toBeNull()
    expect(fromStored([0, 0, 1, 1])).toBeNull()
  })

  it('moves the box without leaving the picture', () => {
    const c = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }
    expect(moveBy(c, 0.1, -0.1)).toEqual({ x: 0.30000000000000004, y: 0.1, w: 0.5, h: 0.5 })
    expect(moveBy(c, 1, 1)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 })
    expect(moveBy(c, -1, -1)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 })
  })

  it('resizes from a corner, keeping the opposite one and a minimum size', () => {
    const c = { x: 0.2, y: 0.2, w: 0.6, h: 0.6 }
    const se = resizeBy(c, 'se', -0.2, 0.5)
    expect(se.x).toBe(0.2)
    expect(se.y).toBe(0.2)
    expect(se.w).toBeCloseTo(0.4)
    expect(se.h).toBeCloseTo(0.8) // stops at the bottom edge
    const nw = resizeBy(c, 'nw', 0.9, 0.9)
    expect(nw.x + nw.w).toBeCloseTo(0.8)
    expect(nw.w).toBeCloseTo(0.05)
    expect(nw.h).toBeCloseTo(0.05)
  })

  it('gives the pixels to draw and the shape shown', () => {
    expect(cropPixels({ x: 0.25, y: 0, w: 0.5, h: 1 }, 1400, 1050)).toEqual({ sx: 350, sy: 0, sw: 700, sh: 1050 })
    expect(cropPixels(null, 1400, 1050)).toEqual({ sx: 0, sy: 0, sw: 1400, sh: 1050 })
    expect(shownAspect({ x: 0, y: 0, w: 0.5, h: 1 }, 1400, 1050)).toBeCloseTo(700 / 1050)
  })
})
