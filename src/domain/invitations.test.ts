import { describe, expect, it } from 'vitest'
import { inviteError, inviteMessage, sendErrorText, inviteState, rolesPhrase, timeLeft, toLinkPreview } from './invitations'

const now = new Date('2026-10-18T22:00:00Z')
const at = (min: number) => new Date(now.getTime() + min * 60_000).toISOString()

describe('invitations', () => {
  it('an invitation is sent, failed or expired', () => {
    expect(inviteState({ expiresAt: at(30), sentAt: at(-30), sendError: null }, now)).toBe('sent')
    expect(inviteState({ expiresAt: at(30), sentAt: null, sendError: 'not_configured' }, now)).toBe('failed')
    expect(inviteState({ expiresAt: at(30), sentAt: null, sendError: null }, now)).toBe('sending')
    expect(inviteState({ expiresAt: at(-1), sentAt: at(-61), sendError: null }, now)).toBe('expired')
    expect(inviteState({ expiresAt: at(-1), sentAt: null, sendError: 'x' }, now)).toBe('expired')
  })

  it('time left, as people say it', () => {
    expect(timeLeft(at(42), now)).toBe('vence en 42 min')
    expect(timeLeft(at(-5), now)).toBe('venció hace 5 min')
    expect(timeLeft(at(-180), now)).toBe('venció hace 3 h')
    expect(timeLeft(at(-3 * 1440), now)).toBe('venció hace 3 días')
  })

  it('roles and the WhatsApp message', () => {
    expect(rolesPhrase(['merchandiser', 'supervisor'])).toBe('activador y supervisor')
    expect(inviteMessage('Panda', 'https://x/invitacion/abc')).toContain('https://x/invitacion/abc')
  })

  it('reads the link preview defensively', () => {
    expect(toLinkPreview({ state: 'pending', company: 'Panda', inviter: 'Carla López', roles: ['merchandiser'], email: 'n@x.com', expires_at: at(40), dni_end: '333', has_account: false }))
      .toMatchObject({ state: 'pending', company: 'Panda', dniEnd: '333', hasAccount: false })
    expect(toLinkPreview({ state: 'weird' }).state).toBe('invalid')
    expect(toLinkPreview(null).state).toBe('invalid')
  })

  it('why the email did not go out', () => {
    expect(sendErrorText('not_configured')).toMatch(/no está configurado/)
    expect(sendErrorText('rejected')).toMatch(/Gmail no aceptó/)
    expect(sendErrorText('unreachable')).toMatch(/conectar con Gmail/)
    expect(sendErrorText(null)).toBe('')
  })

  it('errors in Spanish', () => {
    expect(inviteError('This invitation is for another email')).toBe('Esta invitación es para otro email.')
    expect(inviteError('Already a member of this company')).toMatch(/ya es parte/)
    expect(inviteError('email_taken')).toMatch(/ya tiene cuenta/)
    expect(inviteError('boom')).toBe('No se pudo completar. Probá de nuevo.')
  })
})
