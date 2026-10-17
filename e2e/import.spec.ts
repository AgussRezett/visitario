import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState } from './support/fake-supabase'

const FILE = 'e2e/fixtures/ruteo_viernes.xlsx' // 78 rows shaped like Panda's routing (make-sheet.py)
const FRIDAY = '2026-10-16'
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const people = [
  { id: 'p2', first_name: 'Lucía', last_name: 'Gómez' },
  { id: 'p3', first_name: 'Diego', last_name: 'Paz' },
  { id: 'p4', first_name: 'Valentina', last_name: 'Ortiz' },
  { id: 'p5', first_name: 'Nicolás', last_name: 'Ferrari' },
  { id: 'p6', first_name: 'Agustín', last_name: 'Sosa' },
]
const SIGNATURE = 'cliente|razon social|domicilio|localidad|repositor|vendedor'

const team = (extra: Partial<FakeState> = {}): FakeState => ({
  workday: null,
  visits: [],
  uploads: [],
  memberships: supervisor,
  people,
  workdays: [],
  // Ten customers are already in the directory, some with another spelling of the address.
  stores: Array.from({ length: 10 }, (_, i) => ({ id: `s${i}`, customer_number: String(20000 + i), name: `Autoservicio ${i + 1}`, address: `Dirección vieja ${i}` })),
  ...extra,
})

test('Martín imports the spreadsheet: columns, names, review, into five drafts', async ({ page }, info) => {
  const state = team()
  await installFakeSupabase(page, state, 'supervisor')
  const started = Date.now()
  await page.goto(`/s/assign?date=${FRIDAY}`)
  await page.getByRole('button', { name: 'Importar planilla' }).click()
  await page.getByLabel('Subir planilla').setInputFiles(FILE)

  await expect(page.getByRole('heading', { name: '¿Qué hay en cada columna?' })).toBeVisible()
  await expect(page.getByLabel('Qué hay en CLIENTE')).toHaveValue('customer_number')
  await expect(page.getByLabel('Qué hay en DOMICILIO')).toHaveValue('address')
  await expect(page.getByLabel('Qué hay en REPOSITOR')).toHaveValue('merchandiser')
  await expect(page.getByLabel('Qué hay en VENDEDOR')).toHaveValue('ignore')
  await expect(page.getByText('¿Es Nicolás Ferrari?')).toBeVisible()
  await page.getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.getByText('¿Es Nicolás Ferrari?')).toHaveCount(0)
  await expect(page.getByLabel('Nombre del formato')).toHaveValue('Panda diaria')
  await page.screenshot({ path: `test-results/import-columns-${info.project.name}.png`, fullPage: info.project.name === 'desktop' })
  await page.getByRole('button', { name: 'Revisar 78 filas' }).click()

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  await expect(page.getByText('10 reconocidas')).toBeVisible()
  await expect(page.getByText('68 nuevas')).toBeVisible()
  await expect(page.getByText('0 para revisar')).toBeVisible()
  await expect(page.getByText('Reconocido por número de cliente').or(page.getByText(/Mismo número de cliente/)).first()).toBeVisible()
  await page.screenshot({ path: `test-results/import-review-${info.project.name}.png`, fullPage: info.project.name === 'desktop' })
  expect(state.visits).toHaveLength(0) // nothing created while reviewing

  await page.getByRole('button', { name: 'Agregar 78 a 5 jornadas' }).click()
  await expect(page.getByText('Se agregaron 78 locales. Revisá cada jornada y publicá.')).toBeVisible()
  expect(Date.now() - started).toBeLessThan(120_000)
  expect(new Set(state.visits.map((v) => v.merchandiser_id))).toEqual(new Set(['p2', 'p3', 'p4', 'p5', 'p6']))
  expect(state.visits.filter((v) => v.merchandiser_id === 'p5')).toHaveLength(15) // "Nico F." confirmed
  expect(state.workdays?.every((w) => w.status === 'draft')).toBe(true)
  expect(state.formats?.[0]).toMatchObject({ name: 'Panda diaria', signature: SIGNATURE, mapping: { aliases: { 'nico f': 'p5' } } })
})

test('the same columns again need no mapping; discarding leaves nothing', async ({ page }) => {
  const mapping = { hasHeader: true, columns: ['customer_number', 'name', 'address', 'area', 'merchandiser', 'ignore'], scope: 'caba', aliases: { 'nico f': 'p5' } }
  const state = team({ formats: [{ id: 'f1', company_id: 'c1', name: 'Panda diaria', signature: SIGNATURE, mapping, last_used_at: '2026-10-09T22:00:00Z' }] })
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto(`/s/import?date=${FRIDAY}`)
  await expect(page.getByText('Panda diaria')).toBeVisible()
  await page.screenshot({ path: `test-results/import-source-${test.info().project.name}.png` })
  await page.getByLabel('Subir planilla').setInputFiles(FILE)

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  await expect(page.getByText('Formato "Panda diaria" reconocido: las columnas ya están elegidas.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Agregar 78 a 5 jornadas' })).toBeEnabled()

  await page.getByRole('button', { name: 'Descartar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click()
  await expect(page).toHaveURL(/\/s\/assign/)
  expect(state.visits).toHaveLength(0)
  expect(state.stores).toHaveLength(10)
})

test('pasted addresses go to the chosen merchandiser, located when found', async ({ page }, info) => {
  const state = team({ geocode: { 'Cabildo 2245': { label: 'Cabildo 2245, Belgrano', address: 'Cabildo 2245', area: 'Belgrano', lat: -34.56, lng: -58.45, exact: true } } })
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto(`/s/import?date=${FRIDAY}&person=p2`)
  await page.getByLabel('O pegá el texto').fill('20990; Cabildo 2245; Belgrano\nDirección vieja 3\nCiudad de la Paz 1700, Villa Urquiza')
  await page.getByRole('button', { name: 'Continuar con el texto' }).click()

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  await page.getByLabel('Para').selectOption({ label: 'Lucía Gómez' })
  await expect(page.getByText('Comercio nuevo · ubicado')).toBeVisible()
  await expect(page.getByText('Comercio nuevo · sin ubicación exacta')).toBeVisible()
  await expect(page.getByText('Misma dirección en el directorio')).toBeVisible()
  await page.screenshot({ path: `test-results/import-paste-${info.project.name}.png`, fullPage: info.project.name === 'desktop' })

  await page.getByRole('button', { name: 'Agregar 3 a la jornada de Lucía' }).click()
  await expect(page.getByText('Se agregaron 3 locales.', { exact: false })).toBeVisible()
  expect(state.visits.every((v) => v.merchandiser_id === 'p2')).toBe(true)
  expect(state.stores?.find((s) => s.address === 'Cabildo 2245')).toMatchObject({ lat: -34.56, customer_number: '20990', area: 'Belgrano' })
  expect(state.stores?.find((s) => s.address === 'Ciudad de la Paz 1700')).toMatchObject({ lat: null, area: 'Villa Urquiza' })
})

test('a supervisor who is also a merchandiser imports for themselves; every row says if the address is new or already loaded', async ({ page }, info) => {
  const state = team({ people: [{ id: 'p1', first_name: 'Agustin', last_name: 'Rezett' }] })
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto(`/s/import?date=${FRIDAY}`)
  await page.getByLabel('O pegá el texto').fill('9755; MANUELA PEDRAZA 3526; COGHLAN\nDirección vieja 3')
  await page.getByRole('button', { name: 'Continuar con el texto' }).click()

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  const para = page.getByLabel('Para')
  await expect(para.locator('option', { hasText: 'Agustin Rezett (vos)' })).toHaveCount(1)
  await para.selectOption({ label: 'Elegir activador…' })
  await expect(page.getByText('Falta elegir el activador')).toHaveCount(2)
  await expect(page.getByText('Manuela Pedraza 3526', { exact: true })).toBeVisible()
  await expect(page.getByText('Dirección nueva: se suma al directorio')).toBeVisible()
  await expect(page.getByText('Ya cargada en el directorio: Autoservicio 4 · cliente 20003')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quitar la fila 1' })).toContainText('Quitar')
  await page.screenshot({ path: `test-results/import-self-${info.project.name}.png`, fullPage: true })

  await para.selectOption({ label: 'Agustin Rezett (vos)' })
  await page.getByRole('button', { name: 'Agregar 2 a la jornada de Agustin' }).click()
  await expect(page.getByText(/Se agregaron 2 locales/)).toBeVisible()
  expect(state.visits.map((v) => v.merchandiser_id)).toEqual(['p1', 'p1'])
})

// A 1×1 PNG: the fake reads nothing from it, but the phone still compresses it.
const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

test('a capture read by AI goes straight to the review, split by merchandiser', async ({ page }, info) => {
  const state = team({
    capture: {
      unreadable: 1,
      rows: [
        { customer_number: '20003', name: 'Autoservicio 4', address: 'Dirección vieja 3', area: '', merchandiser: 'Lucia', task: '' },
        { customer_number: '', name: '', address: 'Cabildo 2245', area: 'Belgrano', merchandiser: 'Diego', task: 'Armar puntera' },
        { customer_number: '', name: 'TOTAL', address: '', area: '', merchandiser: '', task: '' },
      ],
    },
  })
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto(`/s/import?date=${FRIDAY}`)
  await expect(page.getByLabel('Subir captura')).toBeAttached()
  await page.screenshot({ path: `test-results/import-source-capture-${info.project.name}.png`, fullPage: true })
  await page.getByLabel('Subir captura').setInputFiles({ name: 'captura_excel.png', mimeType: 'image/png', buffer: PIXEL })

  await expect(page.getByRole('heading', { name: 'Revisá antes de guardar' })).toBeVisible()
  await expect(page.getByText('Leído de una captura con IA')).toBeVisible()
  await expect(page.getByText(/No pudo leer 1 fila: agregala a mano/)).toBeVisible()
  await expect(page.getByText('Reconocido por número de cliente')).toBeVisible()
  await page.screenshot({ path: `test-results/import-capture-${info.project.name}.png`, fullPage: info.project.name === 'desktop' })

  await page.getByRole('button', { name: 'Agregar 2 a 2 jornadas' }).click()
  await expect(page.getByText(/Se agregaron 2 locales/)).toBeVisible()
  expect(state.visits.map((v) => v.merchandiser_id).sort()).toEqual(['p2', 'p3'])
  expect(state.formats ?? []).toHaveLength(0) // a capture is not a format to remember
})

test('reading a capture without the feature on says so and stays put', async ({ page }) => {
  await installFakeSupabase(page, team({ capture: { status: 402 } }), 'supervisor')
  await page.goto(`/s/import?date=${FRIDAY}`)
  await page.getByLabel('Subir captura').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: PIXEL })
  await expect(page.getByText('La carga desde una captura es parte del plan pago.')).toBeVisible()
  await expect(page.getByRole('heading', { name: '¿De dónde salen los locales?' })).toBeVisible()
})
