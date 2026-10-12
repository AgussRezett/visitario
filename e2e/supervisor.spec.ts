import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const lucia = { id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }
const diego = { id: 'p3', first_name: 'Diego', last_name: 'Paz' }

const finished = (id: string, order: number, address: string, extra = {}) =>
  visitRow(id, order, address, {
    merchandiser_id: 'p2', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' }, work_date: TODAY,
    work_status: 'done', consent: 'yes', arrived_at: `${TODAY}T14:12:00-03:00`, finished_at: `${TODAY}T14:58:00-03:00`,
    display: [{ id: `d-${id}`, display_type_id: 1, reference: null, source: 'assigned', sort_order: 0, deleted_at: null }],
    ...extra,
  })

const team = (): FakeState => ({
  workday: null,
  visits: [finished('v1', 0, 'Tres Arroyos 762'), finished('v2', 1, 'Juramento 2101'), finished('v3', 2, 'Cuba 1940', { review_status: 'approved' })],
  uploads: [],
  memberships: supervisor,
  people: [lucia, { ...diego, last_activity_at: new Date(Date.now() - 75 * 60_000).toISOString(), last_place: 'Olazábal 1550', sync_pending: 7, sync_photos: 2, sync_reported_at: new Date().toISOString() }],
  workdays: [{ id: 'w-p3', company_id: 'c1', merchandiser_id: 'p3', work_date: TODAY, status: 'published' }],
})

test('the supervisor reviews: a fix needs a comment, approving moves to the next one', async ({ page }, info) => {
  const state = team()
  state.visits.push(visitRow('vd', 0, 'Olazábal 1550', { merchandiser_id: 'p3', workday_id: 'w-p3', work_date: TODAY }))
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/review')
  await expect(page.getByRole('radio', { name: 'Por revisar · 2' })).toBeVisible()

  const desktop = info.project.name === 'desktop'
  if (!desktop) await page.getByRole('link', { name: /Tres Arroyos 762/ }).click()
  const fix = page.getByRole('button', { name: 'Pedir corrección' })
  await expect(fix).toBeDisabled() // a fix request needs words
  await page.getByLabel('Comentario para Lucía').fill('Falta el después de la puntera')
  await page.getByLabel('Sobre').selectOption({ label: '1 Puntera' })
  await page.screenshot({ path: `test-results/review-${info.project.name}.png`, fullPage: !desktop })
  await fix.click()
  await expect.poll(() => state.visits.find((v) => v.id === 'v1')?.review_status).toBe('needs_fix')
  expect(state.comments?.[0]).toMatchObject({ visit_id: 'v1', display_id: 'd-v1', body: 'Falta el después de la puntera' })

  // Next one: Juramento 2101
  if (desktop) await expect(page.getByRole('heading', { name: 'Juramento 2101' })).toBeVisible()
  else await expect(page.getByText('Juramento 2101').first()).toBeVisible()
  await page.getByRole('button', { name: 'Aprobar y seguir' }).click()
  await expect.poll(() => state.visits.find((v) => v.id === 'v2')?.review_status).toBe('approved')
})

test('the team day: progress, what waits for review and who needs attention', async ({ page }, info) => {
  const state = team()
  state.visits.push(visitRow('vd', 0, 'Olazábal 1550', { merchandiser_id: 'p3', workday_id: 'w-p3', work_date: TODAY }))
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/today')
  await expect(page.getByRole('heading', { name: 'Hoy en el equipo' })).toBeVisible()
  await expect(page.getByText(/Diego · sin actividad 1 h 15 min/)).toBeVisible()
  await expect(page.getByRole('link', { name: /Juramento 2101/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Revisión' }).filter({ visible: true }).getByText('2')).toBeVisible() // badge
  await page.screenshot({ path: `test-results/today-${info.project.name}.png`, fullPage: true })
})

test('assigning: plan a day, add a store, publish', async ({ page }, info) => {
  const state = team()
  state.people = [lucia]
  await installFakeSupabase(page, state, 'supervisor')
  const friday = '2026-10-16'
  await page.goto(`/s/assign?date=${friday}`)
  await expect(page.getByText('Lucía todavía no tiene jornada')).toBeVisible()
  await expect(page.getByRole('button', { name: /Nada para publicar/ }).filter({ visible: true })).toBeDisabled()

  await page.getByRole('button', { name: 'Agregar locales' }).click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a la jornada de Lucía' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill('Moldes 1365')
  await sheet.getByRole('button', { name: 'Agregar 1 dirección' }).click()
  await expect.poll(() => state.visits.some((v) => v.workday_id === `w-p2-${friday}`)).toBe(true)
  await page.keyboard.press('Escape')

  await expect(page.getByText('Locales de Lucía · 1')).toBeVisible()
  await page.screenshot({ path: `test-results/assign-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Publicar a 1 activador' }).filter({ visible: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publicar' }).click()
  await expect.poll(() => state.workdays?.find((w) => w.merchandiser_id === 'p2')?.status).toBe('published')
})

test('the merchandiser sees the fix, answers and sends it back', async ({ page }, info) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: TODAY, status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Juramento 2101', { work_date: TODAY, work_status: 'done', consent: 'yes', review_status: 'needs_fix', finished_at: `${TODAY}T11:40:00-03:00`, photo: [{ id: 'f1', kind: 'storefront', display_id: null, taken_at: `${TODAY}T11:20:00-03:00`, uploaded_at: `${TODAY}T11:20:00-03:00`, deleted_at: null }] })],
    uploads: [],
    comments: [{ id: 'c1', visit_id: 'v1', display_id: null, author_id: 'p9', kind: 'fix_request', body: 'Falta la foto del después de la isla.', created_at: `${TODAY}T12:05:00-03:00`, author: { first_name: 'Martín', last_name: 'Sosa' } }],
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await expect(page.getByText('Te pidieron una corrección')).toBeVisible()
  await page.getByRole('link', { name: 'Juramento 2101' }).first().click()

  await expect(page.getByText('Martín pidió una corrección')).toBeVisible()
  await expect(page.getByText('Falta la foto del después de la isla.')).toBeVisible()
  await page.getByLabel('Mensaje', { exact: true }).fill('Ahora la saco, sigo en la zona.')
  await page.getByRole('button', { name: 'Enviar', exact: true }).click()
  await page.getByRole('button', { name: 'Reenviar al supervisor' }).click()
  await expect(page.getByText('Reenviada: esperando la revisión.')).toBeVisible()
  await page.screenshot({ path: `test-results/correction-${info.project.name}.png`, fullPage: info.project.name === 'desktop' })
  await expect.poll(() => state.comments?.some((c) => c.body === 'Ahora la saco, sigo en la zona.' && c.kind === 'reply')).toBe(true)
  await expect.poll(() => state.visits[0]?.review_status).toBe('unreviewed')
})
