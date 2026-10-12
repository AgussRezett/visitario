import { describe, expect, it } from 'vitest'
import { formatDni, isPlausibleBirthDate, isValidDni, normalizeArPhone, normalizeDni } from './identity'

describe('DNI', () => {
  it('normalizes dots and spaces', () => expect(normalizeDni('34.567.890')).toBe('34567890'))
  it('accepts 7 or 8 digits', () => {
    expect(isValidDni('34.567.890')).toBe(true)
    expect(isValidDni('5.123.456')).toBe(true)
    expect(isValidDni('123456')).toBe(false)
    expect(isValidDni('34567890a')).toBe(false)
  })
  it('formats with dots', () => expect(formatDni('34567890')).toBe('34.567.890'))
})

describe('Argentine phone', () => {
  it.each([
    ['11 5555-4521', '+5491155554521'],
    ['011 15 5555 4521', '+5491155554521'],
    ['+54 9 11 5555 4521', '+5491155554521'],
    ['0351 15 512 3456', '+5493515123456'],
  ])('%s -> %s', (input, expected) => expect(normalizeArPhone(input)).toBe(expected))
  it('rejects short numbers', () => expect(normalizeArPhone('5555-4521')).toBeNull())
})

describe('birth date', () => {
  const today = new Date('2026-10-11T12:00:00')
  it('accepts adults', () => expect(isPlausibleBirthDate('1995-04-12', today)).toBe(true))
  it('rejects under 16 and nonsense', () => {
    expect(isPlausibleBirthDate('2015-01-01', today)).toBe(false)
    expect(isPlausibleBirthDate('1800-01-01', today)).toBe(false)
    expect(isPlausibleBirthDate('nope', today)).toBe(false)
  })
})
