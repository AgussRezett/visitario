import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState, type Row } from './support/fake-supabase'

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const point = (id: string, extra: Row = {}): Row => ({
  id, name: null, address: `Calle ${id}`, area: 'Belgrano', customer_number: null, lat: -34.56, lng: -58.46, location_status: 'verified',
  channel_id: null, seller_id: null, last_visit_date: null, last_visit_status: null, last_merchandiser: null, visits_30d: 0, visits_90d: 0, rapport: null, ...extra,
})
const catalogs = () => ({
  channel: [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }],
  seller: [{ id: 1, name: 'Florencia', active: true, person_id: null }, { id: 2, name: 'Pedro', active: true, person_id: 'p9' }],
})
const points = [
  point('s1', { name: 'Coto Cabildo', seller_id: 1, channel_id: 10, last_visit_date: daysAgo(3), last_merchandiser: 'Lucía', visits_30d: 2, visits_90d: 5, rapport: 3 }),
  point('s2', { seller_id: 1, area: 'Palermo', lat: -34.58, lng: -58.43, last_visit_date: daysAgo(45), visits_90d: 1 }),
  point('s3', { seller_id: 2, area: 'Palermo', lat: -34.59, lng: -58.42 }),
  point('s4', { area: 'Núñez', lat: -34.54, lng: -58.47, last_visit_date: daysAgo(10), visits_30d: 1, visits_90d: 1 }),
]
const role = (r: string) => [{ id: 'm1', company_id: 'c1', roles: [r], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]

test('the supervisor sees every point, by seller, with insights that filter the map', async ({ page }, info) => {
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships: role('supervisor'), catalogs: catalogs(), mapPoints: points }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/map')
  await expect(page.getByRole('heading', { name: 'Mapa de puntos de venta' })).toBeVisible()
  await expect(page.getByText('4 puntos', { exact: true })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Vendedor' })).toHaveAttribute('aria-checked', 'true')
  const bySeller = page.getByRole('region', { name: 'Por vendedor' })
  await expect(bySeller.getByRole('row', { name: /Florencia/ })).toContainText('50%')
  await expect(page.getByText('1 punto no tiene vendedor', { exact: false })).toBeVisible()
  await page.screenshot({ path: `test-results/storemap-${info.project.name}.png`, fullPage: true })

  await bySeller.getByRole('button', { name: 'Ver en el mapa: Florencia' }).click()
  await expect(page.getByText('2 de 4 puntos')).toBeVisible()
  // Phones fold the filters away, and say how many are on.
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Filtros · 1' }).click()
  await page.getByRole('button', { name: 'Limpiar filtros' }).click()
  await page.getByLabel('Zona', { exact: true }).selectOption('Palermo')
  await expect(page.getByText('2 de 4 puntos')).toBeVisible()
  await page.getByLabel('Zona', { exact: true }).selectOption('')
  await page.getByRole('switch', { name: /Solo sin visitar/ }).click()
  await expect(page.getByText('2 de 4 puntos')).toBeVisible() // 45 days and never

  await page.getByRole('radio', { name: 'Última visita' }).click()
  await expect(page.getByRole('list', { name: 'Referencias' })).toContainText('Más de 30 días')
})

test('a point opens with its last activation and a way to its file', async ({ page }) => {
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships: role('supervisor'), catalogs: catalogs(), mapPoints: points }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/map?point=s1')
  const sheet = page.getByRole('dialog', { name: 'Coto Cabildo' })
  await expect(sheet.getByText('Últimos 7 días')).toBeVisible()
  await expect(sheet.getByText(/Lucía · hace 3 días/)).toBeVisible()
  await expect(sheet.getByText('2 en 30 días · 5 en 90 días')).toBeVisible()
  await expect(sheet.getByText('Florencia')).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'Ver ficha e historial' })).toHaveAttribute('href', '/stores/s1')
})

test('a seller sees their clients on the map, and each one with its history', async ({ page }, info) => {
  const mine = points.filter((p) => p.seller_id === 1)
  const state: FakeState = {
    workday: null, visits: [], uploads: [], memberships: role('seller'), catalogs: catalogs(), mapPoints: mine,
    clientHistory: {
      s1: {
        store: { id: 's1', name: 'Coto Cabildo', address: 'Cabildo 2280', area: 'Belgrano', customer_number: '1462', lat: -34.56, lng: -58.46, channel_id: 10, seller_id: 1 },
        visits: [{ id: 'v1', date: daysAgo(3), status: 'done', review: 'approved', consent: 'yes', merchandiser: 'Lucía Gómez', displays: ['Puntera', 'Góndola'], metrics: [{ name: 'Kits', quantity: 4 }] }],
      },
    },
  }
  await installFakeSupabase(page, state, 'seller')
  await page.goto('/s/map')
  await expect(page.getByRole('heading', { name: 'Mapa de mis clientes' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Vendedor' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Por vendedor' })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Por zona' })).toBeVisible()

  await page.goto('/s/clients/s1')
  await expect(page.getByRole('heading', { name: 'Coto Cabildo' })).toBeVisible()
  await expect(page.getByText('Exhibiciones: Puntera, Góndola')).toBeVisible()
  await expect(page.getByText('Kits: 4')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ver en el mapa' })).toHaveAttribute('href', '/s/map?point=s1')
  await page.screenshot({ path: `test-results/client-${info.project.name}.png`, fullPage: true })
  expect(TODAY).toBeTruthy()
})
