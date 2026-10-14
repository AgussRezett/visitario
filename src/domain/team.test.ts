import { describe, expect, it } from 'vitest'
import { agoText, canRequestFix, lastActivityText, memberAlerts, planLabel, shiftLabel, shiftPhase, teamTotals, type TeamMember } from './team'

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

describe('working hours', () => {
  const shift = { start: '09:00', end: '14:00' }
  const at = (hhmm: string, day = '2026-10-16') => new Date(`${day}T${hhmm}:00-03:00`)

  it('before, during and after the hours; other days as a whole', () => {
    expect(shiftPhase(shift, at('08:40'))).toBe('before')
    expect(shiftPhase(shift, at('11:00'))).toBe('during')
    expect(shiftPhase(shift, at('14:00'))).toBe('after')
    expect(shiftPhase(shift, at('11:00'), '2026-10-15')).toBe('after')
    expect(shiftLabel({ start: '09:00:00', end: '14:30:00' })).toBe('9:00 a 14:30')
  })

  it('no inactivity alert outside the hours, even with stops left', () => {
    const yesterday = { ...base, lastActivityAt: '2026-10-15T16:40:00Z' } // 13:40 the day before
    expect(memberAlerts(yesterday, at('23:00'), shift)).toEqual([])
    expect(memberAlerts(yesterday, at('08:30'), shift)).toEqual([])
    expect(memberAlerts(base, at('20:00'), shift)).toEqual([])
  })

  it('inside the hours it counts from the start or the last activity, whichever is later', () => {
    const yesterday = { ...base, lastActivityAt: '2026-10-15T16:40:00Z' }
    expect(memberAlerts(yesterday, at('09:30'), shift)).toEqual([])
    expect(memberAlerts(yesterday, at('10:15'), shift)[0]).toEqual({ kind: 'inactive', text: 'Sin actividad desde las 9:00' })
    expect(memberAlerts({ ...base, lastActivityAt: at('10:00').toISOString() }, at('11:20'), shift)[0]).toEqual({ kind: 'inactive', text: 'Sin actividad 1 h 20 min' })
  })

  it('the last activity in words: how long ago while working, the time once the day is over', () => {
    expect(lastActivityText(at('13:40').toISOString(), at('13:52'), shift)).toBe('hace 12 min')
    expect(lastActivityText(at('13:40').toISOString(), at('23:00'), shift)).toBe('a las 13:40')
    expect(lastActivityText(at('13:40', '2026-10-15').toISOString(), at('08:00'), shift)).toBe('ayer 13:40')
    expect(lastActivityText(null, at('08:00'), shift)).toBe('Sin actividad')
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
