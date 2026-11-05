// Encodes a shot as JPEG away from the screen's thread: while it works, the visit keeps
// answering and showing that the photo is on its way.
// In: { id, bitmap, quality } (the bitmap is handed over, not copied). Out: { id, blob } or { id, error }.

interface Job { id: number; bitmap: ImageBitmap; quality: number }

self.onmessage = async (e: MessageEvent<Job>) => {
  const { id, bitmap, quality } = e.data
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no context')
    ctx.drawImage(bitmap, 0, 0)
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
    self.postMessage({ id, blob })
  } catch {
    self.postMessage({ id, error: true })
  } finally {
    bitmap.close()
  }
}
