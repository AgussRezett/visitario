import { isPlausibleBirthDate, normalizeArPhone } from './identity'

/** Profile photos are square, this many pixels a side (sharp at twice the largest avatar). */
export const AVATAR_SIDE = 512

/** The centered square of a picture: what a round avatar shows. */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height)
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side }
}

/** Where a person's photo goes: their own folder, a new name each time (no stale caches). */
export const avatarPath = (userId: string, now = Date.now()) => `${userId}/${now}.jpg`

export interface ProfileInput {
  firstName: string
  lastName: string
  phone: string
  birthDate: string
}

export type ProfileErrors = Partial<Record<keyof ProfileInput, string>>

/** What the person typed, checked and ready to save; or what to fix, in their words. */
export function readProfile(v: ProfileInput, today = new Date()) {
  const errors: ProfileErrors = {}
  const firstName = v.firstName.trim().replace(/\s+/g, ' ')
  const lastName = v.lastName.trim().replace(/\s+/g, ' ')
  if (!firstName) errors.firstName = 'Ingresá tu nombre'
  else if (firstName.length > 80) errors.firstName = 'Usá hasta 80 letras'
  if (!lastName) errors.lastName = 'Ingresá tu apellido'
  else if (lastName.length > 80) errors.lastName = 'Usá hasta 80 letras'
  const phone = v.phone.trim() ? normalizeArPhone(v.phone) : null
  if (v.phone.trim() && !phone) errors.phone = 'Escribilo con característica, por ejemplo 11 5555-4521'
  const birthDate = v.birthDate || null
  if (birthDate && !isPlausibleBirthDate(birthDate, today)) errors.birthDate = 'Revisá la fecha'
  return { errors, value: { firstName, lastName, phone, birthDate }, ok: Object.keys(errors).length === 0 }
}

/** An email worth sending a confirmation to. */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())

/** '+5491155554521' → '11 5555-4521', as people write it. */
export function formatArPhone(e164: string | null) {
  if (!e164) return null
  const d = e164.replace(/^\+549/, '')
  return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}` : e164
}

/**
 * Framing a photo in a round avatar: the picture covers a square view of `view` px, scaled
 * by `zoom` (1 = it just covers the view) and moved by `x`, `y` px from the center.
 */
export interface Framing {
  zoom: number
  x: number
  y: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

/** The picture never leaves a gap inside the view: zoom kept in range, movement limited. */
export function clampFraming(f: Framing, width: number, height: number, view: number): Framing {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, f.zoom))
  const scale = (view / Math.min(width, height)) * zoom
  const maxX = Math.max(0, (width * scale - view) / 2)
  const maxY = Math.max(0, (height * scale - view) / 2)
  const clamp = (v: number, max: number) => Math.min(max, Math.max(-max, v))
  return { zoom, x: clamp(f.x, maxX), y: clamp(f.y, maxY) }
}

/** The square of the original picture that the view shows, in its own pixels. */
export function framedSquare(f: Framing, width: number, height: number, view: number) {
  const { zoom, x, y } = clampFraming(f, width, height, view)
  const scale = (view / Math.min(width, height)) * zoom
  const side = view / scale
  return { sx: Math.round(width / 2 - x / scale - side / 2), sy: Math.round(height / 2 - y / scale - side / 2), side: Math.round(side) }
}
