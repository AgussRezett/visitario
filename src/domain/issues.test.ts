import { describe, expect, it } from 'vitest'
import { dayTitle, groupIssues, isNewIssue, issueTime, issueWhen, sellerMessage, whatsappLink } from './issues'

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

describe('novedades in sections', () => {
  const longDate = (d: string) => `día ${d}`
  const issue = (id: string, createdAt: string, typeId: number) => ({ id, createdAt, typeId })
  // 25/11 10:00, 24/11 21:30 (in Argentina; 00:30 UTC of the 25th), 23/11.
  const list = [issue('a', '2026-11-25T13:00:00Z', 2), issue('b', '2026-11-25T00:30:00Z', 1), issue('c', '2026-11-23T15:00:00Z', 2)]

  it('by day, in Argentina, with "Hoy" and "Ayer"', () => {
    const groups = groupIssues(list, 'day', { day: (d) => dayTitle(d, '2026-11-25', longDate), type: String })
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([['Hoy', ['a']], ['Ayer', ['b']], ['día 2026-11-23', ['c']]])
  })

  it('by type, in the company order', () => {
    const groups = groupIssues(list, 'type', { day: String, type: (id) => `tipo ${id}` }, [1, 2])
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([['tipo 1', ['b']], ['tipo 2', ['a', 'c']]])
  })

  it('the time, and which are new since the list was last opened', () => {
    expect(issueTime('2026-11-25T13:05:00Z')).toBe('10:05')
    expect(isNewIssue('2026-11-25T13:00:00Z', '2026-11-25T12:00:00Z')).toBe(true)
    expect(isNewIssue('2026-11-25T11:00:00Z', '2026-11-25T12:00:00Z')).toBe(false)
    expect(isNewIssue('2026-11-25T13:00:00Z', null)).toBe(false)
  })
})
