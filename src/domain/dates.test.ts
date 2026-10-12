import { describe, expect, it } from 'vitest'
import { argentinaTime, formatDayMonth, formatHour, formatLongDate, formatShortWeekday, formatTime, todayInArgentina } from './dates'

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
})
