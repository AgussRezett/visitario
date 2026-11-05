import { expect, test } from '@playwright/test'
import { FAKE_TODAY, atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const store = { id: 's-v1', name: 'Autoservicio Lili', address: 'Juramento 2101', area: 'Belgrano', customer_number: '1120', lat: null, lng: null, location_status: 'verified', channel_id: null, seller_id: null }
const past = visitRow('old1', 0, 'Juramento 2101', {
  work_date: '2026-09-28', work_status: 'done', consent: 'yes', review_status: 'approved', notes: 'Armé la góndola de Campari.',
  arrived_at: '2026-09-28T13:00:00Z', finished_at: '2026-09-28T13:25:00Z', merchandiser_id: 'p9', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' },
  store, display: [{ id: 'd9', display_type_id: 3, reference: null, source: 'merchandiser', sort_order: 0, deleted_at: null }],
  photo: [
    { id: 'f1', kind: 'storefront', display_id: null, taken_at: '2026-09-28T13:00:00Z', uploaded_at: '2026-09-28T13:01:00Z', deleted_at: null },
    { id: 'f2', kind: 'after', display_id: 'd9', taken_at: '2026-09-28T13:20:00Z', uploaded_at: '2026-09-28T13:21:00Z', deleted_at: null },
  ],
  metrics: [{ metric_id: 1, quantity: 6 }], brands: [],
})

const state = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: FAKE_TODAY, status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Juramento 2101', { work_date: FAKE_TODAY, store })],
  uploads: [],
  photoUrls: true,
  storeHistory: [{ id: 'old1', work_date: '2026-09-28', merchandiser: 'Lucía', work_status: 'done', consent: 'yes', review_status: 'approved', displays: 1, afters: 1 }],
  pastVisits: { old1: past },
})

test('from a visit of the day, the activador sees the store’s past visits and opens one, read only', async ({ page }, info) => {
  await page.route('https://photos.test/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) }))
  await installFakeSupabase(page, state())
  await page.goto('/visit/v1')

  const history = page.getByRole('region', { name: 'Historial del local' })
  await history.getByRole('button', { name: 'Historial del local' }).click()
  const row = history.getByRole('link', { name: /28\/09 · Lucía/ })
  await expect(row).toContainText('1 exhibición · 1 foto del después')
  await row.click()

  await expect(page).toHaveURL(/\/past\/old1\?from=%2Fvisit%2Fv1/)
  await expect(page.getByText('Armé la góndola de Campari.')).toBeVisible()
  await expect(page.getByRole('button', { name: /Ver .*después/ })).toBeVisible()
  // Read only: no review, no conversation, no way into the directory.
  await expect(page.getByLabel(/Comentario para/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Aprobar|Pedir corrección/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Ver ficha del local' })).toHaveCount(0)
  await page.screenshot({ path: `test-results/past-visit-${info.project.name}.png`, fullPage: true })

  // Back to the visit it came from.
  await page.getByRole('link', { name: /Volver: La visita|La visita/ }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/visit\/v1$/)
})

test('a visit that is not in the history of my stores says so', async ({ page }) => {
  await installFakeSupabase(page, { ...state(), pastVisits: {} })
  await page.goto('/past/otra?from=/visit/v1')
  await expect(page.getByText('Esa visita no está en el historial de tus locales.')).toBeVisible()
})
