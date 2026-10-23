import { describe, expect, it } from 'vitest'
import { avatarPath, centerSquare, formatArPhone, isEmail, readProfile } from './profile'

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
