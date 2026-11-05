import { pick } from './support/select'
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
  await expect(which).toHaveAttribute('data-value', '1') // "Florencia Se" is Florencia Sereno
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
  await expect(page.getByLabel('¿Ya está cargado como vendedor?')).toHaveAttribute('data-value', '')
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
  await pick(sheet.getByLabel('Unir con'), 'Florencia Sereno · con usuario')
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

test('a seller loaded by mistake (no user, no stores) is deleted from the catalog; one with stores is not', async ({ page }) => {
  const s = state({ catalogs: { seller: [...sellers(), { id: 4, name: 'Mirko', active: true, person_id: null }] }, sellerStores: { 1: 3 } })
  await installFakeSupabase(page, s, 'admin')
  await page.goto('/s/catalogs')

  // With stores: it says why, and what to do instead.
  await page.getByRole('button', { name: 'Editar Florencia Se', exact: true }).click()
  let sheet = page.getByRole('dialog', { name: 'Editar Florencia Se' })
  await sheet.getByRole('button', { name: 'Eliminar vendedor' }).click()
  await page.getByRole('alertdialog', { name: '¿Eliminar a «Florencia Se»?' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(sheet.getByText('Tiene 3 comercios (contando los archivados): unilo con otro vendedor o desactivalo.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancelar' }).click()

  // With a user: no delete at all.
  await page.getByRole('button', { name: 'Editar Joaquin Pr', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Editar Joaquin Pr' }).getByRole('button', { name: 'Eliminar vendedor' })).toHaveCount(0)
  await page.getByRole('dialog', { name: 'Editar Joaquin Pr' }).getByRole('button', { name: 'Cancelar' }).click()

  // Nothing depends on it: gone.
  await page.getByRole('button', { name: 'Editar Mirko', exact: true }).click()
  sheet = page.getByRole('dialog', { name: 'Editar Mirko' })
  await sheet.getByRole('button', { name: 'Eliminar vendedor' }).click()
  await page.getByRole('alertdialog', { name: '¿Eliminar a «Mirko»?' }).getByRole('button', { name: 'Eliminar' }).click()
  await expect(sheet).toHaveCount(0)
  await expect.poll(() => s.catalogs?.seller?.map((x) => x.name)).toEqual(['Florencia Se', 'Joaquin Pr', 'Florencia Sereno'])
  await expect(page.getByRole('button', { name: 'Editar Mirko', exact: true })).toHaveCount(0)
})
