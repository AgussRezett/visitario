import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const directory = (): FakeState => ({
  workday: null,
  uploads: [],
  memberships: supervisor,
  stores: [
    { id: 's1', name: 'Mas Ahorro', address: 'Tres Arroyos 762', area: 'Paternal', customer_number: null, location_status: 'verified', lat: -34.6, lng: -58.47, source: 'imported', created_by_name: 'Martín', last_visit_date: '2026-10-09', visits_30d: 2 },
    { id: 's2', name: null, address: 'Tres Arroyos 762 PB', area: null, customer_number: '12345', location_status: 'unverified', source: 'merchandiser', created_by_name: 'Agus' },
    { id: 's3', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', customer_number: '20577', location_status: 'verified', source: 'manual' },
  ],
  visits: [
    visitRow('v1', 0, 'Tres Arroyos 762', { store_id: 's1', work_date: '2026-10-09', work_status: 'done', review_status: 'approved', arrived_at: '2026-10-09T14:12:00Z', finished_at: '2026-10-09T14:58:00Z', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' } }),
    visitRow('v2', 0, 'Tres Arroyos 762 PB', { store_id: 's2', work_date: '2026-10-02', work_status: 'done' }),
  ],
})

test('the directory: search, filters, a store and merging its duplicate', async ({ page }, info) => {
  const state = directory()
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/stores')
  await expect(page.getByRole('heading', { name: 'Directorio · 3 comercios' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Mas Ahorro/ })).toBeVisible()
  await page.screenshot({ path: `test-results/directory-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: /Sin ubicación · 1/ }).click()
  await expect(page.getByRole('link', { name: /Mas Ahorro/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Tres Arroyos 762 PB/ })).toBeVisible()
  await page.getByRole('button', { name: /Sin ubicación · 1/ }).click()

  await page.getByRole('link', { name: /Mas Ahorro/ }).click()
  await expect(page.getByRole('heading', { name: 'Mas Ahorro', level: 1 })).toBeVisible()
  await expect(page.getByText('Importado el 01/10')).toBeVisible()
  await expect(page.getByText('46 min')).toBeVisible()
  await page.screenshot({ path: `test-results/store-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: /^Fusionar/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Fusionar duplicado' })
  await sheet.getByRole('button', { name: /Tres Arroyos 762 PB/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Fusionar' }).click()
  await expect.poll(() => state.stores?.find((x) => x.id === 's2')?.deleted_at).toBeTruthy()
  expect(state.visits.find((v) => v.id === 'v2')?.store_id).toBe('s1')
  expect(state.stores?.find((x) => x.id === 's1')?.customer_number).toBe('12345')

  await page.getByRole('button', { name: 'Editar datos' }).click()
  await page.getByRole('dialog', { name: 'Editar datos' }).getByLabel('Zona').fill('La Paternal')
  await page.getByRole('dialog', { name: 'Editar datos' }).getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => state.stores?.find((x) => x.id === 's1')?.area).toBe('La Paternal')
})

test('a store found only by its street: Maps searches the address, and the exact place can be pasted by hand', async ({ page }) => {
  const state: FakeState = {
    ...directory(),
    stores: [{ id: 's9', name: null, address: 'Gral. José Gervasio Artigas 4965', area: 'Villa Urquiza 2', customer_number: '422', location_status: 'unverified', lat: null, lng: null, source: 'merchandiser', created_by_name: 'Agustin' }],
    visits: [],
    // The geocoder knows the street but not the number: a point somewhere on Artigas.
    geocode: { 'Gral. José Gervasio Artigas 4965': { label: 'Artigas, Villa Pueyrredón', address: 'Artigas', area: 'Villa Pueyrredón', lat: -34.5801, lng: -58.5002, exact: false } },
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/stores/s9')

  const maps = page.getByRole('link', { name: 'Abrir en Maps' })
  expect(new URL(String(await maps.getAttribute('href'))).searchParams.get('query')).toBe('Gral. José Gervasio Artigas 4965, Buenos Aires, Argentina')

  await page.getByRole('button', { name: 'Verificar dirección' }).click()
  await expect(page.getByText(/Encontramos la calle pero no la altura/)).toBeVisible()
  expect(state.stores?.[0]).toMatchObject({ location_status: 'approximate', area: 'Villa Urquiza 2' })

  await page.getByRole('button', { name: 'Editar datos' }).click()
  const sheet = page.getByRole('dialog', { name: 'Editar datos' })
  await sheet.getByLabel('Ubicación exacta').fill('Artigas 4965')
  await expect(sheet.getByText(/No encontramos coordenadas ahí/)).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Guardar' })).toBeDisabled()
  await sheet.getByLabel('Ubicación exacta').fill('https://www.google.com/maps/place/Artigas+4965/@-34.5870,-58.4950,17z/data=!3d-34.5878425!4d-58.4936994')
  await expect(sheet.getByText('Se guarda en -34.58784, -58.49370 como verificada.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => state.stores?.[0]?.location_status).toBe('verified')
  expect(state.stores?.[0]).toMatchObject({ lat: -34.5878425, lng: -58.4936994 })
})

test('a pending visit resumed the next day shows once in the history, done', async ({ page }, info) => {
  await atFakeToday(page)
  const state: FakeState = {
    ...directory(),
    visits: [
      visitRow('v8', 0, 'Arce 552', { store_id: 's3', work_date: '2026-10-08', source: 'assigned' }),
      visitRow('v9', 0, 'Arce 552', { store_id: 's3', work_date: '2026-10-09', source: 'assigned', resumed_from: 'v8', work_status: 'done', review_status: 'approved', arrived_at: '2026-10-09T14:00:00Z', finished_at: '2026-10-09T14:30:00Z' }),
    ],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/stores/s3')
  const history = info.project.name === 'desktop' ? page.getByRole('table', { name: 'Visitas del comercio' }).locator('tbody tr') : page.getByRole('listitem').filter({ hasText: '·' })
  await expect(history).toHaveCount(1)
  await expect(history.first()).toContainText('retomada del 08/10')
  await expect(page.getByText('Pendiente')).toHaveCount(0)
  await expect(page.getByText('visitas en 30 días')).toContainText('1')
})

test('archiving takes a store out of the open days; once archived it can be removed for good; nothing scrolls sideways', async ({ page }, info) => {
  const state = directory()
  state.openStops = { s3: 2 }
  await installFakeSupabase(page, state, 'supervisor')
  const lili = () => state.stores?.find((x) => x.id === 's3')
  const noSideScroll = async () => {
    const widths = await page.evaluate(() => Array.from(document.querySelectorAll('main, main *')).filter((el) => el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'hidden' && getComputedStyle(el).overflowX !== 'visible').map((el) => el.className))
    expect(widths).toEqual([])
  }
  const confirm = page.getByRole('alertdialog')

  if (info.project.name === 'desktop') {
    await page.goto('/s/stores')
    await page.getByRole('row', { name: /Autoservicio Lili/ }).getByRole('button', { name: 'Archivar' }).click()
    await expect(confirm).toContainText('Tiene 2 paradas pendientes en jornadas de hoy en adelante: se quitan de esas jornadas.')
    await confirm.getByRole('button', { name: 'Archivar' }).click()
    await expect.poll(() => lili()?.deleted_at).toBeTruthy()
    await expect(page.getByRole('link', { name: /Autoservicio Lili/ })).toHaveCount(0)
    await page.getByRole('button', { name: 'Archivados · 1' }).click()
    await page.getByRole('row', { name: /Autoservicio Lili/ }).getByRole('button', { name: 'Restaurar' }).click()
    await expect.poll(() => lili()?.deleted_at).toBeNull()

    state.openStops = {}
    await page.getByRole('button', { name: /^Archivados/ }).click()
    await page.getByRole('row', { name: /Autoservicio Lili/ }).getByRole('button', { name: 'Archivar' }).click()
    await expect(confirm).not.toContainText('paradas pendientes')
    await confirm.getByRole('button', { name: 'Archivar' }).click()
    await page.getByRole('button', { name: 'Archivados · 1' }).click()
    await page.getByRole('row', { name: /Autoservicio Lili/ }).getByRole('button', { name: 'Eliminar' }).click()
    await expect(confirm).toContainText('no se puede restaurar')
    await confirm.getByRole('button', { name: 'Eliminar' }).click()
    await expect.poll(() => lili()?.removed_at).toBeTruthy()
    await expect(page.getByText('No hay comercios archivados.')).toBeVisible()
    await page.screenshot({ path: 'test-results/store-removed-desktop.png', fullPage: true })
    return
  }

  await page.goto('/s/stores')
  await expect(page.getByRole('link', { name: /Mas Ahorro/ })).toBeVisible()
  await noSideScroll()
  await page.getByRole('link', { name: /Autoservicio Lili/ }).click()
  await expect(page).toHaveTitle('Autoservicio Lili · Visitario')
  await noSideScroll()
  await page.getByRole('button', { name: 'Archivar comercio' }).click()
  await expect(confirm).toContainText('Tiene 2 paradas pendientes')
  await confirm.getByRole('button', { name: 'Archivar' }).click()
  await expect(page.getByText(/^Archivado el/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Editar datos' })).toHaveCount(0)
  await noSideScroll()
  await page.screenshot({ path: 'test-results/store-archived-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Restaurar' }).click()
  await expect(page.getByText(/^Archivado el/)).toHaveCount(0)
  expect(lili()?.deleted_at).toBeNull()

  await page.getByRole('button', { name: 'Archivar comercio' }).click()
  await confirm.getByRole('button', { name: 'Archivar' }).click()
  await page.getByRole('button', { name: 'Eliminar' }).click()
  await confirm.getByRole('button', { name: 'Eliminar' }).click()
  await expect(page.getByText(/^Eliminado el/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Restaurar' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Archivar comercio' })).toHaveCount(0)
  await page.screenshot({ path: 'test-results/store-removed-mobile.png', fullPage: true })
  await page.getByRole('link', { name: 'Directorio' }).first().click()
  await expect(page).toHaveTitle('Visitario')
})
