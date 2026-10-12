/** Photos are stored at most this many pixels on the long side, as JPEG at this quality. */
export const PHOTO_MAX_SIDE = 1400
export const PHOTO_QUALITY = 0.72

/** Scales down to fit the long side, never up. */
export function fitWithin(width: number, height: number, max = PHOTO_MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
