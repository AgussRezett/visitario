import { expect, test } from '@playwright/test'
import { pick } from './support/select'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

// A deck like the ones that arrive (made up): a cover, then a slide or two per store.
const PAGES = ['LOCALES DE VISITA PALERMO', 'Gorriti 4100 #120\n03/10', 'Gorriti 4100 #120\n03/10', 'Honduras 3900 #4471\n03/10', 'Av. Santa Fe 3200 #118\n03/10']
const PDF = { name: 'presentacion_visita.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') }
const SELLERS = [{ id: 1, name: 'Ana Lo', active: true, person_id: null }, { id: 2, name: 'Beto Su', active: true, person_id: null }]
// The AI's reading, out of order and with one address that is not in the PDF: the app fixes the order and drops it.
const reading = (extra: Record<string, unknown> = {}) => ({
  stops: [
    { page: 5, address: 'Av. Santa Fe 3200', ref: '#118', seller_id: 2 },
    { page: 2, address: 'Gorriti 4100', ref: '#120', seller_id: 1 },
    { page: 3, address: 'Gorriti 4100', ref: '#120', seller_id: 1 },
    { page: 4, address: 'Honduras 3900', ref: '#4471', seller_id: 1 },
    { page: 4, address: 'Charcas 9999', ref: '', seller_id: 1 },
  ],
  task: 'Avisar si falta algo y ordenar como en el PDF',
  ...extra,
})
const indications = 'mañana hacé estos. todos son de ana, menos santa fe que es de beto. avisame si falta algo y ordená como en el pdf'

test('the merchandiser reads a PDF with indications: the PDF order, each seller, each task', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [],
    catalogs: { display_type: [], channel: [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }], seller: SELLERS },
    brief: { pages: PAGES, brief: reading({ date: '2026-10-13' }) },
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Elegir el PDF').setInputFiles(PDF)
  await sheet.getByLabel('Indicaciones', { exact: true }).fill(indications)
  await sheet.getByRole('button', { name: 'Leer el PDF' }).click()

  await expect(sheet.getByLabel('Direcciones')).toHaveValue('Gorriti 4100 @Ana Lo\nHonduras 3900 @Ana Lo\nAv. Santa Fe 3200 @Beto Su')
  const understood = sheet.getByRole('list', { name: 'Lo que entendimos' })
  await expect(understood).toContainText('3 locales, en el orden del PDF')
  await expect(understood).toContainText('Ana Lo: 2')
  await expect(sheet.getByText('Una dirección no está escrita así en el PDF: la dejamos afuera.', { exact: false })).toBeVisible()
  // The indications speak of tomorrow; this is today's day.
  await expect(sheet.getByText(/Las indicaciones hablan del martes 13 de octubre/)).toBeVisible()
  await expect(sheet.getByText('Te quedan 29 usos de IA hoy.')).toBeVisible()
  await page.screenshot({ path: `test-results/pdf-brief-${info.project.name}.png` })

  await pick(sheet.getByLabel('Canal de los que no lo indican'), 'Autoservicio')
  await sheet.getByRole('button', { name: 'Agregar 3 direcciones' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits.map((v) => v.task)).toEqual([
    'Avisar si falta algo y ordenar como en el PDF · PDF págs. 2 y 3 · #120',
    'Avisar si falta algo y ordenar como en el PDF · PDF pág. 4 · #4471',
    'Avisar si falta algo y ordenar como en el PDF · PDF pág. 5 · #118',
  ])
})

test('the supervisor imports a PDF with indications: for whom and which day, from what was written', async ({ page }) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], workdays: [], stores: [],
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
    people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }, { id: 'p3', first_name: 'Diego', last_name: 'Paz' }],
    catalogs: { display_type: [], channel: [], seller: SELLERS },
    brief: { pages: PAGES, brief: reading({ date: '2026-10-16', merchandiser: 'Diego' }) },
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/import')
  await page.getByLabel('Elegir el PDF').setInputFiles(PDF)
  await page.getByLabel('Indicaciones', { exact: true }).fill(`El viernes Diego ${indications}`)
  await page.getByRole('button', { name: 'Leer el PDF' }).click()

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Lo que entendimos' })).toContainText('Para: Diego Paz')
  await expect(page.getByText('vend. Beto Su')).toBeVisible()
  await page.getByRole('button', { name: /^Agregar 3/ }).click()
  await expect(page.getByText(/Se agregaron 3 locales/)).toBeVisible()
  // In the PDF's order, for Diego, on the day the indications said.
  expect((state.stores ?? []).map((s) => s.address)).toEqual(['Gorriti 4100', 'Honduras 3900', 'Av. Santa Fe 3200'])
  expect(state.visits.map((v) => [v.store_id, v.merchandiser_id, v.work_date])).toEqual((state.stores ?? []).map((s) => [s.id, 'p3', '2026-10-16']))
  expect(state.visits[0]?.task).toBe('Avisar si falta algo y ordenar como en el PDF · PDF págs. 2 y 3 · #120')
})
