import { describe, expect, it } from 'vitest'
import { addDays, greeting, weekOf, weekdayInitial, argentinaTime, formatDayMonth, formatHour, formatLongDate, formatShortWeekday, formatTime, todayInArgentina } from './dates'

describe('dates', () => {
  it('uses the Argentine day even when UTC is already tomorrow', () => {
    expect(todayInArgentina(new Date('2026-10-14T01:30:00Z'))).toBe('2026-10-13')
  })
  it('formats long and short dates in Spanish', () => {
    expect(formatLongDate('2026-10-12')).toBe('Lunes 12 de octubre')
    expect(formatShortWeekday('2026-10-10')).toBe('Sáb 10/10')
    expect(formatDayMonth('2026-10-09')).toBe('09/10')
    expect(formatDayMonth('2026-10-09', true)).toBe('09/10/2026')
  })
  it('shows times in Argentina', () => {
    expect(formatTime('2026-10-13T17:12:00Z')).toBe('14:12')
    expect(argentinaTime('2026-10-13', 17)).toBe('2026-10-13T20:00:00.000Z')
    expect(formatHour('2026-10-13T20:00:00Z')).toBe('17 h')
    expect(formatHour('2026-10-13T20:30:00Z')).toBe('17:30 h')
  })
  it('builds the week from Monday', () => {
    expect(weekOf('2026-10-15')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])
    expect(weekOf('2026-10-12')[0]).toBe('2026-10-12')
    expect(weekOf('2026-10-18')[0]).toBe('2026-10-12')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(weekdayInitial('2026-10-12')).toBe('L')
  })
  it('greets by the hour in Argentina', () => {
    expect(greeting(new Date('2026-10-12T12:00:00Z'))).toBe('Buen día')
    expect(greeting(new Date('2026-10-12T18:00:00Z'))).toBe('Buenas tardes')
    expect(greeting(new Date('2026-10-13T01:00:00Z'))).toBe('Buenas noches')
  })
})
