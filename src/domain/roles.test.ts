import { describe, expect, it } from 'vitest'
import { pickActiveRole, type ActiveMembership } from './roles'

const panda: ActiveMembership = { companyId: 'p', companyName: 'Panda', roles: ['admin', 'merchandiser'] }
const sur: ActiveMembership = { companyId: 's', companyName: 'Sur', roles: ['supervisor'] }

describe('pickActiveRole', () => {
  it('prefers field work when nothing is stored', () => {
    expect(pickActiveRole([sur, panda], null)).toEqual({ companyId: 'p', role: 'merchandiser' })
  })
  it('keeps a valid stored choice', () => {
    expect(pickActiveRole([sur, panda], { companyId: 'p', role: 'admin' })).toEqual({ companyId: 'p', role: 'admin' })
  })
  it('ignores a stale stored choice', () => {
    expect(pickActiveRole([sur], { companyId: 'p', role: 'admin' })).toEqual({ companyId: 's', role: 'supervisor' })
  })
  it('returns null without memberships', () => expect(pickActiveRole([], null)).toBeNull())
})
