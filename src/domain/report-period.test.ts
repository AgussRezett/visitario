import { describe, expect, it } from 'vitest'
import { datesOf, previousRange, rangeFor, rangeLabel, workingDays } from './report-period'

describe('report period', () => {
  const today = '2026-11-03' // a Tuesday
  it('presets', () => {
    expect(rangeFor('7d', today)).toEqual({ from: '2026-10-28', to: '2026-11-03' })
    expect(rangeFor('month', today)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(rangeFor('prev_month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    // Quarters: Q4 is October to December; the one before, July to September.
    expect(rangeFor('quarter', today)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(rangeFor('prev_quarter', today)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(rangeFor('prev_quarter', '2026-02-10')).toEqual({ from: '2025-10-01', to: '2025-12-31' })
    expect(rangeFor('custom', today, { from: '2026-10-05', to: '2026-10-01' })).toEqual(rangeFor('30d', today))
  })

  it('the period before has the same length', () => {
    expect(previousRange({ from: '2026-11-01', to: '2026-11-30' })).toEqual({ from: '2026-10-02', to: '2026-10-31' })
    expect(datesOf({ from: '2026-10-30', to: '2026-11-02' })).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'])
  })

  it('working days are Monday to Saturday, split at today', () => {
    const w = workingDays({ from: '2026-11-01', to: '2026-11-08' }, today)
    expect(w.gone).toEqual(['2026-11-02'])
    expect(w.ahead).toEqual(['2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'])
  })

  it('says the range short', () => {
    expect(rangeLabel({ from: '2026-11-01', to: '2026-11-30' })).toMatch(/^1 al 30 (de )?nov/)
  })
})
