import { describe, expect, it } from 'vitest'
import { fillTemplate } from './templates'

describe('fillTemplate', () => {
  it('a line whose data are empty is left out', () => {
    expect(fillTemplate('Fecha: {date}\nNum clte: {customer_number}\nNota fija', { date: '09/10/2026' })).toBe('Fecha: 09/10/2026\nNota fija')
    expect(fillTemplate('{store_name} · {address}', { address: 'Moldes 1365' })).toBe('· Moldes 1365')
  })
  it('takes the Spanish names the admin types', () => {
    expect(fillTemplate('Fecha: {fecha}\nDireccion: {direccion}\nZona: {zona}', { date: '09/10', address: 'Tres Arroyos 762', area: '' })).toBe('Fecha: 09/10\nDireccion: Tres Arroyos 762')
  })
  it('a placeholder in capitals gives the value in capitals', () => {
    const body = 'FECHA DE EJECUCION: {fecha_corta}\nCANAL: {CANAL}\nCLIENTE: {nro_cliente}\nRESPONSABLE: {RESPONSABLE}\nZona: {Zona}'
    expect(fillTemplate(body, { short_date: '19/10', channel: 'Autoservicio', customer_number: '1462', seller: 'Florencia', area: 'Caballito' })).toBe(
      'FECHA DE EJECUCION: 19/10\nCANAL: AUTOSERVICIO\nCLIENTE: 1462\nRESPONSABLE: FLORENCIA\nZona: Caballito',
    )
  })
  it('keeps the WhatsApp format of the company template', () => {
    const body = '*ACTIVACIÓN DE GONDOLA ANTES\nFecha: {date}\nDireccion: {address}\nNum clte: {customer_number}\nZona: {area}'
    expect(fillTemplate(body, { date: '09/10/2026', address: 'Tres Arroyos 762', customer_number: '12345', area: 'Paternal' })).toBe(
      '*ACTIVACIÓN DE GONDOLA ANTES\nFecha: 09/10/2026\nDireccion: Tres Arroyos 762\nNum clte: 12345\nZona: Paternal',
    )
  })
})
