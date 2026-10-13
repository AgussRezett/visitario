import { describe, expect, it } from 'vitest'
import { formatAmount, formatBytes, planNotice, toCsv, type Subscription } from './company'

const sub = (extra: Partial<Subscription> = {}): Subscription => ({
  plan: 'pilot', status: 'active', endsOn: null, nextBillingOn: null, autoDebit: false, paymentMethod: null, estimatedAmountCents: null, currency: 'ARS', ...extra,
})

describe('company', () => {
  it('storage as people read it', () => {
    expect(formatBytes(2_100_000_000)).toBe('2,1 GB')
    expect(formatBytes(830_000_000)).toBe('830 MB')
    expect(formatBytes(0)).toBe('0 B')
  })

  it('the price, or "A definir" while there is none', () => {
    expect(formatAmount(null, 'ARS')).toBe('A definir')
    expect(formatAmount(4_500_000, 'ARS')).toMatch(/45\.000/)
  })

  it('what happens next with the plan', () => {
    expect(planNotice(sub())).toBeNull()
    expect(planNotice(sub({ endsOn: '2026-11-30' }))?.title).toBe('El piloto termina el 30/11/2026')
    expect(planNotice(sub({ status: 'expired' }))?.tone).toBe('error')
  })

  it('CSV for Excel in Spanish', () => {
    expect(toCsv(['Comercio', 'Notas'], [['Mas Ahorro', 'Faltó "SKYY"; volver'], ['Lili', null]])).toBe('﻿Comercio;Notas\r\nMas Ahorro;"Faltó ""SKYY""; volver"\r\nLili;')
  })
})
