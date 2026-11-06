import { cropPixels, type Crop } from '@/domain/crop'

/**
 * The photo's file with only its cropped part, for what leaves Visitario (WhatsApp, the
 * share sheet, the presentation). Without a crop, the same file.
 */
export async function croppedBlob(blob: Blob, crop: Crop | null, quality = 0.9): Promise<Blob> {
  if (!crop) return blob
  const bitmap = await createImageBitmap(blob)
  const { sx, sy, sw, sh } = cropPixels(crop, bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = sw
  canvas.height = sh
  canvas.getContext('2d')?.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh)
  bitmap.close()
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  return out ?? blob
}
