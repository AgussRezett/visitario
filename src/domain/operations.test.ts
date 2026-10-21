import { describe, expect, it } from 'vitest'
import { doingText, myOperation, sharedRepeats, namesList, operationTitle, othersAt, toOperations, worksIn } from './operations'

const raw = (id: string, extra: Record<string, unknown> = {}) => ({
  id, workday_id: `w-${id}`, host_id: 'agus', name: null, created_by: 'agus', created_at: '2026-10-21T13:00:00Z', ended_at: null, workday_status: 'published',
  members: [
    { person_id: 'agus', first_name: 'Agustín', last_name: 'Rezett', left_at: null, workday_id: `w-${id}` },
    { person_id: 'lucia', first_name: 'Lucía', last_name: 'Gómez', left_at: null, workday_id: 'w-l' },
    { person_id: 'diego', first_name: 'Diego', last_name: 'Paz', left_at: null, workday_id: 'w-d' },
  ],
  total: 8, visited: '3', in_progress: 1, ...extra,
})

describe('operations', () => {
  it('reads the day’s operativos defensively', () => {
    const [o] = toOperations([raw('o1'), { nope: true }, null])
    expect(o).toMatchObject({ id: 'o1', workdayId: 'w-o1', visited: 3, members: [{ personId: 'agus' }, { personId: 'lucia' }, { personId: 'diego' }] })
    expect(toOperations('x')).toEqual([])
  })

  it('finds mine: the open one first, else the last I was in', () => {
    const ended = toOperations([raw('old', { ended_at: '2026-10-21T15:00:00Z' })])[0]
    const open = toOperations([raw('new')])[0]
    if (!ended || !open) throw new Error('fixtures')
    expect(myOperation([ended, open], 'lucia')?.id).toBe('new')
    expect(myOperation([ended], 'lucia')?.id).toBe('old')
    expect(myOperation([open], 'nora')).toBeNull()
    expect(worksIn(open, 'lucia')).toBe(true)
    expect(worksIn(ended, 'lucia')).toBe(false)
    const left = toOperations([raw('l', { members: [{ person_id: 'lucia', first_name: 'Lucía', left_at: '2026-10-21T14:00:00Z', workday_id: 'w' }] })])[0]
    expect(worksIn(left ?? null, 'lucia')).toBe(false)
  })

  it('names it by who I am with', () => {
    const [o] = toOperations([raw('o1')])
    if (!o) throw new Error('fixture')
    expect(operationTitle(o, 'agus')).toBe('Operativo con Lucía y Diego')
    expect(operationTitle({ ...o, name: 'Coto Cabildo' }, 'agus')).toBe('Coto Cabildo')
    expect(namesList(['Lucía', 'Diego', 'Ana'])).toBe('Lucía, Diego y Ana')
    expect(namesList([])).toBe('')
  })

  it('who else is at a store, and what each one is doing', () => {
    const presence = [
      { personId: 'agus', firstName: 'Agustín', visitId: 'v1', storeId: 's1', lat: null, lng: null, at: 1 },
      { personId: 'lucia', firstName: 'Lucía', visitId: 'v1', storeId: 's1', lat: null, lng: null, at: 1 },
      { personId: 'diego', firstName: 'Diego', visitId: null, storeId: null, lat: null, lng: null, at: 1 },
    ]
    expect(othersAt(presence, 's1', 'agus').map((p) => p.firstName)).toEqual(['Lucía'])
    const place = (id: string) => (id === 's1' ? 'Cabildo 2280' : null)
    expect(doingText(presence[1] as (typeof presence)[number], place)).toBe('en Cabildo 2280')
    expect(doingText(presence[2] as (typeof presence)[number], place)).toBe('recorriendo')
  })
})

describe('team sums', () => {
  it('a shared visit counts once in the team, however many members are in view', () => {
    const [o] = toOperations([raw('o1', { refused: 1, closed: 0, approved: 2, needs_fix: 1, metrics: { 3: 10 } })])
    if (!o) throw new Error('fixture')
    expect(sharedRepeats([o], ['agus', 'lucia', 'diego'])).toMatchObject({ total: 16, visited: 6, approved: 4, metrics: { 3: 20 } })
    expect(sharedRepeats([o], ['lucia'])).toMatchObject({ total: 0 })
    expect(sharedRepeats([o], ['lucia', 'nora', 'diego'])).toMatchObject({ total: 8, needsFix: 1 })
  })
})
