import { expect, test, type Page } from '@playwright/test'
import { installFakeSupabase, type FakeState, type Row } from './support/fake-supabase'

const TOKEN = 'tok-1-0123456789abcdef0123456789abcdef'
const preview = (extra: Row = {}): Row => ({
  state: 'pending', company: 'Panda', inviter: 'Carla López', roles: ['merchandiser'], email: 'nora@example.com',
  expires_at: new Date(Date.now() + 42 * 60_000).toISOString(), dni_end: '333', has_account: false, ...extra,
})
const day = (invite: FakeState['invite']): FakeState => ({ workday: null, visits: [], uploads: [], invite })

/** Opens the link as someone who is not signed in. */
async function signedOut(page: Page) {
  await page.addInitScript(() => localStorage.setItem('e2e.noSession', '1'))
}

test('new to Visitario: from the email, create the account and accept', async ({ page }, info) => {
  const state = day({ preview: preview() })
  await signedOut(page)
  await installFakeSupabase(page, state)
  await page.goto(`/invitacion/${TOKEN}`)
  await expect(page.getByRole('heading', { name: 'Carla López te invitó a Panda' })).toBeVisible()
  await expect(page.getByText(/El enlace vence en (41|42) min/)).toBeVisible()
  await expect(page.getByLabel('Email')).toHaveValue('nora@example.com')
  await page.screenshot({ path: `test-results/invitation-new-${info.project.name}.png`, fullPage: true })

  const create = page.getByRole('button', { name: 'Crear cuenta y seguir' })
  await page.getByLabel('Creá una contraseña').fill('corta')
  await expect(create).toBeDisabled()
  await page.getByLabel('Creá una contraseña').fill('una-clave-segura')
  await create.click()
  await expect.poll(() => state.invite?.signups?.[0]).toMatchObject({ token: TOKEN, password: 'una-clave-segura' })

  // Signed in: back to the invitation (the profile is already complete in this fake)
  await expect(page).toHaveURL(new RegExp(`/invitacion/${TOKEN}$`))
  await expect(page.getByText('Entraste como Agustín Rezett')).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar y sumarme' }).click()
  await expect(page.getByRole('heading', { name: '¡Listo! Ya sos parte de Panda' })).toBeVisible()
  expect(state.invite?.accepted?.[0]).toMatchObject({ p_token: TOKEN, p_accept: true })
  await page.screenshot({ path: `test-results/invitation-done-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Empezar' }).click()
  await expect(page).toHaveURL(/\/s\/workday$/)
})

test('already has an account: sign in and come back to accept', async ({ page }) => {
  await signedOut(page)
  await installFakeSupabase(page, day({ preview: preview({ has_account: true }) }))
  await page.goto(`/invitacion/${TOKEN}`)
  await expect(page.getByText('Ya tenés cuenta en Visitario')).toBeVisible()
  await page.getByRole('link', { name: 'Entrar para aceptar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('después volvés a la invitación para aceptarla')).toBeVisible()
})

test('signed in without a profile: complete it first', async ({ page }) => {
  await installFakeSupabase(page, day({ preview: preview(), noPerson: true }))
  await page.goto(`/invitacion/${TOKEN}`)
  await expect(page.getByRole('link', { name: 'Completar mis datos' })).toHaveAttribute('href', '/onboarding')
})

test('another DNI: it says so and offers to switch account', async ({ page }) => {
  await installFakeSupabase(page, day({ preview: preview(), acceptError: 'This invitation is for another DNI' }))
  await page.goto(`/invitacion/${TOKEN}`)
  await page.getByRole('button', { name: 'Aceptar y sumarme' }).click()
  await expect(page.getByText('Esta invitación es para otro DNI.')).toBeVisible()
  await expect(page.getByText('Salí y entrá con la de DNI terminado en 333.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Salir y entrar con otra cuenta' })).toBeVisible()
})

test('declining says it plainly', async ({ page }) => {
  const state = day({ preview: preview() })
  await installFakeSupabase(page, state)
  await page.goto(`/invitacion/${TOKEN}`)
  await page.getByRole('button', { name: 'Rechazar' }).click()
  await expect(page.getByRole('heading', { name: 'Rechazaste la invitación' })).toBeVisible()
  expect(state.invite?.accepted?.[0]).toMatchObject({ p_accept: false })
})

for (const [state, heading] of [
  ['invalid', 'Este enlace no es válido'],
  ['expired', 'La invitación venció'],
  ['canceled', 'La invitación fue cancelada'],
  ['accepted', 'Esta invitación ya se usó'],
] as const) {
  test(`a link that is ${state} says what happened`, async ({ page }, info) => {
    await signedOut(page)
    await installFakeSupabase(page, day({ preview: state === 'invalid' ? { state } : preview({ state }) }))
    await page.goto(`/invitacion/${TOKEN}`)
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir a Visitario' })).toBeVisible()
    if (state === 'expired') {
      await expect(page.getByText('Pedile a Carla López que te la reenvíe')).toBeVisible()
      await page.screenshot({ path: `test-results/invitation-expired-${info.project.name}.png`, fullPage: true })
    }
  })
}

test('the profile shows invitations for my DNI, also without the email', async ({ page }) => {
  const state = day({ mine: [{ id: 'i9', company: 'Distribuidora Sur', roles: ['supervisor'], starts_on: '2026-10-20', expires_at: new Date(Date.now() + 30 * 60_000).toISOString(), inviter: 'Beto Ruiz' }] })
  await installFakeSupabase(page, state)
  await page.goto('/profile')
  await expect(page.getByText('Beto Ruiz te invitó a Distribuidora Sur')).toBeVisible()
  await expect(page.getByText(/La invitación vence en (29|30) min/)).toBeVisible()
  await page.getByRole('button', { name: 'Aceptar' }).click()
  await expect.poll(() => state.invite?.accepted?.[0]).toMatchObject({ p_invitation: 'i9', p_accept: true })
})
