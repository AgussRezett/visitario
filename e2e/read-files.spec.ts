import { expect, test } from '@playwright/test'
import { pick } from './support/select'
import { readFiles } from './support/read-files'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

// A deck like the ones that arrive (made up): a cover, then a slide or two per store.
const PAGES = ['LOCALES DE VISITA PALERMO', 'Gorriti 4100 #120\n03/10', 'Gorriti 4100 #120\n03/10', 'Honduras 3900 #4471\n03/10', 'Av. Santa Fe 3200 #118\n03/10']
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
const PDF = { name: 'presentacion_visita.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') }
const SHOT = (name: string) => ({ name, mimeType: 'image/png', buffer: PIXEL })
const SELLERS = [{ id: 1, name: 'Ana Lo', active: true, person_id: null }, { id: 2, name: 'Beto Su', active: true, person_id: null }]
const CHANNELS = [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }]
// The AI's reading, out of order and with one address that is not written: the app fixes the order and drops it.
const reading = (extra: Record<string, unknown> = {}) => ({
  stops: [
    { page: 6, address: 'Thames 1500', customer_number: '564', seller_id: 1 },
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
const TASK = 'Avisar si falta algo y ordenar como en el PDF'

async function openSheet(page: import('@playwright/test').Page) {
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  return sheet
}

test('a PDF and a capture with indications, at once: the files order, each seller, each task', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [],
    catalogs: { display_type: [], channel: CHANNELS, seller: SELLERS },
    brief: { pages: PAGES, brief: reading({ date: '2026-10-13' }) },
    capture: { headers: ['COD', 'DOMICILIO'], rows: [['564', 'THAMES 1500']] },
  }
  await installFakeSupabase(page, state)
  const sheet = await openSheet(page)
  await sheet.getByLabel('Elegir archivos').setInputFiles([PDF, SHOT('captura.png')])
  await expect(sheet.getByRole('list', { name: 'Archivos elegidos' }).getByRole('listitem')).toHaveCount(2)
  await sheet.getByLabel('Indicaciones (opcional)').fill(indications)
  // One for the capture, one to read it all with the indications.
  await expect(sheet.getByText('Usa 2 usos de IA.', { exact: false })).toBeVisible()
  await page.screenshot({ path: `test-results/read-files-chosen-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Leer los 2 archivos' }).click()

  // Straight to the review, in the files' order; the deck's "#120" goes as the client number.
  const rows = sheet.getByRole('list', { name: 'Locales para agregar' }).locator(':scope > li')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0).getByLabel('Nro. de cliente')).toHaveValue('120')
  await expect(rows.nth(0).getByLabel('Dirección')).toHaveValue('Gorriti 4100')
  await expect(rows.nth(0).getByLabel('Vendedor', { exact: true })).toHaveValue('Ana Lo')
  await expect(rows.nth(2).getByLabel('Vendedor', { exact: true })).toHaveValue('Beto Su')
  await expect(rows.nth(0)).toContainText(`Tarea: ${TASK} · PDF págs. 2 y 3`)
  // The AI got every page, named, and what was written.
  expect(state.brief?.sent).toMatchObject({ text: indications, pages: [{ label: 'PDF pág. 1' }, {}, {}, {}, {}, { label: 'la captura', text: 'COD | DOMICILIO\n564 | THAMES 1500' }] })
  const understood = sheet.getByRole('list', { name: 'Lo que entendimos' })
  await expect(understood).toContainText('4 locales, en el orden de los archivos')
  await expect(understood).toContainText('Ana Lo: 3')
  await expect(sheet.getByText('Una dirección no está escrita así en el PDF: la dejamos afuera.', { exact: false })).toBeVisible()
  await expect(sheet.getByText(/Las indicaciones hablan del martes 13 de octubre/)).toBeVisible()
  await page.screenshot({ path: `test-results/read-files-${info.project.name}.png` })

  // A row fixed by hand keeps its task.
  await rows.nth(2).getByLabel('Dirección').fill('Santa Fe 3200')
  await rows.nth(2).getByLabel('Barrio').fill('Palermo')
  await pick(sheet.getByLabel('Canal de los 4 sin canal'), 'Autoservicio')
  await sheet.getByRole('button', { name: 'Agregar 4 locales' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits.map((v) => v.task)).toEqual([`${TASK} · PDF págs. 2 y 3`, `${TASK} · PDF pág. 4`, `${TASK} · PDF pág. 5`, TASK])
})

test('several captures without indications go to the review as rows, one after the other', async ({ page }) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [],
    catalogs: { display_type: [], channel: CHANNELS, seller: SELLERS },
    captures: [
      { headers: ['COD', 'DOMICILIO'], rows: [['564', 'THAMES 1500']] },
      { headers: ['DIRECCION', 'VENDEDOR'], rows: [['GORRITI 4100', 'ANA LO']] },
    ],
  }
  await installFakeSupabase(page, state)
  const sheet = await openSheet(page)
  await readFiles(sheet, [SHOT('uno.png'), SHOT('dos.png')])
  await expect(sheet.getByText(/Leímos 2 locales/)).toBeVisible()
  const rows = sheet.getByRole('list', { name: 'Locales para agregar' }).locator(':scope > li')
  await expect(rows).toHaveCount(2)
  // (The fake answers the two reads in the order they arrive; the app keeps the files' order.)
  const read = await rows.evaluateAll((lis) => lis.map((li) => Array.from(li.querySelectorAll('input'), (i) => i.value).filter(Boolean).join(' | ')))
  expect(read.sort()).toEqual(['Thames 1500 | 564', 'Gorriti 4100 | Ana Lo'].sort())
  expect(state.brief?.sent).toBeUndefined()
})

test('the supervisor imports a PDF with indications: for whom and which day, from what was written', async ({ page }) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], workdays: [], stores: [],
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
    people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }, { id: 'p3', first_name: 'Diego', last_name: 'Paz' }],
    catalogs: { display_type: [], channel: [], seller: SELLERS },
    brief: { pages: PAGES, brief: reading({ date: '2026-10-16', merchandiser: 'Diego', stops: reading().stops.slice(1) }) },
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/import')
  await readFiles(page, [PDF], `El viernes Diego ${indications}`)

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Lo que entendimos' })).toContainText('Para: Diego Paz')
  await expect(page.getByText('vend. Beto Su')).toBeVisible()
  await page.getByRole('button', { name: /^Agregar 3/ }).click()
  await expect(page.getByText(/Se agregaron 3 locales/)).toBeVisible()
  // In the PDF's order, for Diego, on the day the indications said.
  expect((state.stores ?? []).map((s) => s.address)).toEqual(['Gorriti 4100', 'Honduras 3900', 'Av. Santa Fe 3200'])
  expect(state.visits.map((v) => [v.store_id, v.merchandiser_id, v.work_date])).toEqual((state.stores ?? []).map((s) => [s.id, 'p3', '2026-10-16']))
  expect((state.stores ?? []).map((s) => s.customer_number)).toEqual(['120', '4471', '118'])
  expect(state.visits[0]?.task).toBe(`${TASK} · PDF págs. 2 y 3`)
})
