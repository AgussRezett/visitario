import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

// Along Cabildo, about 500 m apart: n = 0 is the south end.
const at = (n: number) => ({ lat: -34.57 + n * 0.0045, lng: -58.45, location_status: 'verified' })
const store = (id: string, address: string, name: string | null, n: number | null) => ({
  id: `s-${id}`, name, address, area: 'Belgrano', customer_number: null, lat: null, lng: null, location_status: 'unverified', ...(n === null ? {} : at(n)),
})

const day = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [
    visitRow('v1', 0, 'Tres Arroyos 762', { store: store('v1', 'Tres Arroyos 762', 'Mas Ahorro', 3) }),
    visitRow('v2', 1, 'Amenábar 1260', { store: store('v2', 'Amenábar 1260', null, 0) }),
    visitRow('v3', 2, 'Moldes 1365', { store: store('v3', 'Moldes 1365', null, 4), work_status: 'done', finished_at: '2026-10-12T13:00:00Z' }),
    visitRow('v4', 3, 'Juramento 2101', { store: store('v4', 'Juramento 2101', 'Autoservicio Lili', 5) }),
    visitRow('v5', 4, 'Echeverría 1580', { store: store('v5', 'Echeverría 1580', null, null) }),
    visitRow('v6', 5, 'Vidal 2044', { store: store('v6', 'Vidal 2044', null, 1), work_status: 'closed', retry_after: '2026-10-12T20:00:00Z' }),
    visitRow('v7', 6, 'Cabildo 2280', { store: store('v7', 'Cabildo 2280', null, 2) }),
  ],
  uploads: [],
})

test('without my location: starts at the first store, the closed one last, and the order goes to the day', async ({ page }, info) => {
  const state = day()
  await installFakeSupabase(page, state)
  await page.goto('/s/route')

  await expect(page.getByText('1 local sin ubicación')).toBeVisible()
  await expect(page.getByText('Locales a visitar · 5 de 5')).toBeVisible()
  await expect(page.getByLabel('Último local')).toHaveValue('v6') // closed: back after 17 h
  await expect(page.getByText('Moldes 1365')).toHaveCount(0) // finished: out of the route
  await page.screenshot({ path: `test-results/route-setup-${info.project.name}.png`, fullPage: true })

  const started = Date.now()
  await page.getByRole('button', { name: 'Calcular mejor orden' }).click()
  const order = page.getByRole('region', { name: 'Orden sugerido' }).getByRole('listitem')
  await expect(order).toHaveCount(5)
  expect(Date.now() - started).toBeLessThan(3000)
  await expect(order.nth(0)).toContainText('Mas Ahorro')
  await expect(order.nth(1)).toContainText('Autoservicio Lili')
  await expect(order.nth(2)).toContainText('Cabildo 2280')
  await expect(order.nth(3)).toContainText('Amenábar 1260')
  await expect(order.nth(4)).toContainText('Vidal 2044 · último')
  await expect(page.getByText('en línea recta', { exact: true })).toBeVisible()

  if (info.project.name === 'desktop') {
    await expect(page.getByRole('link', { name: 'Todo el recorrido' })).toBeVisible()
  } else {
    await expect(page.getByRole('link', { name: 'Tramo 1 · 1 a 4' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Tramo 2 · 4 a 5' })).toBeVisible()
  }
  await page.screenshot({ path: `test-results/route-result-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Aplicar este orden a mi jornada' }).click()
  await expect(page).toHaveURL(/\/s\/workday/)
  await expect.poll(() => state.visits.map((v) => `${v.id}:${v.sort_order}`).join(' ')).toBe('v1:0 v2:5 v3:2 v4:1 v5:4 v6:6 v7:3')
  const list = info.project.name === 'desktop' ? page.getByRole('table', { name: 'Locales de la jornada' }) : page.getByRole('region', { name: 'Locales' })
  const text = await list.innerText()
  const places = ['Mas Ahorro', 'Autoservicio Lili', 'Moldes 1365', 'Cabildo 2280', 'Echeverría 1580', 'Amenábar 1260', 'Vidal 2044'].map((p) => text.indexOf(p))
  expect([...places].sort((a, b) => a - b)).toEqual(places)
})

test('from my location, by streets when the service answers', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -34.5455, longitude: -58.45 }) // past the north end
  const state = { ...day(), route: { ids: ['v4', 'v1', 'v7', 'v2', 'v6'], km: 12.5, minutes: 41 } }
  await installFakeSupabase(page, state)
  await page.goto('/s/route')

  await page.getByRole('button', { name: /Empezar desde mi ubicación/ }).click()
  await expect(page.getByText(/Ubicación tomada/)).toBeVisible()
  await page.getByRole('button', { name: 'Calcular mejor orden' }).click()

  await expect(page.getByText('12,5 km')).toBeVisible()
  await expect(page.getByText('41 min')).toBeVisible()
  await expect(page.getByText('por calles')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Orden sugerido' }).getByRole('listitem').first()).toContainText('Autoservicio Lili')
  expect(state.routeAsked?.[0]).toMatchObject({ mode: 'driving', origin: { lat: -34.5455, lng: -58.45 }, lastId: 'v6' })
  expect(state.routeAsked?.[0]?.firstId).toBeUndefined()
})

// A plain map style: the map loads without reaching OpenFreeMap.
const PLAIN_STYLE = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8ebe4' } }] }

test('the route on a street map: numbered stops to tap, the path by streets, the sketch when the map cannot load', async ({ page, context }, info) => {
  let mapUp = true
  await page.route('https://tiles.openfreemap.org/**', (route) => (mapUp ? route.fulfill({ json: PLAIN_STYLE }) : route.abort()))
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -34.5455, longitude: -58.45 })
  const line = [[-58.45, -34.5455], [-58.451, -34.548], [-58.45, -34.5475], [-58.45, -34.5565], [-58.45, -34.5565], [-58.449, -34.565], [-58.45, -34.5655]]
  const state = { ...day(), route: { ids: ['v4', 'v1', 'v7', 'v2', 'v6'], km: 12.5, minutes: 41, line } }
  await installFakeSupabase(page, state)
  await page.goto('/s/route')
  await page.getByRole('button', { name: /Empezar desde mi ubicación/ }).click()
  await page.getByRole('button', { name: 'Calcular mejor orden' }).click()
  await expect(page.getByText('por calles')).toBeVisible()

  const map = page.getByRole('region', { name: 'Mapa del recorrido' })
  await expect(map).toBeVisible()
  await expect(map.getByRole('button', { name: /^\d+\. / })).toHaveCount(5)
  await expect(map.getByRole('button', { name: 'Acercar' })).toBeVisible()
  await map.getByRole('button', { name: '1. Autoservicio Lili' }).click()
  await expect(page.getByRole('link', { name: 'Ir con Google Maps' })).toBeVisible()
  await page.screenshot({ path: `test-results/route-map-${info.project.name}.png`, fullPage: true })

  // Without the map service: the sketch, never a blank box.
  mapUp = false
  await page.getByRole('button', { name: 'Recalcular' }).click()
  await expect(page.getByRole('region', { name: 'Mapa del recorrido' })).toHaveCount(0)
  await expect(page.getByRole('img', { name: /Croquis del recorrido/ })).toBeVisible()
})
