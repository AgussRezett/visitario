import { describe, expect, it } from 'vitest'
import { PHOTO_AREA, SLIDE_RATIO, dayMonth, deckFileName, layoutPhotos, slideTitle, type Box } from './slides'

const inside = (b: Box) =>
  b.x >= PHOTO_AREA.x - 1e-9 && b.y >= PHOTO_AREA.y - 1e-9 && b.x + b.w <= PHOTO_AREA.x + PHOTO_AREA.w + 1e-9 && b.y + b.h <= PHOTO_AREA.y + PHOTO_AREA.h + 1e-9
const overlap = (a: Box, b: Box) => a.x < b.x + b.w - 1e-9 && b.x < a.x + a.w - 1e-9 && a.y < b.y + b.h - 1e-9 && b.y < a.y + a.h - 1e-9
const aspectOf = (b: Box) => (b.w / b.h) * SLIDE_RATIO

describe('the photos of a visit on one slide', () => {
  it('keeps every photo, its shape, inside the area and without overlaps', () => {
    for (const aspects of [[4 / 3], [4 / 3, 3 / 4], [16 / 9, 16 / 9, 3 / 4], [3 / 4, 3 / 4, 3 / 4, 3 / 4], [4 / 3, 4 / 3, 4 / 3, 4 / 3, 4 / 3, 4 / 3, 4 / 3]]) {
      const boxes = layoutPhotos(aspects)
      expect(boxes).toHaveLength(aspects.length)
      boxes.forEach((b, i) => {
        expect(inside(b)).toBe(true)
        expect(aspectOf(b)).toBeCloseTo(aspects[i] as number, 5)
        boxes.slice(i + 1).forEach((o) => expect(overlap(b, o)).toBe(false))
      })
    }
  })

  it('one landscape photo is big and centred', () => {
    const [b] = layoutPhotos([4 / 3])
    if (!b) throw new Error('no box')
    expect(b.h).toBeCloseTo(PHOTO_AREA.h, 5) // as tall as the area
    expect(b.x + b.w / 2).toBeCloseTo(PHOTO_AREA.x + PHOTO_AREA.w / 2, 5)
  })

  it('three landscape photos side by side, not one big and two small', () => {
    const boxes = layoutPhotos([16 / 9, 16 / 9, 16 / 9])
    expect(new Set(boxes.map((b) => b.w.toFixed(4))).size).toBe(1)
  })

  it('three photos side by side when that is biggest; many go in rows', () => {
    const three = layoutPhotos([4 / 3, 4 / 3, 3 / 4])
    expect(new Set(three.map((b) => b.y.toFixed(4))).size).toBe(1)
    const eight = layoutPhotos(Array(8).fill(4 / 3))
    expect(new Set(eight.map((b) => b.y.toFixed(4))).size).toBeGreaterThan(1)
  })

  it('keeps the order: left to right, then the next row', () => {
    const boxes = layoutPhotos(Array(6).fill(4 / 3))
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1] as Box
      const b = boxes[i] as Box
      expect(b.y > a.y + 1e-9 || (Math.abs(b.y - a.y) < 1e-9 && b.x > a.x)).toBe(true)
    }
  })

  it('no photos, no boxes', () => expect(layoutPhotos([])).toEqual([]))
})

describe('the texts', () => {
  it('title, day and file name as they use them', () => {
    expect(slideTitle('Alberdi 1021', '10142')).toBe('Alberdi 1021 #10142')
    expect(slideTitle('Thames 1100', null)).toBe('Thames 1100')
    expect(dayMonth('2026-10-15')).toBe('15/10')
    expect(deckFileName('2026-10-01', '2026-12-31')).toBe('visitario-2026-10-01-a-2026-12-31.pptx')
    expect(deckFileName('2026-11-04', '2026-11-04')).toBe('visitario-2026-11-04.pptx')
  })
})
