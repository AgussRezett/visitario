import { describe, expect, it } from 'vitest'
import { fillTemplate } from './templates'

describe('fillTemplate', () => {
  it('fills placeholders and leaves unknown ones empty', () => {
    expect(fillTemplate('Fecha: {date}\nNum clte: {customer_number}', { date: '09/10/2026' })).toBe('Fecha: 09/10/2026\nNum clte:')
  })
  it('keeps the WhatsApp format of the company template', () => {
    const body = '*ACTIVACIÓN DE GONDOLA ANTES\nFecha: {date}\nDireccion: {address}\nNum clte: {customer_number}\nZona: {area}'
    expect(fillTemplate(body, { date: '09/10/2026', address: 'Tres Arroyos 762', customer_number: '12345', area: 'Paternal' })).toBe(
      '*ACTIVACIÓN DE GONDOLA ANTES\nFecha: 09/10/2026\nDireccion: Tres Arroyos 762\nNum clte: 12345\nZona: Paternal',
    )
  })
})
