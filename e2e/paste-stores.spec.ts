import { expect, test } from '@playwright/test'
import { pick } from './support/select'
import { readFiles } from './support/read-files'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const catalogs = () => ({
  display_type: [],
  channel: [
    { id: 10, name: 'Autoservicio', active: true, sort_order: 1 },
    { id: 11, name: 'Kiosco', active: true, sort_order: 3 },
  ],
  seller: [{ id: 1, name: 'Florencia', active: true, person_id: null }],
})

test('pasting many stores: reviewed row by row, the ones left out stay with why, and a retry adds them', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], catalogs: catalogs(),
    stores: [{ id: 's-old', address: 'Av. Congreso 3576', customer_number: '525', deleted_at: '2026-10-01T00:00:00Z' }],
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill([
    '1362; José Cubas 2770',
    '1353; Ladines 2774 #Kiosco',
    '525; Congreso 3576',
    '1362; José Cubas 2770',
    '99999',
  ].join('\n'))
  await sheet.getByRole('button', { name: 'Revisar 5 locales' }).click()

  // One row each, every part in its field.
  const rows = sheet.getByRole('list', { name: 'Locales para agregar' }).locator(':scope > li')
  await expect(rows).toHaveCount(5)
  await expect(rows.nth(0).getByLabel('Nro. de cliente')).toHaveValue('1362')
  await expect(rows.nth(0).getByLabel('Dirección')).toHaveValue('José Cubas 2770')
  await expect(rows.nth(3)).toContainText('Repite el local 1: se agrega una vez.')
  // The channel is never assumed: the one that said it keeps it, the rest ask for one.
  await expect(rows.nth(1).getByLabel('Canal')).toHaveAttribute('data-value', '11')
  await expect(rows.nth(0)).toContainText('Elegí el canal')
  await expect(sheet.getByText('5 locales para agregar · a 4 les falta un dato')).toBeVisible()
  const add = sheet.getByRole('button', { name: 'Agregar 5 locales' })
  await expect(add).toBeDisabled()
  await page.screenshot({ path: `test-results/paste-review-${info.project.name}.png`, fullPage: true })
  await pick(sheet.getByLabel('Canal de los 4 sin canal'), 'Autoservicio')
  await expect(sheet.getByText('5 locales para agregar · todo listo')).toBeVisible()
  await add.click()

  await expect(sheet.getByText('Agregamos 2 locales · 1 estaba repetido en la lista. Faltan 2: corregilos y tocá Agregar.')).toBeVisible()
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('local archivado (Av. Congreso 3576)')
  await expect(rows.nth(1)).toContainText('sumá la dirección')
  // New stores without #channel go to the one chosen (Autoservicio); the one that said it keeps its own.
  expect(state.tagged?.map((t) => t.p_channel)).toEqual([10, 11])
  expect(state.visits).toHaveLength(2)
  await page.screenshot({ path: `test-results/paste-left-${info.project.name}.png` })

  // Fixed right there: no customer number for the archived one, an address for the other.
  await rows.nth(0).getByLabel('Nro. de cliente').fill('')
  await rows.nth(1).getByLabel('Dirección').fill('Vallejos 3136')
  await sheet.getByRole('button', { name: 'Agregar 2 locales' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits).toHaveLength(4)
})

test('going back to paste more keeps what was fixed in the review', async ({ page }) => {
  await installFakeSupabase(page, { workday: null, visits: [], uploads: [], catalogs: catalogs() })
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill('Moldes 1365\nCabildo 2245')
  await sheet.getByRole('button', { name: 'Revisar 2 locales' }).click()
  const rows = sheet.getByRole('list', { name: 'Locales para agregar' }).locator(':scope > li')
  await rows.nth(0).getByLabel('Barrio').fill('Belgrano')
  await rows.nth(1).getByRole('button', { name: 'Quitar Cabildo 2245' }).click()
  await sheet.getByRole('button', { name: 'Volver' }).click()
  await sheet.getByLabel('Direcciones').fill('Moldes 1365\nCabildo 2245\nVidal 2044')
  await sheet.getByRole('button', { name: 'Revisar 2 locales' }).click()
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).getByLabel('Barrio')).toHaveValue('Belgrano')
  await expect(rows.nth(1).getByLabel('Dirección')).toHaveValue('Vidal 2044')
})

test('a row that is already a directory store goes as that store, not a new one', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], catalogs: catalogs(),
    stores: [{ id: 's-callao', name: 'Autoservicio Lili', address: 'Av. Callao 2000', area: 'Balvanera', customer_number: null, channel_id: 10 }],
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill('9320; Callao 2000\nMoldes 1365')
  await sheet.getByRole('button', { name: 'Revisar 2 locales' }).click()
  const rows = sheet.getByRole('list', { name: 'Locales para agregar' }).locator(':scope > li')
  // "Callao 2000" is the directory's "Av. Callao 2000": shown as that store, with its channel.
  await expect(rows.nth(0)).toContainText('Ya está en el directorio · misma dirección')
  await expect(rows.nth(0)).toContainText('Autoservicio Lili · Av. Callao 2000')
  await expect(rows.nth(0)).toContainText('Nro. 9320 (se lo agregamos)')
  await expect(rows.nth(0).getByLabel('Dirección')).toHaveCount(0)
  await expect(rows.nth(0).getByLabel('Canal')).toHaveAttribute('data-value', '10')
  await expect(sheet.getByText('2 locales para agregar · 1 ya está en el directorio · a 1 le falta un dato')).toBeVisible()
  await page.screenshot({ path: `test-results/paste-known-${info.project.name}.png`, fullPage: true })
})

test('a new store asks for its channel: one of them, or "Sin canal" on purpose', async ({ page }, info) => {
  await installFakeSupabase(page, { workday: null, visits: [], uploads: [], catalogs: catalogs() })
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByLabel('Dirección').fill('Moldes 1365')
  const add = sheet.getByRole('button', { name: 'Agregar a mi jornada' })
  await expect(sheet.getByLabel('Canal')).toHaveAttribute('data-value', '')
  await expect(add).toBeDisabled()
  await page.screenshot({ path: `test-results/channel-unchosen-${info.project.name}.png` })
  await pick(sheet.getByLabel('Canal'), 'Sin canal')
  await expect(add).toBeEnabled()
})

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')

test('the merchandiser reads a capture: it opens as rows to check, with the channel it shows, and adds them', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], catalogs: catalogs(),
    // Only what the capture shows, copied as is: Visitario decides what each column holds.
    capture: { headers: ['COD', 'DOMICILIO', 'BARRIO', 'VENDEDOR', 'CANAL'], rows: [['1362', 'JOSE CUBAS 2770', 'VILLA DEVOTO', 'FLORENCIA', 'KIOSCO'], ['', 'LADINES 2774', 'VILLA DEVOTO', 'OTRO VE.', '']], unreadable: 1 },
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await readFiles(sheet, [{ name: 'captura.png', mimeType: 'image/png', buffer: PIXEL }])
  // Straight to the review: one row each, with what the capture says.
  await expect(sheet.getByText(/Leímos 2 locales: revisalos contra los archivos/)).toBeVisible()
  await expect(sheet.getByText(/No pudo leer 1 fila: sumala a mano/)).toBeVisible()
  const rows = sheet.getByRole('list', { name: 'Locales para agregar' }).locator(':scope > li')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0).getByLabel('Dirección')).toHaveValue('Jose Cubas 2770')
  await expect(rows.nth(0).getByLabel('Barrio')).toHaveValue('Villa Devoto')
  await expect(rows.nth(0).getByLabel('Vendedor', { exact: true })).toHaveValue('Florencia')
  await expect(rows.nth(0).getByLabel('Canal')).toHaveAttribute('data-value', '11')
  // A seller that is not loaded is said, not guessed (an activador cannot create it).
  await expect(rows.nth(1)).toContainText('Leído: Otro Ve. (todavía no está cargado)')
  await expect(sheet.getByText('Elegí uno cargado en cada local, o pedile a un administrador que los cree.')).toBeVisible()
  await page.screenshot({ path: `test-results/paste-capture-${info.project.name}.png`, fullPage: true })
  await pick(rows.nth(1).getByLabel('Canal'), 'Autoservicio')
  await sheet.getByRole('button', { name: 'Agregar 2 locales' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits).toHaveLength(2)
  expect(state.tagged?.map((t) => t.p_channel)).toEqual([11, 10])
})

test('when the day is used up, the capture says so and does not open', async ({ page }) => {
  await installFakeSupabase(page, { workday: null, visits: [], uploads: [], catalogs: catalogs(), capture: { rows: [] }, aiQuota: { month_used: 40, month_limit: 1000, my_today: 30, my_daily_limit: 30 } })
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await expect(sheet.getByText('Ya usaste la IA todo lo permitido por hoy: mañana se renueva.')).toBeVisible()
  await expect(sheet.getByLabel('Elegir archivos')).toBeDisabled()
})
