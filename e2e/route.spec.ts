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
  await expect(page.getByLabel('Último local')).toHaveAttribute('data-value', 'v6') // closed: back after 17 h
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

  // Up to 10 stores in one Google Maps link, on the phone too.
  await expect(page.getByRole('link', { name: 'Todo el recorrido' })).toBeVisible()
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
  await map.getByRole('button', { name: /^1\. Autoservicio Lili, por hacer$/ }).click()
  await expect(page.getByRole('link', { name: 'Ir con Google Maps' })).toBeVisible()
  await page.screenshot({ path: `test-results/route-map-${info.project.name}.png`, fullPage: true })

  // Without the map service: the sketch, never a blank box.
  mapUp = false
  await page.goto('/s/route')
  await expect(page.getByRole('region', { name: 'Mapa del recorrido' })).toHaveCount(0)
  await expect(page.getByRole('img', { name: /Croquis del recorrido/ })).toBeVisible()
})

test('the route calculated stays for the day, without the stretch from the phone', async ({ page, context }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -34.5455, longitude: -58.45 })
  const line = [[-58.45, -34.5455], [-58.4501, -34.5466], [-58.45, -34.5475], [-58.45, -34.5565], [-58.45, -34.5655]]
  const state: FakeState = { ...day(), route: { ids: ['v4', 'v1', 'v7', 'v2', 'v6'], km: 12.5, minutes: 41, line } }
  await installFakeSupabase(page, state)
  await page.goto('/s/route')
  await page.getByRole('button', { name: /Empezar desde mi ubicación/ }).click()
  await page.getByRole('button', { name: 'Calcular mejor orden' }).click()
  await expect(page.getByText('por calles')).toBeVisible()

  // Saved for the day, without the stretch from where the phone was.
  await expect.poll(() => state.routePlan?.stop_ids).toEqual(['v4', 'v1', 'v7', 'v2', 'v6'])
  expect(state.routePlan).toMatchObject({ km: 12.5, minutes: 41, by_street: true, from_origin: true, mode: 'driving' })
  expect((state.routePlan?.line as number[][])[0]).toEqual([-58.45, -34.5475]) // Autoservicio Lili, not the phone

  // Back on the page: the route is there as it was.
  await page.goto('/s/route')
  await expect(page.getByRole('region', { name: 'Orden sugerido' }).getByText(/calculado \d\d:\d\d/)).toBeVisible()
})

test('visited stops keep their place in the saved route, in the colors of their state', async ({ page }, info) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  const state: FakeState = day()
  Object.assign(state.visits.find((v) => v.id === 'v4') ?? {}, { work_status: 'done', review_status: 'approved' })
  Object.assign(state.visits.find((v) => v.id === 'v1') ?? {}, { work_status: 'done' })
  const line = [[-58.45, -34.5475], [-58.45, -34.5565], [-58.45, -34.5655]]
  state.routePlan = { workday_id: 'w1', mode: 'driving', from_origin: true, stop_ids: ['v4', 'v1', 'v7', 'v2', 'v6'], km: 12.5, minutes: 41, by_street: true, line, updated_at: new Date().toISOString() }
  await installFakeSupabase(page, state)
  await page.goto('/s/route')
  const result = page.getByRole('region', { name: 'Orden sugerido' })
  await expect(result.getByText(/calculado \d\d:\d\d/)).toBeVisible()
  await expect(result.getByText('12,5 km')).toBeVisible()
  await expect(result.getByText('2/5')).toBeVisible()
  const stops = result.getByRole('list', { name: 'Locales en el orden del recorrido' }).getByRole('listitem')
  await expect(stops).toHaveCount(5)
  await expect(stops.nth(0)).toContainText('Aprobada')
  await expect(stops.nth(1)).toContainText('Terminada')
  await expect(stops.nth(2).getByRole('link', { name: /Ir a/ })).toBeVisible()
  const map = page.getByRole('region', { name: 'Mapa del recorrido' })
  await expect(map.getByRole('button', { name: /^1\. Autoservicio Lili, aprobada$/ })).toBeVisible()
  await expect(map.getByRole('button', { name: /^3\. Cabildo 2280, por hacer$/ })).toBeVisible()
  await page.screenshot({ path: `test-results/route-kept-${info.project.name}.png`, fullPage: true })
})

test('with everything done the saved route is still there to look at, with nothing to recalculate', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  const state: FakeState = day()
  for (const v of state.visits) if (v.store) Object.assign(v, { work_status: v.id === 'v5' ? 'refused' : 'done' })
  state.routePlan = { workday_id: 'w1', mode: 'driving', from_origin: false, stop_ids: ['v4', 'v1', 'v7', 'v2', 'v6'], km: 12.5, minutes: 41, by_street: false, line: null, updated_at: new Date().toISOString() }
  await installFakeSupabase(page, state)
  await page.goto('/s/route')
  await expect(page.getByRole('region', { name: 'Orden sugerido' }).getByText('todos hechos')).toBeVisible()
  await expect(page.getByRole('button', { name: /Recalcular/ })).toHaveCount(0)
})

test('tomorrow’s route can be planned today: the week is right there', async ({ page }, info) => {
  const state = day()
  state.workday = { ...state.workday, work_date: '2026-10-13' }
  state.visits = state.visits.map((v) => ({ ...v, work_date: '2026-10-13' }))
  await installFakeSupabase(page, state)
  await page.goto('/s/route')
  await expect(page.getByText('Hoy todavía no hay recorrido')).toBeVisible()

  await page.getByRole('navigation', { name: 'Días de la semana' }).getByRole('button', { name: /13 de octubre/ }).click()
  await expect(page).toHaveURL(/date=2026-10-13/)
  await expect(page.getByText('Locales a visitar · 5 de 5')).toBeVisible()
  await page.getByRole('button', { name: 'Calcular mejor orden' }).click()
  await expect(page.getByRole('region', { name: 'Orden sugerido' }).getByRole('listitem')).toHaveCount(5)

  // A day without a workday says so, without the "today" wording. On the phone the result
  // takes the screen: back to the options, where the week is.
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Volver a las opciones' }).click()
  await page.getByRole('navigation', { name: 'Días de la semana' }).getByRole('button', { name: /14 de octubre/ }).click()
  await expect(page.getByText('Ese día todavía no tiene jornada')).toBeVisible()
})

test('the stops can be put in another order by hand: the map follows and the day keeps it as custom', async ({ page }, info) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  const state: FakeState = { ...day(), route: { ids: ['v1', 'v4', 'v7', 'v2', 'v6'], km: 12.5, minutes: 41 } }
  await installFakeSupabase(page, state)
  await page.goto('/s/route')
  await page.getByRole('button', { name: 'Calcular mejor orden' }).click()
  await expect(page.getByText('Recorrido sugerido')).toBeVisible()
  const order = page.getByRole('list', { name: 'Locales en el orden del recorrido' }).getByRole('listitem')
  await expect(order.nth(0)).toContainText('Mas Ahorro')

  // Dragging Amenábar 1260 (4th) to the top, by its handle.
  const handle = page.getByRole('button', { name: 'Mover Amenábar 1260' })
  await handle.scrollIntoViewIfNeeded()
  await order.nth(0).scrollIntoViewIfNeeded()
  const from = await handle.boundingBox()
  const top = await order.nth(0).boundingBox()
  if (!from || !top) throw new Error('no boxes')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  for (let y = from.y; y > top.y - 10; y -= 12) await page.mouse.move(from.x + from.width / 2, y)
  await page.mouse.up()
  await expect(order.nth(0)).toContainText('Amenábar 1260')
  await expect(order.nth(1)).toContainText('Mas Ahorro')
  await expect(page.getByText('Recorrido personalizado')).toBeVisible()
  // The map's pins follow at once.
  await expect(page.getByRole('region', { name: 'Mapa del recorrido' }).getByRole('button', { name: /^1\. Amenábar 1260/ })).toBeVisible()

  // With the keyboard too: the last one up one place.
  await page.getByRole('button', { name: 'Mover Vidal 2044' }).focus()
  await page.keyboard.press('ArrowUp')
  await expect(order.nth(3)).toContainText('Vidal 2044')

  // That order by streets, kept for the day as custom.
  await expect(page.getByText('7,3 km')).toBeVisible()
  await expect(page.getByText('25 min')).toBeVisible()
  const asked = state.routeAsked?.at(-1)
  expect(asked?.fixed).toBe(true)
  expect((asked?.stops as { id: string }[]).map((s) => s.id)).toEqual(['v2', 'v1', 'v4', 'v6', 'v7'])
  await expect.poll(() => state.routePlan?.custom).toBe(true)
  expect(state.routePlan?.stop_ids).toEqual(['v2', 'v1', 'v4', 'v6', 'v7'])
  await page.screenshot({ path: `test-results/route-custom-${info.project.name}.png`, fullPage: true })

  // Coming back it is still the custom one; recalculating goes back to the suggested.
  await page.goto('/s/route')
  await expect(page.getByText('Recorrido personalizado')).toBeVisible()
  await page.getByRole('button', { name: 'Volver al recorrido sugerido' }).click()
  await expect(page.getByText('Recorrido sugerido')).toBeVisible()
  await expect.poll(() => state.routePlan?.custom).toBe(false)
})
