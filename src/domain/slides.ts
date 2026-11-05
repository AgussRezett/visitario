// The photo presentation (one slide per visit with every "después"), as fractions of the
// slide (0–1), so the same layout draws the preview and the PowerPoint.

export interface Box { x: number; y: number; w: number; h: number }

/** A 16:9 slide: its width is 16/9 of its height, so fractions are turned into a real shape here. */
export const SLIDE_RATIO = 16 / 9

/** Where the photos go on a slide: under the title, clear of the corners' artwork. */
export const PHOTO_AREA: Box = { x: 0.06, y: 0.2, w: 0.88, h: 0.7 }
/** The address and customer number: between the left artwork and the logos. */
export const TITLE_AREA: Box = { x: 0.12, y: 0.025, w: 0.74, h: 0.15 }
/** The visit's day, under the logos on the right. */
export const DATE_AREA: Box = { x: 0.86, y: 0.105, w: 0.13, h: 0.06 }
/** The cover's total, between the brand and the logos at the bottom. */
export const TOTAL_AREA: Box = { x: 0.3, y: 0.585, w: 0.4, h: 0.18 }

const GAP = 0.012 // between photos, as a fraction of the slide's width

/**
 * Every photo of a visit on one slide: in one, two or three rows (whichever keeps the
 * smallest photo biggest, so none is left tiny), each row as tall as its photos allow,
 * all centred in the area. `aspects` are
 * width / height; the boxes come back in the same order, as slide fractions.
 */
export function layoutPhotos(aspects: readonly number[], area: Box = PHOTO_AREA): Box[] {
  const n = aspects.length
  if (!n) return []
  // Work in real proportions: x in slide widths, y in slide widths too (height / ratio).
  const width = area.w
  const height = area.h / SLIDE_RATIO
  let best: { rows: number[][]; scale: number; smallest: number; area: number } | null = null
  for (let count = 1; count <= Math.min(n, 3); count++) {
    const rows = splitRows(aspects, count)
    // Each row fills the width: its height is what its photos' aspects allow.
    const heights = rows.map((row) => (width - GAP * (row.length - 1)) / row.reduce((sum, i) => sum + (aspects[i] ?? 1), 0))
    const total = heights.reduce((a, b) => a + b, 0) + GAP * (rows.length - 1)
    const scale = Math.min(1, height / total)
    const sizes = heights.flatMap((h, r) => (rows[r] ?? []).map((i) => (aspects[i] ?? 1) * h * h * scale * scale))
    const smallest = Math.min(...sizes)
    const covered = sizes.reduce((a, b) => a + b, 0)
    if (!best || smallest > best.smallest * 1.02 || (smallest > best.smallest * 0.98 && covered > best.area)) best = { rows, scale, smallest, area: covered }
  }
  if (!best) return []
  const { rows, scale } = best
  const boxes: Box[] = new Array(n)
  const rowHeights = rows.map((row) => ((width - GAP * (row.length - 1)) / row.reduce((sum, i) => sum + (aspects[i] ?? 1), 0)) * scale)
  const blockHeight = rowHeights.reduce((a, b) => a + b, 0) + GAP * (rows.length - 1)
  let top = (height - blockHeight) / 2
  rows.forEach((row, r) => {
    const h = rowHeights[r] ?? 0
    const rowWidth = row.reduce((sum, i) => sum + (aspects[i] ?? 1) * h, 0) + GAP * (row.length - 1)
    let left = (width - rowWidth) / 2
    for (const i of row) {
      const w = (aspects[i] ?? 1) * h
      boxes[i] = { x: area.x + left, y: area.y + top * SLIDE_RATIO, w, h: h * SLIDE_RATIO }
      left += w + GAP
    }
    top += h + GAP
  })
  return boxes
}

/** The photos in `count` rows, in order, as even as their widths allow. */
function splitRows(aspects: readonly number[], count: number): number[][] {
  const share = aspects.reduce((a, b) => a + b, 0) / count
  const rows: number[][] = [[]]
  let done = 0 // widths placed so far
  aspects.forEach((a, i) => {
    const current = rows[rows.length - 1] as number[]
    const photosLeft = aspects.length - i
    const rowsLeft = count - rows.length
    // A new row once this photo's middle passes the row's share (one photo per row at least).
    if (current.length && rowsLeft > 0 && (done + a / 2 > share * rows.length || photosLeft <= rowsLeft)) rows.push([i])
    else current.push(i)
    done += a
  })
  return rows
}

/** "Alberdi 1021 #10142": the address and the customer number, as on the slides they use. */
export function slideTitle(address: string, customerNumber: string | null): string {
  return customerNumber ? `${address} #${customerNumber}` : address
}

/** "15/10" */
export const dayMonth = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`

/** A file name like "visitario-2026-10-01-a-2026-12-31.pptx". */
export const deckFileName = (from: string, to: string) => `visitario-${from}${from === to ? '' : `-a-${to}`}.pptx`
