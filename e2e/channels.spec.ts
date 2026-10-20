import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const as = (roles: string[]) => [{ id: 'm1', company_id: 'c1', roles, status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const catalogs = () => ({
  display_type: [{ id: 1, name: 'Puntera', active: true }],
  channel: [
    { id: 10, name: 'Autoservicio', active: true, sort_order: 1 },
    { id: 11, name: 'Drugstore / Kiosco / Kiosco ventana', active: true, sort_order: 3 },
  ],
  seller: [
    { id: 1, name: 'Florencia', active: true, person_id: null },
    { id: 2, name: 'Martín Sosa', active: true, person_id: 'p9' },
  ],
})

test('pasting stores: @ offers the sellers and # the channels, and the store keeps them', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], memberships: as(['supervisor']), catalogs: catalogs(),
    people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/assign?date=2026-10-16')
  await page.getByRole('button', { name: 'Agregar locales' }).click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a la jornada de Lucía' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  const text = sheet.getByLabel('Direcciones')
  await text.pressSequentially('1462; Altolaguirre 1952 @flo')
  const options = sheet.getByRole('listbox', { name: 'Vendedores' })
  await expect(options.getByRole('option')).toHaveCount(1)
  await page.screenshot({ path: `test-results/mention-${info.project.name}.png` })
  await page.keyboard.press('Enter')
  await expect(text).toHaveValue('1462; Altolaguirre 1952 @Florencia ')
  await text.pressSequentially('#kio')
  await sheet.getByRole('option', { name: 'Drugstore / Kiosco / Kiosco ventana' }).click()
  await expect(text).toHaveValue('1462; Altolaguirre 1952 @Florencia #Drugstore / Kiosco / Kiosco ventana ')
  await expect(sheet.getByText(/1 local · 1 con nro\. de cliente · 1 con vendedor · 1 con canal/)).toBeVisible()

  await sheet.getByRole('button', { name: 'Agregar 1 dirección' }).click()
  await expect.poll(() => state.tagged?.[0]).toMatchObject({ p_store: 's-v1', p_seller: 1, p_channel: 11 })
})

test('an unknown @name is flagged and the store goes without it', async ({ page }) => {
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships: as(['supervisor']), catalogs: catalogs(), people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }] }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/assign?date=2026-10-16')
  await page.getByRole('button', { name: 'Agregar locales' }).click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a la jornada de Lucía' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill('Cuba 2200 @Pedro')
  await expect(sheet.getByText('No encontramos @Pedro.', { exact: false })).toBeVisible()
})

test('the activador sees the channel and seller in the visit, and the message names them', async ({ page }, info) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Altolaguirre 1952', { store: { id: 's1', name: null, address: 'Altolaguirre 1952', area: 'Villa Urquiza', customer_number: '1462', lat: null, lng: null, location_status: 'unverified', channel_id: 10, seller_id: 1 } })],
    uploads: [],
    catalogs: catalogs(),
    templates: [{ kind: 'after', body: 'FECHA DE EJECUCION: {fecha_corta}\nCANAL: {CANAL}\nCLIENTE: {nro_cliente}\nRESPONSABLE: {VENDEDOR}' }],
  }
  await installFakeSupabase(page, state)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  await expect(page.getByText('Autoservicio', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Vendedor: Florencia').first()).toBeVisible()
  await page.screenshot({ path: `test-results/visit-tags-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Copiar DESPUÉS' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('FECHA DE EJECUCION: 12/10\nCANAL: AUTOSERVICIO\nCLIENTE: 1462\nRESPONSABLE: FLORENCIA')
})

test('the directory shows and filters by channel and seller; the store edits them', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], memberships: as(['supervisor']), catalogs: catalogs(),
    stores: [
      { id: 's1', name: 'Lo de Flor', address: 'Altolaguirre 1952', customer_number: '1462', location_status: 'verified', source: 'imported', channel_id: 10, seller_id: 1 },
      { id: 's2', name: null, address: 'Moldes 1365', customer_number: null, location_status: 'verified', source: 'manual' },
    ],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/stores')
  await expect(page.getByText('Vendedor: Florencia').or(page.getByRole('cell', { name: /Florencia/ })).first()).toBeVisible()
  await page.getByLabel('Vendedor', { exact: true }).selectOption({ label: 'Sin vendedor' })
  await expect(page.getByRole('link', { name: /Lo de Flor/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Moldes 1365/ })).toBeVisible()
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(scroll).toBeLessThanOrEqual(0)
  await page.screenshot({ path: `test-results/directory-tags-${info.project.name}.png`, fullPage: true })

  await page.getByRole('link', { name: /Moldes 1365/ }).click()
  await expect(page.getByRole('heading', { name: 'Moldes 1365', level: 1 })).toBeVisible()
  await expect(page.getByText('Sin canal')).toBeVisible()
  await page.getByRole('button', { name: 'Editar datos' }).click()
  const sheet = page.getByRole('dialog', { name: 'Editar datos' })
  await sheet.getByLabel('Canal').selectOption({ label: 'Autoservicio' })
  await sheet.getByLabel('Vendedor').selectOption({ label: 'Martín Sosa' })
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => state.stores?.find((x) => x.id === 's2')).toMatchObject({ channel_id: 10, seller_id: 2 })
})

test('a seller opens Visitario on their clients', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], memberships: as(['seller']), catalogs: catalogs(),
    clients: [
      { id: 's1', name: 'Lo de Flor', address: 'Altolaguirre 1952', area: null, customer_number: '1462', channel_id: 10, last_visit_date: '2026-10-12', last_visit_status: 'done', last_visit_review: 'approved', last_merchandiser: 'Agustín', visits_30d: 2 },
      { id: 's2', name: null, address: 'Moldes 1365', area: null, customer_number: null, channel_id: null, last_visit_date: null, last_visit_status: null, last_visit_review: null, last_merchandiser: null, visits_30d: 0 },
    ],
  }
  await installFakeSupabase(page, state)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Mis clientes · 2' })).toBeVisible()
  await expect(page.getByText('1 de 2 con activaciones en los últimos 30 días.')).toBeVisible()
  await expect(page.getByText('Hoy · Agustín')).toBeVisible()
  await expect(page.getByText('Sin activaciones')).toBeVisible()
  await page.screenshot({ path: `test-results/clients-${info.project.name}.png`, fullPage: true })
})
