// A photo's crop: the part of the picture to show, as fractions of its width and height.
// The file stays as taken; the crop is applied wherever the photo is shown or sent.

export interface Crop {
  x: number
  y: number
  w: number
  h: number
}

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

/** The smallest crop side (also the database's check). */
export const MIN_SIDE = 0.05
export const WHOLE: Crop = { x: 0, y: 0, w: 1, h: 1 }

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const round = (n: number) => Math.round(n * 10000) / 10000

/** The crop as stored ([x, y, w, h]), or null for the whole picture. */
export function toStored(c: Crop | null): number[] | null {
  if (!c || isWhole(c)) return null
  return [round(c.x), round(c.y), round(c.w), round(c.h)]
}

/** A stored crop, or null when missing or malformed (the photo shows whole). */
export function fromStored(v: readonly number[] | null | undefined): Crop | null {
  if (!v || v.length !== 4 || v.some((n) => typeof n !== 'number' || !Number.isFinite(n))) return null
  const [x = 0, y = 0, w = 1, h = 1] = v
  return isWhole({ x, y, w, h }) ? null : fitInside({ x, y, w, h })
}

export const isWhole = (c: Crop) => c.x <= 0.001 && c.y <= 0.001 && c.w >= 0.999 && c.h >= 0.999

/** Inside the picture and not smaller than the minimum. */
export function fitInside(c: Crop): Crop {
  const w = clamp(c.w, MIN_SIDE, 1)
  const h = clamp(c.h, MIN_SIDE, 1)
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h }
}

/** Dragging the whole box: it slides, stopping at the edges. */
export function moveBy(c: Crop, dx: number, dy: number): Crop {
  return { ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) }
}

/** Dragging a corner: the opposite corner stays put. */
export function resizeBy(c: Crop, corner: Corner, dx: number, dy: number): Crop {
  let left = c.x
  let top = c.y
  let right = c.x + c.w
  let bottom = c.y + c.h
  if (corner === 'nw' || corner === 'sw') left = clamp(left + dx, 0, right - MIN_SIDE)
  else right = clamp(right + dx, left + MIN_SIDE, 1)
  if (corner === 'nw' || corner === 'ne') top = clamp(top + dy, 0, bottom - MIN_SIDE)
  else bottom = clamp(bottom + dy, top + MIN_SIDE, 1)
  return { x: left, y: top, w: right - left, h: bottom - top }
}

/** The crop in pixels of a picture this size (for drawing it on a canvas). */
export function cropPixels(c: Crop | null, width: number, height: number) {
  const k = c ?? WHOLE
  const sx = Math.round(k.x * width)
  const sy = Math.round(k.y * height)
  return { sx, sy, sw: Math.max(1, Math.round(k.w * width)), sh: Math.max(1, Math.round(k.h * height)) }
}

/** Width over height of what is shown. */
export const shownAspect = (c: Crop | null, width: number, height: number) => ((c ?? WHOLE).w * width) / ((c ?? WHOLE).h * height)
