import { describe, expect, it } from 'vitest'
import { avatarPath, centerSquare, clampFraming, formatArPhone, framedSquare, isEmail, readProfile } from './profile'

describe('profile', () => {
  it('a round avatar shows the centered square', () => {
    expect(centerSquare(1400, 1050)).toEqual({ sx: 175, sy: 0, side: 1050 })
    expect(centerSquare(900, 1600)).toEqual({ sx: 0, sy: 350, side: 900 })
  })

  it('a photo goes to my folder with a new name', () => {
    expect(avatarPath('u1', 1792740000000)).toBe('u1/1792740000000.jpg')
  })

  it('reads names, an Argentine mobile and a birth date', () => {
    const r = readProfile({ firstName: '  Agustín ', lastName: 'Rezett  Díaz', phone: '11 5555-4521', birthDate: '1995-04-12' }, new Date('2026-10-23'))
    expect(r).toMatchObject({ ok: true, value: { firstName: 'Agustín', lastName: 'Rezett Díaz', phone: '+5491155554521', birthDate: '1995-04-12' } })
    expect(readProfile({ firstName: 'A', lastName: 'B', phone: '', birthDate: '' }).value).toMatchObject({ phone: null, birthDate: null })
  })

  it('says what to fix', () => {
    const r = readProfile({ firstName: ' ', lastName: 'B', phone: '1234', birthDate: '2020-01-01' }, new Date('2026-10-23'))
    expect(r.ok).toBe(false)
    expect(r.errors).toEqual({ firstName: 'Ingresá tu nombre', phone: 'Escribilo con característica, por ejemplo 11 5555-4521', birthDate: 'Revisá la fecha' })
  })

  it('checks an email', () => {
    expect(isEmail('agus@example.com')).toBe(true)
    expect(isEmail('agus@example')).toBe(false)
    expect(isEmail('agus example.com')).toBe(false)
  })
})

describe('formatArPhone', () => {
  it('writes a mobile the usual way', () => {
    expect(formatArPhone('+5491155554521')).toBe('11 5555-4521')
    expect(formatArPhone(null)).toBeNull()
  })
})

describe('framing a photo', () => {
  it('without moving or zooming it is the centered square', () => {
    expect(framedSquare({ zoom: 1, x: 0, y: 0 }, 1400, 1050, 300)).toEqual(centerSquare(1400, 1050))
  })
  it('zooming takes a smaller square; moving right shows more of the left', () => {
    expect(framedSquare({ zoom: 2, x: 0, y: 0 }, 1000, 1000, 250)).toEqual({ sx: 250, sy: 250, side: 500 })
    expect(framedSquare({ zoom: 2, x: 125, y: 0 }, 1000, 1000, 250)).toEqual({ sx: 0, sy: 250, side: 500 })
  })
  it('never leaves a gap: movement and zoom are limited', () => {
    expect(clampFraming({ zoom: 1, x: 999, y: 50 }, 1000, 1000, 250)).toEqual({ zoom: 1, x: 0, y: 0 })
    expect(clampFraming({ zoom: 9, x: -999, y: 0 }, 2000, 1000, 250)).toEqual({ zoom: 4, x: -875, y: 0 })
    expect(clampFraming({ zoom: 0.2, x: 0, y: 0 }, 1000, 1000, 250).zoom).toBe(1)
  })
})
