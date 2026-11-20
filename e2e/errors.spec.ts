import { expect, test, type Page, type Request } from '@playwright/test'
import { installFakeSupabase, type FakeState } from './support/fake-supabase'

const role = (r: string) => [{ id: 'm1', company_id: 'c1', roles: [r], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const mapState = (): FakeState => ({
  workday: null, visits: [], uploads: [], memberships: role('supervisor'),
  catalogs: { channel: [], seller: [] },
  mapPoints: [{ id: 's1', name: null, address: 'Calle 1', area: 'Belgrano', customer_number: null, lat: -34.56, lng: -58.46, location_status: 'verified', channel_id: null, seller_id: null, last_visit_date: null, last_visit_status: null, last_merchandiser: null, visits_30d: 0, visits_90d: 0, rapport: null, display_types: [] }],
})

/** Reports sent to Visitario, as the function received them. */
async function catchReports(page: Page) {
  const sent: Record<string, unknown>[] = []
  await page.route('**/functions/v1/report-error', async (r) => {
    sent.push(r.request().postDataJSON() as Record<string, unknown>)
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'r1', emailed: true }) })
  })
  return sent
}

test('a screen that breaks says so in Spanish, keeps the app around it, and the person can report it', async ({ page }, info) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  // The whole map screen's code fails when it runs.
  await page.route('**/assets/s.map-*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "throw new Error('Mapa roto de prueba')" }))
  const sent = await catchReports(page)
  await page.goto('/s/map')

  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toBeVisible()
  await expect(page.getByText('Something went wrong')).toHaveCount(0)
  await expect(page.getByText('Lo que cargaste y lo que falta enviar sigue guardado')).toBeVisible()
  // Inside the app: the navigation is still there.
  await expect(page.getByRole('link', { name: 'Directorio' }).first()).toBeVisible()
  await page.screenshot({ path: `test-results/error-screen-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Reportar el problema' }).click()
  await page.getByLabel('¿Qué estabas haciendo? (opcional)').fill('Abrí el mapa de puntos')
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(page.getByText('Listo, nos llegó el reporte. Gracias por avisar.')).toBeVisible()
  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({ kind: 'crash', comment: 'Abrí el mapa de puntos', url: '/s/map', companyId: 'c1' })
  expect(String(sent[0]?.message)).toContain('Mapa roto de prueba')
  expect(String(sent[0]?.appVersion)).toMatch(/^\d+\.\d+\.\d+$/)
})

test('a report that cannot go out says so and can be sent again', async ({ page }) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  await page.route('**/assets/s.map-*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "throw new Error('Mapa roto de prueba')" }))
  let tries = 0
  await page.route('**/functions/v1/report-error', (r) => (tries++ === 0
    ? r.fulfill({ status: 500, body: '{"error":"failed"}' })
    : r.fulfill({ contentType: 'application/json', body: '{"id":"r1","emailed":true}' })))
  await page.goto('/s/map')
  await page.getByRole('button', { name: 'Reportar el problema' }).click()
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(page.getByText('No se pudo enviar. Revisá la conexión y probá de nuevo.')).toBeVisible()
  await page.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(page.getByText('Listo, nos llegó el reporte.', { exact: false })).toBeVisible()
})

test('an old version asking for code that is gone reloads once, then asks to reload', async ({ page }) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  await page.route('**/assets/s.map-*.js', (r) => r.abort())
  let loads = 0
  page.on('request', (req: Request) => { if (req.isNavigationRequest() && req.url().includes('/s/map')) loads++ })
  await page.goto('/s/map')
  await expect(page.getByRole('heading', { name: 'Hay una versión nueva' })).toBeVisible()
  // It reloads to get the new version (the router may too), but never in a loop.
  await page.waitForTimeout(1500)
  expect(loads).toBeGreaterThan(1)
  expect(loads).toBeLessThanOrEqual(3)
  await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible()
})

test('when only a part breaks (the map), only that part says so: the screen keeps working', async ({ page }, info) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  await page.route('**/assets/PointsMap-*.js', (r) => r.fulfill({ contentType: 'text/javascript', body: "throw new Error('Mapa roto de prueba')" }))
  const sent = await catchReports(page)
  await page.goto('/s/map')
  await expect(page.getByText('No pudimos mostrar el mapa. El resto de la pantalla sigue funcionando.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Mapa de puntos de venta' })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Última visita' })).toBeVisible()
  await page.screenshot({ path: `test-results/error-local-${info.project.name}.png` })
  await page.getByRole('button', { name: 'Reportar', exact: true }).click()
  await expect(page.getByText('Reporte enviado. Gracias.')).toBeVisible()
  expect(sent[0]).toMatchObject({ kind: 'crash', url: '/s/map' })
  expect(String(sent[0]?.comment)).toContain('Falló el mapa')
})

test('without signal a screen that cannot open says so, with nothing to report', async ({ page, context }) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  await page.goto('/profile')
  await expect(page.getByRole('button', { name: 'Reportar un problema' })).toBeVisible()
  await context.setOffline(true)
  // Going to a screen whose code is not on the phone yet.
  await page.evaluate(() => { history.pushState({}, '', '/s/map'); dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page.getByRole('heading', { name: 'Sin conexión' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reportar el problema' })).toHaveCount(0)
  await context.setOffline(false)
})

test('anyone can report a problem from their profile', async ({ page }) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  const sent = await catchReports(page)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Reportar un problema' }).click()
  const sheet = page.getByRole('dialog', { name: 'Reportar un problema' })
  await expect(sheet.getByRole('button', { name: 'Enviar reporte' })).toBeDisabled()
  await sheet.getByLabel('Contanos qué pasó').fill('No me deja descartar la jornada\nAparece un error rojo')
  await sheet.getByRole('button', { name: 'Enviar reporte' }).click()
  await expect(sheet.getByText('Listo, nos llegó el reporte.', { exact: false })).toBeVisible()
  expect(sent[0]).toMatchObject({ kind: 'manual', message: 'No me deja descartar la jornada', url: '/profile' })
})

test('a link to a screen that does not exist says so in Spanish', async ({ page }) => {
  await installFakeSupabase(page, mapState(), 'supervisor')
  await page.goto('/esto-no-existe')
  await expect(page.getByRole('heading', { name: 'No encontramos esta pantalla' })).toBeVisible()
  await expect(page.getByText('Not Found')).toHaveCount(0)
})
