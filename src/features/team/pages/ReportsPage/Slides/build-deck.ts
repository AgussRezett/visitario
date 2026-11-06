import type PptxGenJS from 'pptxgenjs'
import { DATE_AREA, TITLE_AREA, TOTAL_AREA, layoutPhotos, type Box } from '@/domain/slides'

// The .pptx itself, built in the browser: the company's backgrounds, the total on the cover,
// and one slide per visit with every "después". Photos are made lighter on the way (a
// quarter has hundreds), so the file opens fast and can be sent.

export interface DeckSlide {
  title: string
  date: string
  photoIds: string[]
}

export interface Deck {
  total: number
  slides: DeckSlide[]
  coverUrl: string | null
  pageUrl: string | null
  fileName: string
}

const W = 13.333 // inches: PowerPoint's 16:9
const H = 7.5
const LONG_SIDE = 1400 // pixels: sharp on a screen and a projector, a fraction of the original's weight
const QUALITY = 0.8
const AT_ONCE = 6

const inches = (b: Box) => ({ x: b.x * W, y: b.y * H, w: b.w * W, h: b.h * H })

/** Shorter titles fit bigger: "Juan María Gutiérrez 2522 #1120" still in one or two lines. */
const titleSize = (title: string) => (title.length <= 26 ? 32 : title.length <= 36 ? 28 : 22)

/**
 * Builds and downloads the presentation. `fileFor` brings each photo's file; `onStep` tells
 * how many photos are ready, for the progress bar. A photo that fails twice is left out.
 */
export async function buildDeck(deck: Deck, fileFor: (id: string) => Promise<Blob>, onStep: (done: number, total: number) => void): Promise<{ missing: number }> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.author = 'Visitario'
  pptx.title = deck.fileName.replace(/\.pptx$/, '')

  const [cover, page] = await Promise.all([deck.coverUrl ? dataUrl(deck.coverUrl) : null, deck.pageUrl ? dataUrl(deck.pageUrl) : null])

  const first = pptx.addSlide()
  if (cover) backdrop(first, cover)
  first.addText([{ text: 'TOTAL:', options: { breakLine: true } }, { text: String(deck.total) }], {
    ...inches(TOTAL_AREA), fontFace: 'Arial Black', fontSize: 30, bold: true, color: '000000', align: 'center', valign: 'middle',
  })

  const ids = deck.slides.flatMap((s) => s.photoIds)
  const images = new Map<string, { data: string; aspect: number }>()
  let done = 0
  let missing = 0
  onStep(0, ids.length)
  await pool(ids, AT_ONCE, async (id) => {
    const image = await lighter(() => fileFor(id)).catch(() => lighter(() => fileFor(id))).catch(() => null)
    if (image) images.set(id, image)
    else missing++
    onStep(++done, ids.length)
  })

  for (const s of deck.slides) {
    const slide = pptx.addSlide()
    if (page) backdrop(slide, page)
    slide.addText(s.title, { ...inches(TITLE_AREA), fontFace: 'Arial Black', fontSize: titleSize(s.title), bold: true, color: '000000', align: 'center', valign: 'middle', fit: 'shrink' })
    slide.addText(s.date, { ...inches(DATE_AREA), fontFace: 'Arial Black', fontSize: 14, bold: true, color: '000000', align: 'center', valign: 'middle' })
    const photos = s.photoIds.flatMap((id) => images.get(id) ?? [])
    layoutPhotos(photos.map((p) => p.aspect)).forEach((box, i) => {
      const photo = photos[i]
      if (photo) slide.addImage({ data: photo.data, ...inches(box) })
    })
  }

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob
  download(deck.fileName, blob)
  return { missing }
}

/**
 * The company's background as a full-slide picture behind everything, not as the slide's
 * background: PowerPoint drops a slide background when the slide is pasted into another
 * presentation (it takes that one's theme), but a picture always goes with it.
 */
function backdrop(slide: PptxGenJS.Slide, data: string) {
  slide.addImage({ data, x: 0, y: 0, w: W, h: H, altText: 'Fondo' })
}

/** A photo smaller and lighter, upright, as a data URL with its shape. */
async function lighter(file: () => Promise<Blob>): Promise<{ data: string; aspect: number }> {
  const bitmap = await createImageBitmap(await file())
  const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('photo')
  return { data: await asDataUrl(blob), aspect: canvas.width / canvas.height }
}

async function dataUrl(url: string): Promise<string | null> {
  const res = await fetch(url).catch(() => null)
  return res?.ok ? asDataUrl(await res.blob()) : null
}

function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Runs `work` over the items, a few at a time. */
async function pool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) await work(items[next++] as T)
  }))
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
