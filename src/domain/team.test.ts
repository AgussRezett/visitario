import { describe, expect, it } from 'vitest'
import { agoText, canRequestFix, memberAlerts, planLabel, teamTotals, type TeamMember } from './team'

const now = new Date('2026-10-16T18:00:00Z')
const base: TeamMember = {
  personId: 'p', firstName: 'Diego', lastName: 'Paz', workdayId: 'w', workdayStatus: 'published',
  total: 15, visited: 5, inProgress: 0, refused: 0, closed: 2, approved: 3, needsFix: 0, toReview: 2,
  lastActivityAt: '2026-10-16T16:50:00Z', lastPlace: 'Olazábal 1550', syncPending: 0, syncFailed: 0, syncPhotos: 0, syncReportedAt: null,
}

describe('memberAlerts', () => {
  it('an hour without activity with stops left is an alert', () => {
    expect(memberAlerts(base, now)[0]).toEqual({ kind: 'inactive', text: 'Sin actividad 1 h 10 min' })
  })
  it('no alert when the day is done or recent', () => {
    expect(memberAlerts({ ...base, visited: 15 }, now)).toEqual([])
    expect(memberAlerts({ ...base, lastActivityAt: '2026-10-16T17:30:00Z' }, now)).toEqual([])
  })
  it('photos not uploaded, refused changes, fixes and not authorized', () => {
    const kinds = memberAlerts({ ...base, lastActivityAt: null, syncPending: 7, syncPhotos: 2, syncFailed: 1, needsFix: 1, refused: 2 }, now)
    expect(kinds.map((a) => a.text)).toEqual(['1 cambio rechazado', '2 fotos sin subir', '1 corrección', '2 no autorizadas'])
  })
})

describe('teamTotals', () => {
  it('adds up the team', () => {
    const t = teamTotals([base, { ...base, total: 10, visited: 10, toReview: 1, syncPending: 3, syncPhotos: 3 }])
    expect(t).toMatchObject({ total: 25, visited: 15, toReview: 3, unsyncedPhotos: 3, unsyncedPeople: 1 })
  })
})

describe('labels', () => {
  it('time since', () => {
    expect(agoText('2026-10-16T17:59:40Z', now)).toBe('recién')
    expect(agoText('2026-10-16T17:48:00Z', now)).toBe('hace 12 min')
    expect(agoText('2026-10-16T16:00:00Z', now)).toBe('hace 2 h')
  })
  it('plan status', () => {
    expect(planLabel({ workdayStatus: null, total: 0 })).toBe('Sin cargar')
    expect(planLabel({ workdayStatus: 'draft', total: 1 })).toBe('1 local · sin publicar')
    expect(planLabel({ workdayStatus: 'published', total: 14 })).toBe('14 locales · publicada')
  })
  it('a fix request needs a comment', () => {
    expect(canRequestFix('  ')).toBe(false)
    expect(canRequestFix('Falta el después')).toBe(true)
  })
})
