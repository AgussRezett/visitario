import { describe, expect, it } from 'vitest'
import { issueWhen, sellerMessage, whatsappLink } from './issues'

const issue = {
  type: 'Necesita pedido', note: '2 cajas de SKYY 750', by: 'Agustín Rezett', when: '06/11 14:30',
  store: { name: 'Autoservicio Lili', address: 'Av. Brasil 3076', area: 'Constitución', customerNumber: '1004' },
}

describe('novedades', () => {
  it('writes the seller a message with the store, what it needs and who saw it', () => {
    expect(sellerMessage(issue, 'Florencia Paz')).toBe([
      'Hola Florencia! Novedad de un cliente tuyo:',
      '*Necesita pedido*',
      '#1004 · Autoservicio Lili · Av. Brasil 3076 (Constitución)',
      'Detalle: 2 cajas de SKYY 750',
      'Lo vio Agustín el 06/11 14:30.',
    ].join('\n'))
  })

  it('without a seller, a note or a number, it still reads well', () => {
    const plain = { ...issue, note: null, store: { name: null, address: 'Moldes 1365', area: null, customerNumber: null } }
    expect(sellerMessage(plain, null)).toBe('Novedad de un cliente:\n*Necesita pedido*\nMoldes 1365\nLo vio Agustín el 06/11 14:30.')
  })

  it('opens WhatsApp with the text', () => {
    expect(whatsappLink('Hola & chau')).toBe('https://wa.me/?text=Hola%20%26%20chau')
  })

  it('says when, in Argentina', () => {
    expect(issueWhen('2026-11-06T17:30:00Z')).toBe('06/11 14:30')
  })
})
