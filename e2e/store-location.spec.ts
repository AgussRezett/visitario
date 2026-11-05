import { expect, test } from '@playwright/test'
import { FAKE_TODAY, atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

// A plain map style: the map loads without reaching OpenFreeMap.
const PLAIN_STYLE = { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#e8ebe4' } }] }

const state = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: FAKE_TODAY, status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Thames 1100', {
    work_date: FAKE_TODAY,
    store: { id: 's-v1', name: null, address: 'Thames 1100', area: 'Palermo', customer_number: null, lat: -34.5901, lng: -58.4199, location_status: 'approximate' },
  })],
  uploads: [],
  geocode: { 'Thames 1150': { label: 'Thames 1150, Palermo', address: 'Thames 1150', area: 'Palermo', lat: -34.5889, lng: -58.4301, exact: true } },
})

test('the activador checks where a store of their day landed and fixes it at the door', async ({ page, context }, info) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -34.58912, longitude: -58.43021, accuracy: 12 })
  const s = state()
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')

  await page.getByRole('button', { name: 'Revisar ubicación: Ubicación aproximada' }).click()
  const sheet = page.getByRole('dialog', { name: 'Revisar ubicación' })
  await expect(sheet.getByRole('region', { name: /Mapa para ubicar el local/ })).toBeVisible()

  // At the door: the phone's GPS puts the pin there.
  await sheet.getByRole('button', { name: 'Estoy en el local' }).click()
  await expect(sheet.getByText('Listo: el pin quedó donde estás.', { exact: false })).toBeVisible()

  // The street number was wrong too: searching it again.
  await sheet.getByLabel('Dirección').fill('Thames 1150')
  await sheet.getByRole('button', { name: 'Buscar' }).click()
  await sheet.getByRole('button', { name: /Thames 1150/ }).click()
  await page.screenshot({ path: `test-results/store-location-${info.project.name}.png` })

  await sheet.getByRole('button', { name: 'Guardar ubicación' }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => s.locationFixes?.length).toBe(1)
  expect(s.locationFixes?.[0]).toMatchObject({ p_store: 's-v1', p_lat: -34.5889, p_lng: -58.4301, p_address: 'Thames 1150' })
  await expect(page.getByRole('button', { name: 'Revisar ubicación: Ubicada' })).toBeVisible()
})

test('moving the map only looks around: the pin stays on its spot until it is dragged or the map is tapped', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  const s = state()
  s.visits[0] = { ...s.visits[0], store: { ...(s.visits[0]?.store as object), location_status: 'verified' } } as (typeof s.visits)[number]
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Revisar ubicación: Ubicada' }).click()
  const sheet = page.getByRole('dialog', { name: 'Revisar ubicación' })
  const save = sheet.getByRole('button', { name: 'Guardar ubicación' })
  await expect(save).toBeDisabled()

  const map = sheet.getByRole('region', { name: /Mapa para ubicar el local/ })
  const pin = map.getByRole('img', { name: 'Ubicación del local' })
  await expect(pin).toBeVisible()
  const box = await map.boundingBox()
  const before = await pin.boundingBox()
  if (!box || !before) throw new Error('no map')

  // Dragging the map from a corner: the pin travels with its spot, nothing to save.
  await page.mouse.move(box.x + 30, box.y + box.height - 30)
  await page.mouse.down()
  await page.mouse.move(box.x + 90, box.y + box.height - 60, { steps: 8 })
  await page.mouse.up()
  // The map follows on its next frames (slower on a busy machine).
  await expect.poll(async () => Math.round(((await pin.boundingBox())?.x ?? 0) - before.x)).toBeGreaterThan(40)
  await expect(save).toBeDisabled()

  // Dragging the pin itself moves the location, once the map stopped gliding (its inertia).
  await expect.poll(async () => {
    const a = await pin.boundingBox()
    await page.waitForTimeout(150)
    const b = await pin.boundingBox()
    return Boolean(a && b && a.x === b.x && a.y === b.y)
  }).toBe(true)
  const at = (await pin.boundingBox()) ?? before
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2)
  await page.mouse.down()
  await page.mouse.move(at.x + at.width / 2 + 40, at.y + at.height / 2 + 20, { steps: 8 })
  await page.mouse.up()
  await expect(save).toBeEnabled()
  await save.click()
  await expect.poll(() => s.locationFixes?.length).toBe(1)
  expect(s.locationFixes?.[0]?.p_lng).not.toBe(-58.4199)
  expect(s.locationFixes?.[0]?.p_address).toBeUndefined()
})

test('without a location yet, tapping the map puts the pin there', async ({ page }) => {
  await page.route('https://tiles.openfreemap.org/**', (route) => route.fulfill({ json: PLAIN_STYLE }))
  const s = state()
  s.visits[0] = { ...s.visits[0], store: { ...(s.visits[0]?.store as object), lat: null, lng: null, location_status: 'unverified' } } as (typeof s.visits)[number]
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Revisar ubicación: Sin ubicación' }).click()
  const sheet = page.getByRole('dialog', { name: 'Revisar ubicación' })
  const map = sheet.getByRole('region', { name: /Mapa para ubicar el local/ })
  await expect(map.getByRole('img', { name: 'Ubicación del local' })).toHaveCount(0)
  await expect(sheet.getByRole('button', { name: 'Guardar ubicación' })).toBeDisabled()
  await map.click({ position: { x: 120, y: 120 } })
  await expect(map.getByRole('img', { name: 'Ubicación del local' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Guardar ubicación' }).click()
  await expect.poll(() => s.locationFixes?.length).toBe(1)
})
