import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const TODAY = '2026-10-12'
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const lucia = { id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }
const ofLucia = { merchandiser_id: 'p2', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' }, workday_id: 'w-p2', source: 'assigned', added_by: 'p1', adder: { first_name: 'Martín' } }

test.beforeEach(({ page }) => atFakeToday(page))

const luciaDay = (): FakeState => ({
  workday: null,
  uploads: [],
  memberships: supervisor,
  people: [lucia],
  workdays: [{ id: 'w-p2', company_id: 'c1', merchandiser_id: 'p2', work_date: TODAY, status: 'published' }],
  stores: [{ id: 's-v3', company_id: 'c1', address: 'Cuba 1940', name: null, area: 'Belgrano', customer_number: null, lat: null, lng: null, location_status: 'verified', source: 'imported' }],
  visits: [
    visitRow('v1', 0, 'Tres Arroyos 762', { ...ofLucia, work_status: 'done', arrived_at: `${TODAY}T10:02:00-03:00`, finished_at: `${TODAY}T10:40:00-03:00` }),
    visitRow('v2', 1, 'Juramento 2101', { ...ofLucia, work_status: 'in_progress', arrived_at: `${TODAY}T11:05:00-03:00` }),
    visitRow('v3', 2, 'Cuba 1940', ofLucia),
    visitRow('v4', 3, 'Moldes 1365', { ...ofLucia, source: 'added', added_by: 'p2', adder: { first_name: 'Lucía' } }),
  ],
})

test('the supervisor follows an activador’s day, read only, in the activador’s order', async ({ page }, info) => {
  await installFakeSupabase(page, luciaDay(), 'supervisor')
  await page.goto('/s/today')
  await page.getByRole('link', { name: /Lucía Gómez/ }).filter({ visible: true }).first().click()

  await expect(page.getByRole('heading', { name: 'Jornada de Lucía Gómez' })).toBeVisible()
  await expect(page.getByText(/solo vista/)).toBeVisible()
  await expect(page.getByText(/1\s*de 4 con resultado/)).toBeVisible()

  const list = page.getByRole('region', { name: 'Locales de Lucía en su orden' })
  const text = await list.innerText()
  const order = ['Tres Arroyos 762', 'Juramento 2101', 'Cuba 1940', 'Moldes 1365'].map((a) => text.indexOf(a))
  expect(order.every((p) => p >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  await expect(list.getByText('Ahora acá')).toBeVisible()
  await expect(list.getByText('Sigue')).toBeVisible()
  await expect(list.getByText('Extra · Agregada por Lucía')).toBeVisible()

  // Nothing to start or change from here: a finished visit opens to review it, the rest open
  // the store in the directory (and come back here).
  await expect(page.getByRole('button', { name: /Llegué|Empezar|Agregar/ })).toHaveCount(0)
  await expect(list.getByRole('link')).toHaveCount(4)
  await expect(list.getByRole('link', { name: /Tres Arroyos 762/ })).toHaveAttribute('href', /^\/review\/v1\?from=/)
  await list.getByRole('link', { name: /Cuba 1940/ }).click()
  await expect(page).toHaveURL(/\/stores\/s-v3\?from=/)
  await expect(page.getByRole('heading', { name: 'Cuba 1940' })).toBeVisible()
  await page.getByRole('link', { name: 'La jornada' }).click()
  await expect(page.getByRole('heading', { name: 'Jornada de Lucía Gómez' })).toBeVisible()

  // A finished visit opens its review; going back returns to the day, not to the inbox.
  await list.getByRole('link', { name: /Tres Arroyos 762/ }).click()
  await expect(page).toHaveURL(/\/review\/v1\?from=/)
  await page.getByRole('link', { name: /La jornada/ }).filter({ visible: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Jornada de Lucía Gómez' })).toBeVisible()

  await page.getByRole('radio', { name: /Por hacer/ }).click()
  await expect(list.getByText('Tres Arroyos 762')).toHaveCount(0)
  await expect(list.getByText('Cuba 1940')).toBeVisible()
  await page.screenshot({ path: `test-results/member-day-${info.project.name}.png`, fullPage: true })
})

test('a day not yet built says so and points to assigning it', async ({ page }) => {
  const state = luciaDay()
  state.workdays = []
  state.visits = []
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/today/p2')
  await expect(page.getByText('Lucía no tiene jornada hoy.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Armarle la jornada' })).toBeVisible()
})

test('adding a store someone else already has that day warns before adding it', async ({ page }, info) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: TODAY, status: 'published', created_by: 'p1' },
    visits: [],
    uploads: [],
    stores: [{ id: 's9', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', customer_number: '20577' }],
    overlaps: [
      { store_id: 's9', address: 'Moldes 1365', merchandiser_first: 'Lucía', merchandiser_last: 'Gómez', added_by_first: 'Martín' },
      { store_id: 's-x', address: 'Cuba 1940', merchandiser_first: 'Diego', merchandiser_last: 'Paz', added_by_first: 'Diego', added_by_merchandiser: true, work_status: 'done' },
    ],
  }
  await installFakeSupabase(page, state)
  await page.goto(`/s/workday?date=${TODAY}`)
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })

  // From the directory: the note is under the result, before tapping it.
  await sheet.getByLabel('Buscar en el directorio').fill('lili')
  await expect(sheet.getByText('Lucía G. ya lo tiene en su jornada de hoy, asignado por Martín.')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Autoservicio Lili/ })).toHaveAccessibleDescription(/Lucía G\./)

  // A new store typed by hand: the same address written another way.
  await sheet.getByLabel('Dirección').fill('cuba  1940')
  await expect(sheet.getByText('Diego P. ya lo tiene en su jornada de hoy, lo sumó por su cuenta y ya lo visitó.')).toBeVisible()
  await page.screenshot({ path: `test-results/overlap-one-${info.project.name}.png` })

  // Pasted lines: one banner names which ones.
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill('Moldes 1365\nVidal 2044')
  await expect(sheet.getByText('Una dirección ya está en otra jornada')).toBeVisible()
  await expect(sheet.getByText(/Moldes 1365: Lucía G\. ya lo tiene/)).toBeVisible()
  await page.screenshot({ path: `test-results/overlap-many-${info.project.name}.png` })

  // It is a heads-up: adding still works.
  await sheet.getByRole('button', { name: 'Agregar 2 direcciones' }).click()
  await expect.poll(() => state.visits.length).toBe(2)
})

test('the supervisor assigning a day sees who else already has the store', async ({ page }) => {
  const state = luciaDay()
  state.workdays = []
  state.visits = []
  state.stores = [{ id: 's9', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', customer_number: '20577' }]
  state.overlaps = [{ store_id: 's9', address: 'Moldes 1365', merchandiser_first: 'Diego', merchandiser_last: 'Paz', added_by_first: 'Diego', added_by_merchandiser: true }]
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/assign?date=2026-10-16')
  await page.getByRole('button', { name: 'Agregar locales' }).click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a la jornada de Lucía' })
  await sheet.getByLabel('Buscar en el directorio').fill('lili')
  await expect(sheet.getByText('Diego P. ya lo tiene en su jornada de ese día, lo sumó por su cuenta.')).toBeVisible()
})

/** A blank street style, so the real map draws without the tile server. */
async function blankStreets(page: import('@playwright/test').Page) {
  await page.route('https://tiles.openfreemap.org/**', (r) => r.fulfill({ json: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef0ea' } }] } }))
}

test('the supervisor sees where the activador is, live, with the path they walked, and the map follows them', async ({ page }, info) => {
  const s = luciaDay()
  const at = (time: string) => `${TODAY}T${time}:00-03:00`
  s.positions = [
    { device_id: 'a', lat: -34.565, lng: -58.452, accuracy: 10, recorded_at: at('11:50') },
    { device_id: 'a', lat: -34.566, lng: -58.451, accuracy: 12, recorded_at: at('11:55') },
    { device_id: 'b', lat: -34.6, lng: -58.4, accuracy: 15, recorded_at: at('11:57') },
    { device_id: 'a', lat: -34.567, lng: -58.45, accuracy: 9, recorded_at: at('11:58') },
  ]
  await blankStreets(page)
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/today/p2')
  await expect(page.getByText('Ubicación de Lucía: hace 2 min · en Juramento 2101 · también conectado desde otro teléfono')).toBeVisible()
  // Out today: the map opens by itself, even on a phone, following her.
  const following = page.getByRole('button', { name: 'Siguiendo a Lucía' })
  // The map takes a moment to draw (WebGL in software on the test machine).
  await expect(following).toBeVisible({ timeout: 20_000 })
  await expect(following).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('img', { name: 'Lucía, hace 2 min' })).toBeVisible()
  await page.screenshot({ path: `test-results/member-live-${info.project.name}.png`, fullPage: true })

  // Moving the map by hand stops following; the button brings it back.
  const map = page.getByRole('region', { name: 'Mapa del recorrido' })
  await map.scrollIntoViewIfNeeded()
  const box = await map.boundingBox()
  if (!box) throw new Error('no map')
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  if (info.project.name === 'mobile') {
    // On a phone the map moves with two fingers (one scrolls the page).
    const cdp = await page.context().newCDPSession(page)
    const fingers = (dx: number) => [{ x: x - 30 + dx, y, id: 1 }, { x: x + 30 + dx, y, id: 2 }]
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(0) })
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(-15 * i) })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } else {
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - 120, y - 40, { steps: 8 })
    await page.mouse.up()
  }
  const center = page.getByRole('button', { name: 'Centrar en Lucía' })
  await expect(center).toHaveAttribute('aria-pressed', 'false')
  await center.click()
  await expect(page.getByRole('button', { name: 'Siguiendo a Lucía' })).toBeVisible({ timeout: 10_000 })
})

test('with the app closed between stops, the supervisor sees where they are headed and since when', async ({ page }, info) => {
  const s = luciaDay()
  const located = (lat: number) => ({ id: `s-${lat}`, name: null, area: 'Belgrano', customer_number: null, lat, lng: -58.45, location_status: 'verified' })
  s.visits = [
    visitRow('v1', 0, 'Tres Arroyos 762', { ...ofLucia, work_status: 'done', arrived_at: `${TODAY}T10:02:00-03:00`, finished_at: `${TODAY}T10:40:00-03:00`, store: { ...located(-34.56), address: 'Tres Arroyos 762' } }),
    visitRow('v2', 1, 'Juramento 2101', { ...ofLucia, work_status: 'done', arrived_at: `${TODAY}T11:05:00-03:00`, finished_at: `${TODAY}T11:40:00-03:00`, store: { ...located(-34.565), address: 'Juramento 2101' } }),
    visitRow('v3', 2, 'Cuba 1940', { ...ofLucia, store: { ...located(-34.575), address: 'Cuba 1940' } }),
  ]
  // The phone sent at the first store only; then the app stayed closed.
  s.positions = [{ device_id: 'a', lat: -34.5601, lng: -58.4501, accuracy: 10, recorded_at: `${TODAY}T10:10:00-03:00` }]
  await blankStreets(page)
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/today/p2')
  await expect(page.getByText('En camino a Cuba 1940 · salió de Juramento 2101 hace 20 min')).toBeVisible()
  // On the map: at the last stop they left, greyed, following.
  await expect(page.getByRole('img', { name: 'Lucía, hace 20 min' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Siguiendo a Lucía' })).toBeVisible({ timeout: 20_000 })
  await page.screenshot({ path: `test-results/member-between-${info.project.name}.png`, fullPage: true })
})

test('at a stop with the phone silent, the supervisor sees which one and since when', async ({ page }) => {
  await installFakeSupabase(page, luciaDay(), 'supervisor')
  await page.goto('/s/today/p2')
  await expect(page.getByText('Lucía está en Juramento 2101 desde las 11:05')).toBeVisible()
})

test('before the day starts, the supervisor is told the position comes with the first stop', async ({ page }) => {
  const s = luciaDay()
  s.visits = s.visits.map((v) => ({ ...v, work_status: 'pending', arrived_at: null, finished_at: null }))
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/today/p2')
  await expect(page.getByText('Lucía todavía no empezó la jornada. Su ubicación aparece cuando llega al primer local.')).toBeVisible()
})
