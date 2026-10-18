import { describe, expect, it } from 'vitest'
import { filterPeople, invitationMessage, lastSeen, membersOf, nextActions, rolesLabel, supervisorsOf, whatsappLink, type CompanyPerson } from './people'

const person = (id: string, first: string, last: string, extra: Partial<CompanyPerson> = {}): CompanyPerson => ({
  membershipId: `m-${id}`, personId: id, firstName: first, lastName: last, roles: ['merchandiser'], teamId: 'north',
  status: 'active', startsOn: '2026-10-01', phoneLast4: '4521', lastActivityAt: null, invitedAt: '2026-10-01T12:00:00Z', shift: null, autoApprove: false, ...extra,
})
const people = [
  person('p1', 'Martín', 'Sosa', { roles: ['supervisor'], phoneLast4: '1020' }),
  person('p2', 'Lucía', 'Gómez', { teamId: 'south', phoneLast4: '0000' }),
  person('p3', 'Sofía', 'Benítez', { status: 'invited' }),
  person('p4', 'Juan', 'Pérez', { status: 'disabled', teamId: null }),
  person('p5', 'Agustín', 'Rezett', { roles: ['admin', 'merchandiser', 'supervisor'] }),
]

describe('people', () => {
  it('roles read in their usual order', () => {
    expect(rolesLabel(['admin', 'merchandiser'])).toBe('Activador · Admin de empresa')
  })

  it('search by name without accents, or by the phone digits', () => {
    expect(filterPeople(people, { query: 'lucia', role: 'all', team: 'all' }).map((p) => p.personId)).toEqual(['p2'])
    expect(filterPeople(people, { query: '1020', role: 'all', team: 'all' }).map((p) => p.personId)).toEqual(['p1'])
  })

  it('filter by role and team; active people first', () => {
    expect(filterPeople(people, { query: '', role: 'supervisor', team: 'all' }).map((p) => p.personId)).toEqual(['p1', 'p5'])
    expect(filterPeople(people, { query: '', role: 'all', team: 'none' }).map((p) => p.personId)).toEqual(['p4'])
    expect(filterPeople(people, { query: '', role: 'all', team: 'north' }).map((p) => p.status)).toEqual(['active', 'active', 'invited'])
  })

  it('a team: its supervisors and its active merchandisers', () => {
    const north = { id: 'north', name: 'Norte', areas: null }
    expect(supervisorsOf(north, people).map((p) => p.personId)).toEqual(['p1', 'p5'])
    expect(membersOf(north, people).map((p) => p.personId)).toEqual(['p5'])
  })

  it('what can be done next', () => {
    expect(nextActions(people[2] as CompanyPerson)).toEqual(['share', 'cancel'])
    expect(nextActions(people[3] as CompanyPerson)).toEqual(['reactivate'])
  })

  it('the invitation goes by WhatsApp with a ready message', () => {
    const text = invitationMessage('Lucas', 'Panda', 'https://visitario.app')
    expect(text).toContain('Panda te sumó a Visitario')
    expect(whatsappLink(text, '+54 9 11 5555-4521')).toMatch(/^https:\/\/wa\.me\/5491155554521\?text=Hola%20Lucas/)
  })

  it('last seen, in words', () => {
    const now = new Date('2026-10-13T15:00:00Z')
    expect(lastSeen(null, now)).toBe('Sin actividad')
    expect(lastSeen('2026-10-13T14:57:00Z', now)).toBe('hace 3 min')
    expect(lastSeen('2026-10-12T14:00:00Z', now)).toBe('ayer')
    expect(lastSeen('2026-08-10T14:00:00Z', now)).toBe('hace 2 meses')
  })
})
