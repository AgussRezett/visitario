// The shot as JPEG: in a worker when the browser has OffscreenCanvas (the screen stays
// free), else on the page as before.

let worker: Worker | null = null
let next = 0
const waiting = new Map<number, (blob: Blob | null) => void>()

const canUseWorker = () => typeof OffscreenCanvas !== 'undefined' && 'convertToBlob' in OffscreenCanvas.prototype && typeof createImageBitmap === 'function'

function encoder() {
  if (worker) return worker
  worker = new Worker(new URL('./encode.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ id: number; blob?: Blob; error?: boolean }>) => {
    waiting.get(e.data.id)?.(e.data.blob ?? null)
    waiting.delete(e.data.id)
  }
  worker.onerror = () => {
    // A worker that cannot start: everything waiting goes the old way.
    waiting.forEach((done) => done(null))
    waiting.clear()
    worker = null
  }
  return worker
}

const onPage = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/**
 * The canvas as a JPEG. The picture is copied out of the canvas first (a quick GPU copy),
 * so the canvas is free again right away; the encoding happens in the worker.
 */
export async function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  if (!canUseWorker()) return onPage(canvas, quality)
  try {
    const bitmap = await createImageBitmap(canvas)
    const id = ++next
    const blob = await new Promise<Blob | null>((resolve) => {
      waiting.set(id, resolve)
      encoder().postMessage({ id, bitmap, quality }, [bitmap])
    })
    return blob ?? (await onPage(canvas, quality))
  } catch {
    return onPage(canvas, quality)
  }
}
