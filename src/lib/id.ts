/**
 * UUID v7: time-ordered ids created on the device, so a record can be retried
 * without duplicates and sorts by creation (RFC 9562).
 */
export function uuidv7(now = Date.now()): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let ms = now
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ms % 256
    ms = Math.floor(ms / 256)
  }
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x70 // version 7
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80 // variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
