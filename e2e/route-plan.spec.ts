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

test('a zone is marked on the map and used as it is: no name, nothing to save', async ({ page }, info) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/plan?date=2026-11-20')
  await expect(page.getByText('7 locales cumplen los filtros')).toBeVisible()
  // No saved zones to pick, and nothing to name.
  await expect(page.getByRole('combobox', { name: 'Zona' })).toHaveCount(0)
  await expect(page.getByText('Sin zona: toma locales de todo el mapa.')).toBeVisible()
  await choose(page, 'Trato', 'Buena onda')
  await expect(page.getByText('0 locales cumplen los filtros')).toBeVisible()
  await expect(page.getByText('Con estos filtros no hay locales')).toBeVisible()
  await choose(page, 'Trato', 'Cualquiera')

  await page.getByRole('button', { name: 'Marcar zona' }).click()
  await expect(page.getByText('Tocá el mapa para marcar las esquinas de la zona (0 de al menos 3).')).toBeVisible()
  await expect(page.getByLabel('Nombre de la zona')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Guardar zona' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Listo' })).toBeDisabled()
  await page.screenshot({ path: `test-results/route-zone-${info.project.name}.png` })
  // Until it has 3 corners there is no zone yet; with them, the route is built right away.
  await expect(page.getByRole('button', { name: 'Armar recorrido' })).toBeDisabled()
  // The map is right there, under the zone tools, not at the end of the page (headless browsers show its fallback).
  const map = page.getByRole('region', { name: /^Mapa/ }).or(page.getByText('No pudimos mostrar el mapa', { exact: false }))
  const mapTop = (await map.boundingBox())?.y ?? Infinity
  const goalTop = (await page.getByText('Objetivo', { exact: true }).boundingBox())?.y ?? 0
  if (info.project.name === 'mobile') expect(mapTop).toBeLessThan(goalTop)
  await page.getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('button', { name: 'Marcar zona' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Armar recorrido' })).toBeEnabled()
})

test('Asignar and the map lead to it', async ({ page }, info) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/assign?date=2026-11-20')
  // On a phone the three tools sit side by side.
  const tops = await Promise.all(['Importar planilla', 'Armar recorrido', 'Armar operativo'].map(async (n) => (await page.getByRole('button', { name: n }).boundingBox())?.y))
  expect(new Set(tops).size).toBe(1)
  await page.screenshot({ path: `test-results/assign-tools-${info.project.name}.png` })
  await page.getByRole('button', { name: 'Armar recorrido' }).click()
  await expect(page).toHaveURL(/\/s\/plan\?date=2026-11-20/)
  await expect(page.getByRole('heading', { name: 'Armar recorrido' })).toBeVisible()
})

test('a route asked for in words: the AI fills in the form, only with what the lists have', async ({ page }, info) => {
  const s = state()
  // The AI's answer, with a seller that exists and one person that does not.
  s.planRequest = { plan: { goal: 'overdue', seller_ids: [1], zone_id: null, min_rapport: null, stale_days: 30, count: 7, mode: 'walking', merchandiser: 'Pedro', unknown: [] } }
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/plan?date=2026-11-20')
  await expect(page.getByText('Te quedan 30 usos de IA hoy.')).toBeVisible()
  await page.getByLabel('Pedilo con IA').fill('6 locales de Mirko en Palermo sin activar este mes, a pie, para Pedro')
  await page.getByRole('button', { name: 'Entender el pedido' }).click()

  const read = page.getByRole('status').filter({ hasText: 'Entendí esto' })
  await expect(read).toContainText('Objetivo: Los más atrasados')
  await expect(read).toContainText('Vendedor: Mirko Ra')
  await expect(read).toContainText('Sin activar hace más de 30 días')
  await expect(read).toContainText('7 locales') // as asked, not rounded to a usual count
  await expect(read).toContainText('No encontramos el activador "Pedro": lo dejamos afuera.')
  await expect(page.getByText('Te quedan 29 usos de IA hoy.')).toBeVisible()
  expect(s.planRequest.asked?.[0]).toContain('Mirko')
  // The form now says it: the seller's stores (s6 is already planned).
  await expect(page.getByText('6 locales cumplen los filtros')).toBeVisible()
  await page.screenshot({ path: `test-results/route-plan-ai-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Armar recorrido' }).click()
  const result = page.getByRole('region', { name: 'Recorrido propuesto' })
  await expect(result.getByText(/^6 locales/)).toBeVisible()
  // Fewer fit than asked: said, not hidden.
  await expect(result.getByText('Pediste 7, pero con estos filtros hay 6 locales en el mapa.', { exact: false })).toBeVisible()
})

test('a written request without the AI on says so, and the form still works', async ({ page }) => {
  const s = state()
  s.planRequest = { status: 429, error: 'limit_person' }
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/plan?date=2026-11-20')
  await page.getByLabel('Pedilo con IA').fill('los más atrasados de Ruth')
  await page.getByRole('button', { name: 'Entender el pedido' }).click()
  await expect(page.getByText('Ya usaste la IA todo lo permitido por hoy: mañana se renueva. Mientras tanto, elegí los filtros a mano.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Armar recorrido' })).toBeEnabled()
})
