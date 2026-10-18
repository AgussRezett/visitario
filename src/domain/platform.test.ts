import { describe, expect, it } from 'vitest'
import { companyLine, formatUsd, peopleLabel, platformError, supportOpen, toSupportSnapshot, type PlatformCompany } from './platform'

const panda: PlatformCompany = {
  id: 'c1', name: 'Panda', kind: 'distributor', createdAt: '2026-10-01', plan: 'pilot', status: 'active', endsOn: null,
  members: 8, invited: 1, admins: 'Carla López', visits30d: 120, lastActivityAt: null, photos: 300, photoBytes: 2_100_000_000,
  aiCaptures: 104, aiCostThousandths: 210, supportUntil: null,
}

describe('platform', () => {
  it('money and people as they are read', () => {
    expect(formatUsd(210)).toBe('USD 0,21')
    expect(formatUsd(0)).toBe('USD 0,00')
    expect(peopleLabel({ members: 1, invited: 0 })).toBe('1 usuario')
    expect(peopleLabel({ members: 8, invited: 2 })).toBe('8 usuarios · 2 invitados')
    expect(companyLine(panda, 'Distribuidora')).toBe('Distribuidora · Piloto · 8 usuarios · 1 invitado · 2,1 GB')
  })

  it('a support session counts while it lasts', () => {
    const now = new Date('2026-10-18T20:00:00Z')
    expect(supportOpen({ supportUntil: '2026-10-18T21:00:00Z' }, now)).toBe(true)
    expect(supportOpen({ supportUntil: '2026-10-18T19:00:00Z' }, now)).toBe(false)
    expect(supportOpen({ supportUntil: null }, now)).toBe(false)
  })

  it('database errors in Spanish', () => {
    expect(platformError('A company with that name already exists')).toMatch(/Ya hay una empresa/)
    expect(platformError('A new DNI needs first name, last name and phone')).toMatch(/nombre, apellido y celular/)
    expect(platformError('Say why, in at least 10 characters')).toMatch(/10 caracteres/)
    expect(platformError('boom')).toBe('No se pudo guardar. Probá de nuevo.')
  })

  it('reads the support snapshot defensively', () => {
    const s = toSupportSnapshot({
      company: { name: 'Panda' },
      members: [{ name: 'Lucía Gómez', roles: ['merchandiser'], status: 'active', team: 'Norte', sync_pending: 3, sync_failed: null }],
      teams: ['Norte', 7],
      days: [{ date: '2026-10-18', visits: 15, finished: '9', approved: 2, photos: 30 }],
      catalogs: { brands: 5, display_types: 6, stores: '120' },
      sessions: [{ reason: 'No ve sus visitas', starts_at: 'a', ends_at: 'b', by: 'Agustín Rezett' }],
    })
    expect(s.name).toBe('Panda')
    expect(s.members[0]).toMatchObject({ name: 'Lucía Gómez', team: 'Norte', syncPending: 3, syncFailed: null })
    expect(s.teams).toEqual(['Norte'])
    expect(s.days[0]?.finished).toBe(9)
    expect(s.catalogs).toEqual({ brands: 5, displayTypes: 6, stores: 120 })
    expect(toSupportSnapshot(null).members).toEqual([])
  })
})
