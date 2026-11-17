import { describe, expect, it } from 'vitest'
import { monthShare, quotaLeft, quotaText, renewsOn } from './ai-quota'

const q = (monthUsed: number, monthLimit: number, myToday: number, myDailyLimit: number | null) => ({ monthUsed, monthLimit, myToday, myDailyLimit })

describe('what is left of the AI', () => {
  it('the closer limit wins: my day or the company month', () => {
    expect(quotaLeft(q(10, 1000, 5, 30))).toEqual({ left: 25, by: 'day' })
    expect(quotaLeft(q(990, 1000, 5, 30))).toEqual({ left: 10, by: 'month' })
    expect(quotaLeft(q(10, 1000, 5, null))).toEqual({ left: 990, by: 'month' })
    expect(quotaLeft(q(0, 0, 0, 30))).toEqual({ left: 0, by: 'plan' })
  })

  it('says it in one line', () => {
    expect(quotaText(q(10, 1000, 29, 30))).toBe('Te queda 1 uso de IA hoy.')
    expect(quotaText(q(10, 1000, 5, 30))).toBe('Te quedan 25 usos de IA hoy.')
    expect(quotaText(q(995, 1000, 0, null))).toBe('Quedan 5 usos de IA este mes en tu empresa.')
    expect(quotaText(q(10, 1000, 30, 30))).toBe('Ya usaste la IA todo lo permitido por hoy: mañana se renueva.')
    expect(quotaText(q(1000, 1000, 0, 30))).toBe('Tu empresa usó toda la IA del mes: se renueva el 1.')
    expect(quotaText(q(0, 0, 0, 30))).toBe('La lectura con IA no está incluida en el plan de tu empresa.')
  })

  it('the month as a share, and when it comes back', () => {
    expect(monthShare(37, 1000)).toBe(4)
    expect(monthShare(1200, 1000)).toBe(100)
    expect(monthShare(0, 0)).toBe(100)
    expect(renewsOn('2026-11-16')).toBe('1 de diciembre')
    expect(renewsOn('2026-12-31')).toBe('1 de enero')
  })
})
