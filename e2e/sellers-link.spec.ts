import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState } from './support/fake-supabase'

const admin = () => [{ id: 'm1', company_id: 'c1', roles: ['admin'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const sellers = () => [
  { id: 1, name: 'Florencia Se', active: true, person_id: null },
  { id: 2, name: 'Joaquin Pr', active: true, person_id: 'p7' },
  { id: 3, name: 'Florencia Sereno', active: true, person_id: 'p9' },
]
const state = (extra: Partial<FakeState> = {}): FakeState => ({
  workday: null, visits: [], uploads: [], memberships: admin(), teams: [], members: [], catalogs: { seller: sellers() }, ...extra,
})

test('inviting a seller the activadores already loaded by name: it is suggested, and goes with the invitation', async ({ page }, info) => {
  const s = state({ catalogs: { seller: sellers().filter((x) => x.id !== 3) }, dnis: { '38112904': { person_id: 'p9', first_name: 'Florencia', last_name: 'Sereno', phone_last4: '7782', is_member: false } } })
  await installFakeSupabase(page, s, 'admin')
  await page.goto('/s/users/new')
  await page.getByLabel('DNI', { exact: true }).fill('38.112.904')
  await page.getByRole('button', { name: 'Ver si ya usa Visitario' }).click()
  await expect(page.getByText('Ya tiene perfil en Visitario')).toBeVisible()
  await page.getByLabel('Email').fill('flor@panda.com')
  await page.getByRole('radio', { name: /Vendedor/ }).click()
  const which = page.getByLabel('¿Ya está cargado como vendedor?')
  await expect(which).toHaveValue('1') // "Florencia Se" is Florencia Sereno
  await expect(page.getByText('Lo sugerimos por el nombre: Florencia Se.')).toBeVisible()
  await expect(which.getByRole('option', { name: 'Joaquin Pr' })).toHaveCount(0) // already has a user
  await page.screenshot({ path: `test-results/invite-seller-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Invitar a Florencia' }).click()
  await expect.poll(() => s.invite?.created?.[0]).toMatchObject({ roles: ['seller'], sellerId: 1 })
})

test('a new seller goes without one', async ({ page }) => {
  const s = state()
  await installFakeSupabase(page, s, 'admin')
  await page.goto('/s/users/new')
  await page.getByLabel('DNI', { exact: true }).fill('40555666')
  await page.getByLabel('Email').fill('nuevo@panda.com')
  await page.getByRole('radio', { name: /Vendedor/ }).click()
  await expect(page.getByLabel('¿Ya está cargado como vendedor?')).toHaveValue('')
  await page.getByRole('button', { name: 'Mandar invitación' }).click()
  await expect.poll(() => s.invite?.created?.[0]).toMatchObject({ roles: ['seller'], sellerId: null })
})

test('the same seller loaded twice is merged from the catalog, asking first', async ({ page }, info) => {
  const s = state()
  await installFakeSupabase(page, s, 'admin')
  await page.goto('/s/catalogs')
  await page.getByRole('button', { name: 'Editar Florencia Se', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Editar Florencia Se' })
  await expect(sheet.getByText('¿Está repetido?')).toBeVisible()
  await sheet.getByLabel('Unir con').selectOption({ label: 'Florencia Sereno · con usuario' })
  await page.screenshot({ path: `test-results/seller-merge-${info.project.name}.png`, fullPage: true })
  await sheet.getByRole('button', { name: 'Unir' }).click()
  const ask = page.getByRole('alertdialog', { name: '¿Unir «Florencia Se» con «Florencia Sereno»?' })
  await ask.getByRole('button', { name: 'Cancelar' }).click()
  expect(s.sellerMerges ?? []).toEqual([])
  await sheet.getByRole('button', { name: 'Unir' }).click()
  await ask.getByRole('button', { name: 'Unir' }).click()
  await expect.poll(() => s.sellerMerges).toEqual([{ keep: 3, drop: 1 }])
  await expect(sheet).toHaveCount(0)

  // Two with a user are not offered to each other.
  await page.getByRole('button', { name: 'Editar Joaquin Pr', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Editar Joaquin Pr' }).getByLabel('Unir con').getByRole('option', { name: /Florencia Sereno/ })).toHaveCount(0)
})
