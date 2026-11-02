import { describe, expect, it } from 'vitest'
import { canRecord, canReopen, canRemoveVisit, canTransition, finishCheck, isVisited, staleSoon, stopTone, workdayProgress } from './visit'

describe('visit rules', () => {
  it('mirrors the database transitions', () => {
    expect(canTransition('pending', 'in_progress')).toBe(true)
    expect(canTransition('pending', 'done')).toBe(false)
    expect(canTransition('closed', 'in_progress')).toBe(true)
    expect(canTransition('refused', 'in_progress')).toBe(true) // undoing a not-authorized visit
    expect(canTransition('refused', 'done')).toBe(false)
  })

  it('closed and not authorized count as visited', () => {
    expect(['done', 'refused', 'closed', 'pending', 'in_progress'].map((s) => isVisited(s as never))).toEqual([true, true, true, false, false])
  })

  it('cannot finish without the storefront photo and the store’s answer', () => {
    const r = finishCheck({ workStatus: 'in_progress', consent: null, hasStorefront: false, displays: [] })
    expect(r.ok).toBe(false)
    expect(r.blockers).toEqual(['storefront', 'consent'])
  })

  it('finishing with unarranged displays is allowed and reports them', () => {
    const r = finishCheck({ workStatus: 'in_progress', consent: 'with_objection', hasStorefront: true, displays: [{ arranged: true }, { arranged: false }, { arranged: false }] })
    expect(r).toMatchObject({ ok: true, unarranged: 2, target: 'done' })
  })

  it('a closed store ends as closed and does not count displays', () => {
    const r = finishCheck({ workStatus: 'in_progress', consent: 'closed', hasStorefront: true, displays: [{ arranged: false }] })
    expect(r).toMatchObject({ ok: true, unarranged: 0, target: 'closed' })
  })

  it('counts the workday progress', () => {
    const p = workdayProgress([
      { workStatus: 'done', reviewStatus: 'approved' },
      { workStatus: 'done', reviewStatus: 'unreviewed' },
      { workStatus: 'closed', reviewStatus: 'unreviewed' },
      { workStatus: 'pending', reviewStatus: 'unreviewed' },
    ])
    expect(p).toMatchObject({ total: 4, visited: 3, percent: 75, approved: 1, done: 1, closed: 1 })
  })
})

describe('canRemoveVisit', () => {
  it('own and resumed stops can be removed; assigned and approved ones cannot', () => {
    expect(canRemoveVisit({ addedByMe: true, resumedFrom: null, reviewStatus: 'unreviewed' })).toBe(true)
    expect(canRemoveVisit({ addedByMe: false, resumedFrom: 'v0', reviewStatus: 'needs_fix' })).toBe(true)
    expect(canRemoveVisit({ addedByMe: false, resumedFrom: null, reviewStatus: 'unreviewed' })).toBe(false)
    expect(canRemoveVisit({ addedByMe: true, resumedFrom: null, reviewStatus: 'approved' })).toBe(false)
  })
})

describe('stopTone', () => {
  it('uses the colors of the status chips, review first', () => {
    expect(stopTone('pending')).toBe('pending')
    expect(stopTone('in_progress')).toBe('active')
    expect(stopTone('done')).toBe('done')
    expect(stopTone('closed')).toBe('closed')
    expect(stopTone('refused')).toBe('refused')
    expect(stopTone('done', 'approved')).toBe('approved')
    expect(stopTone('done', 'needs_fix')).toBe('fix')
  })
})

describe('staleSoon', () => {
  const arrived = '2026-10-23T12:00:00Z'
  const at = (iso: string) => new Date(iso).getTime()
  it('warns in the last 2 of the 12 hours an in-progress visit has', () => {
    expect(staleSoon({ workStatus: 'in_progress', arrivedAt: arrived }, at('2026-10-23T21:59:00Z'))).toBeNull()
    expect(staleSoon({ workStatus: 'in_progress', arrivedAt: arrived }, at('2026-10-23T22:00:00Z'))).toBe('2026-10-24T00:00:00.000Z')
  })
  it('only for visits in progress', () => {
    expect(staleSoon({ workStatus: 'done', arrivedAt: arrived }, at('2026-10-23T23:00:00Z'))).toBeNull()
    expect(staleSoon({ workStatus: 'in_progress', arrivedAt: null })).toBeNull()
  })
})

describe('canRecord', () => {
  it('records photos, displays and notes when the store said yes or no; a closed store has nothing to record', () => {
    expect(canRecord('yes')).toBe(true)
    expect(canRecord('with_objection')).toBe(true)
    expect(canRecord('refused')).toBe(true)
    expect(canRecord('closed')).toBe(false)
    expect(canRecord(null)).toBe(false)
  })

  it('a refused visit still finishes without displays left to resume', () => {
    const c = finishCheck({ workStatus: 'in_progress', consent: 'refused', hasStorefront: true, displays: [{ arranged: false }] })
    expect(c).toMatchObject({ ok: true, unarranged: 0, target: 'refused' })
  })
})

describe('canReopen', () => {
  it('undoes done or not authorized, also when approved on its own; never once a supervisor approved it', () => {
    expect(canReopen({ workStatus: 'done', reviewStatus: 'unreviewed' })).toBe(true)
    expect(canReopen({ workStatus: 'refused', reviewStatus: 'approved', autoApproved: true })).toBe(true)
    expect(canReopen({ workStatus: 'done', reviewStatus: 'approved', autoApproved: false })).toBe(false)
    expect(canReopen({ workStatus: 'closed', reviewStatus: 'unreviewed' })).toBe(false)
    expect(canReopen({ workStatus: 'in_progress', reviewStatus: 'unreviewed' })).toBe(false)
  })
})
