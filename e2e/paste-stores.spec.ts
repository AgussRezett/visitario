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

test('pasting many stores: all at once, the ones left out stay with why, and a retry adds them', async ({ page }, info) => {
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
  // The channel is never assumed: it starts unchosen.
  await expect(sheet.getByLabel('Canal de los que no lo indican')).toHaveAttribute('data-value', '')
  await sheet.getByLabel('Direcciones').fill([
    '1362; José Cubas 2770',
    '1353; Ladines 2774 #Kiosco',
    '525; Congreso 3576',
    '1362; José Cubas 2770',
    '99999',
  ].join('\n'))
  await expect(sheet.getByText('Línea 4 repite la 1: 1362')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Agregar 5 direcciones' })).toBeDisabled()
  await expect(sheet.getByText('Para agregarlas, elegí el canal')).toBeVisible()
  await pick(sheet.getByLabel('Canal de los que no lo indican'), 'Autoservicio')
  await sheet.getByRole('button', { name: 'Agregar 5 direcciones' }).click()

  const left = sheet.getByRole('status').or(sheet.getByRole('alert')).filter({ hasText: 'Faltan 2' })
  await expect(left).toContainText('Agregamos 2 locales · 1 estaba repetido en la lista')
  await expect(left).toContainText('local archivado (Av. Congreso 3576)')
  await expect(left).toContainText('sumá la dirección')
  await expect(sheet.getByLabel('Direcciones')).toHaveValue('525; Congreso 3576\n99999')
  // New stores without #channel go to the one chosen (Autoservicio); the one that said it keeps its own.
  expect(state.tagged?.map((t) => t.p_channel)).toEqual([10, 11])
  expect(state.visits).toHaveLength(2)
  await page.screenshot({ path: `test-results/paste-left-${info.project.name}.png` })

  await sheet.getByLabel('Direcciones').fill('Congreso 3576\n99999; Vallejos 3136')
  await sheet.getByRole('button', { name: 'Agregar 2 direcciones' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits).toHaveLength(4)
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

test('the merchandiser reads a capture into the list, checks it and adds it', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], catalogs: catalogs(),
    // Only what the capture shows, copied as is: Visitario decides what each column holds.
    capture: { headers: ['COD', 'DOMICILIO', 'BARRIO', 'VENDEDOR', 'DIA'], rows: [['1362', 'JOSE CUBAS 2770', 'VILLA DEVOTO', 'FLORENCIA', 'VIERNES'], ['', 'LADINES 2774', 'VILLA DEVOTO', 'OTRO VE.', 'VIERNES']], unreadable: 1 },
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday?date=2026-10-12')
  await page.getByRole('button', { name: /Abrir (mi )?jornada/ }).click()
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await readFiles(sheet, [{ name: 'captura.png', mimeType: 'image/png', buffer: PIXEL }])
  await expect(sheet.getByText(/Leímos 2 locales: revisalos contra los archivos/)).toBeVisible()
  // What is left of my day, after this one
  await expect(sheet.getByText('Te quedan 29 usos de IA hoy.')).toBeVisible()
  await expect(sheet.getByText(/No pudo leer 1 fila: sumala a mano/)).toBeVisible()
  // The seller in the catalog goes as a mention; the one that is not is left out, not guessed.
  await expect(sheet.getByLabel('Direcciones')).toHaveValue('1362; Jose Cubas 2770; Villa Devoto @Florencia\nLadines 2774; Villa Devoto')
  await page.screenshot({ path: `test-results/paste-capture-${info.project.name}.png` })
  await pick(sheet.getByLabel('Canal de los que no lo indican'), 'Autoservicio')
  await sheet.getByRole('button', { name: 'Agregar 2 direcciones' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits).toHaveLength(2)
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
