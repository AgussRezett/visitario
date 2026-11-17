import { choose, pick } from './support/select'
import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState, type Row } from './support/fake-supabase'

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
// A block in Palermo (about 100 m apart) and two far ones.
const point = (id: string, lng: number, lat: number, extra: Row = {}): Row => ({
  id, name: null, address: `Calle ${id}`, area: 'Palermo', customer_number: null, lat, lng, location_status: 'verified',
  channel_id: 10, seller_id: 1, last_visit_date: daysAgo(40), last_visit_status: 'done', last_merchandiser: 'Lucía', visits_30d: 0, visits_90d: 1, rapport: null, ...extra,
})
const points = [
  ...[1, 2, 3, 4, 5, 6].map((i) => point(`s${i}`, -58.43 + i * 0.001, -34.58)),
  point('s7', -58.30, -34.50, { area: 'Núñez' }),
  point('s8', -58.55, -34.70, { area: 'Flores', seller_id: 2 }),
]
const state = (): FakeState => ({
  workday: null, visits: [], uploads: [],
  memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
  catalogs: { channel: [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }], seller: [{ id: 1, name: 'Mirko Ra', active: true, person_id: null }, { id: 2, name: 'Ruth Ri', active: true, person_id: null }] },
  mapPoints: points,
  people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }],
  routeCandidates: [
    { store_id: 's3', open_request: true, request_by: 'Mirko', open_issues: 1, planned_for: null },
    { store_id: 's6', open_request: false, request_by: null, open_issues: 0, planned_for: 'Pedro' },
  ],
  routeZones: [{ id: 'z1', name: 'Palermo', ring: [[-58.44, -34.59], [-58.42, -34.59], [-58.42, -34.57], [-58.44, -34.57]], deleted_at: null }],
})

test('the supervisor plans a route for a goal and puts it into a day', async ({ page }, info) => {
  const s = state()
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/plan?date=2026-11-20')
  await expect(page.getByRole('heading', { name: 'Armar recorrido' })).toBeVisible()
  // Already in Pedro's day: left out unless asked for.
  await expect(page.getByText('7 locales cumplen los filtros')).toBeVisible()
  await page.getByText('Pedidos y novedades', { exact: true }).click()
  await pick(page.getByLabel('Locales', { exact: true }), '6 locales')
  await page.getByRole('button', { name: 'Armar recorrido' }).click()

  const result = page.getByRole('region', { name: 'Recorrido propuesto' })
  await expect(result.getByText(/^6 locales/)).toBeVisible()
  await expect(result.getByText('en línea recta', { exact: false })).toBeVisible()
  await expect(result.getByText('Sin activar hace 40 días · Pedido de Mirko · 1 novedad abierta')).toBeVisible()
  await page.screenshot({ path: `test-results/route-plan-${info.project.name}.png`, fullPage: true })

  await result.getByRole('button', { name: 'Sacar Calle s1 del recorrido' }).click()
  await expect(result.getByText(/^5 locales/)).toBeVisible()
  await pick(result.getByLabel('Para'), 'Lucía Gómez')
  await result.getByRole('button', { name: 'Agregar a la jornada de Lucía' }).click()
  await expect(result.getByText('Listo: 5 locales en la jornada de Lucía.')).toBeVisible()
  expect(s.addedToDay?.[0]?.workday).toBe('w-p2-2026-11-20')
  expect(s.addedToDay?.[0]?.stores).toHaveLength(5)
  expect(s.addedToDay?.[0]?.stores).toContain('s3')
  expect(s.addedToDay?.[0]?.stores).not.toContain('s1')
})

test('zones: pick a saved one, or start drawing a new one', async ({ page }) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/plan?date=2026-11-20')
  await expect(page.getByText('7 locales cumplen los filtros')).toBeVisible()
  await pick(page.getByLabel('Zona', { exact: true }), 'Palermo')
  await expect(page.getByText('5 locales cumplen los filtros')).toBeVisible()
  await choose(page, 'Trato', 'Buena onda')
  await expect(page.getByText('0 locales cumplen los filtros')).toBeVisible()
  await expect(page.getByText('Con estos filtros no hay locales')).toBeVisible()
  await choose(page, 'Trato', 'Cualquiera')

  await page.getByRole('button', { name: 'Dibujar zona' }).click()
  await expect(page.getByText('Tocá el mapa para marcar las esquinas de la zona (0 de al menos 3).')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Guardar zona' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Armar recorrido' })).toBeDisabled()
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('button', { name: 'Dibujar zona' })).toBeVisible()
})

test('Asignar and the map lead to it', async ({ page }) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/assign?date=2026-11-20')
  await page.getByRole('button', { name: 'Armar recorrido' }).click()
  await expect(page).toHaveURL(/\/s\/plan\?date=2026-11-20/)
  await expect(page.getByRole('heading', { name: 'Armar recorrido' })).toBeVisible()
})
