import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState } from './support/fake-supabase'

const day = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const seller = [{ id: 'm1', company_id: 'c1', roles: ['seller'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const catalogs = () => ({
  brand: [{ id: 1, name: 'SKYY', active: true }, { id: 2, name: 'Aperol', active: true }],
  channel: [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }],
  seller: [{ id: 1, name: 'Florencia Paz', active: true, person_id: 'p1' }],
})
const store = { id: 's1', name: 'Coto Cabildo', address: 'Cabildo 2280', area: 'Belgrano', customer_number: '1462', channel_id: 10, seller_id: 1, lat: null, lng: null }
const client = (id: string, name: string, mine: string | null) => ({
  id, name, address: `${name} 100`, area: 'Belgrano', customer_number: null, channel_id: 10, last_visit_date: null, last_visit_status: null,
  last_visit_review: null, last_merchandiser: null, visits_30d: 0, my_last_visit: mine, my_last_outcome: mine ? 'order' : null,
})
const coverage = (target: number | null) => [{ seller_id: 1, name: 'Florencia Paz', has_user: true, monthly_target: target, clients: 3, visited_clients: 1, visits: 4, orders: 2, no_orders: 1, closed: 1, activated_clients: 2 }]

test('the seller records a visit with an order and sends it by WhatsApp', async ({ page }, info) => {
  const s: FakeState = { workday: null, visits: [], uploads: [], memberships: seller, catalogs: catalogs(), clientHistory: { s1: { store, visits: [] } } }
  await installFakeSupabase(page, s, 'seller')
  await page.goto('/s/clients/s1')

  await page.getByRole('button', { name: 'Registrar visita' }).click()
  const sheet = page.getByRole('dialog', { name: 'Registrar visita' })
  await expect(sheet.getByRole('button', { name: 'Guardar visita' })).toBeDisabled()
  await sheet.getByRole('radio', { name: 'Con pedido' }).click()
  await expect(sheet.getByRole('button', { name: 'Guardar visita' })).toBeDisabled() // nothing asked for yet
  await sheet.getByLabel('Producto 1', { exact: true }).fill('SKYY 750 caja x6')
  await sheet.getByRole('button', { name: 'Uno más' }).click()
  await sheet.getByRole('button', { name: 'Agregar producto' }).click()
  await sheet.getByLabel('Producto 2', { exact: true }).fill('Aperol 1 L')
  await sheet.getByLabel('Nota (opcional)').fill('Entregar el jueves')
  await page.screenshot({ path: `test-results/seller-visit-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Guardar visita' }).click()
  await expect(sheet).toBeHidden()

  await expect.poll(() => s.sellerVisits?.[0]).toMatchObject({ store_id: 's1', outcome: 'order', note: 'Entregar el jueves',
    order_lines: [{ qty: 2, item: 'SKYY 750 caja x6' }, { qty: 1, item: 'Aperol 1 L' }] })
  const mine = page.getByRole('region', { name: 'Mis visitas' })
  await expect(mine.getByText('Con pedido')).toBeVisible()
  const send = decodeURIComponent((await mine.getByRole('link', { name: 'Mandar el pedido' }).getAttribute('href')) ?? '')
  expect(send).toContain('*Pedido · Coto Cabildo · Cliente 1462*')
  expect(send).toContain('• 2 × SKYY 750 caja x6')

  // Without an order: the reason, one tap.
  await page.getByRole('button', { name: 'Registrar visita' }).click()
  await sheet.getByRole('radio', { name: 'Sin pedido' }).click()
  await sheet.getByRole('radio', { name: 'Tiene stock' }).click()
  await sheet.getByRole('button', { name: 'Guardar visita' }).click()
  await expect.poll(() => s.sellerVisits?.[1]).toMatchObject({ outcome: 'no_order', reason: 'Tiene stock' })

  // A mistake the same day: taken back.
  await mine.getByRole('button', { name: /^Quitar la visita/ }).first().click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar', exact: true }).click()
  await expect.poll(() => (s.sellerVisits ?? []).filter((v) => v.deleted_at).length).toBe(1)
})

test('"Mis clientes" shows the month: coverage, target and who is still to visit', async ({ page }, info) => {
  const s: FakeState = {
    workday: null, visits: [], uploads: [], memberships: seller, catalogs: catalogs(), coverage: coverage(60),
    clients: [client('s1', 'Coto Cabildo', day(0)), client('s2', 'Dia Moldes', null), client('s3', 'Kiosco Juramento', '2026-09-30')],
  }
  await installFakeSupabase(page, s, 'seller')
  await page.goto('/s/clients')
  const month = page.getByRole('region', { name: /^Tu / })
  await expect(month).toContainText('1 de 3')
  await expect(month).toContainText('4 de 60 visitas del objetivo del mes')
  await expect(page.getByText('Tu visita: Hoy · Con pedido')).toBeVisible()
  await page.screenshot({ path: `test-results/seller-month-${info.project.name}.png`, fullPage: true })
  await page.getByRole('radio', { name: 'Por visitar este mes · 2' }).click()
  await expect(page.getByRole('link', { name: /Coto Cabildo/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Dia Moldes/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Kiosco Juramento/ })).toBeVisible()
})

test('the supervisor sees each seller\'s coverage and sets a monthly target', async ({ page }, info) => {
  const s: FakeState = { workday: null, visits: [], uploads: [], memberships: supervisor, catalogs: catalogs(), coverage: coverage(null) }
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/reports?view=sellers')
  const list = page.getByRole('list', { name: 'Vendedores' })
  await expect(list).toContainText('Florencia Paz')
  await expect(list).toContainText('1/3')
  await list.getByRole('button', { name: 'Poner objetivo' }).click()
  const sheet = page.getByRole('dialog', { name: 'Objetivo mensual' })
  await sheet.getByLabel('Visitas por mes').fill('60')
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => s.targets?.[0]).toMatchObject({ p_seller: 1, p_target: 60 })
  await expect(list.getByRole('button', { name: 'Objetivo: 60 visitas/mes' })).toBeVisible()
  await expect(list.getByRole('meter', { name: 'Objetivo de Florencia Paz' })).toBeVisible()
  await page.screenshot({ path: `test-results/sellers-report-${info.project.name}.png`, fullPage: true })
})
