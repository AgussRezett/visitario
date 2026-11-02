import { expect, test } from '@playwright/test'
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
  await expect(sheet.getByLabel('Canal de los que no lo indican')).toHaveValue('10')
  await sheet.getByLabel('Direcciones').fill([
    '1362; José Cubas 2770',
    '1353; Ladines 2774 #Kiosco',
    '525; Congreso 3576',
    '1362; José Cubas 2770',
    '99999',
  ].join('\n'))
  await expect(sheet.getByText('Línea 4 repite la 1: 1362')).toBeVisible()
  await sheet.getByRole('button', { name: 'Agregar 5 direcciones' }).click()

  const left = sheet.getByRole('status').or(sheet.getByRole('alert')).filter({ hasText: 'Faltan 2' })
  await expect(left).toContainText('Agregamos 2 locales · 1 estaba repetido en la lista')
  await expect(left).toContainText('local archivado (Av. Congreso 3576)')
  await expect(left).toContainText('sumá la dirección')
  await expect(sheet.getByLabel('Direcciones')).toHaveValue('525; Congreso 3576\n99999')
  // New stores without #channel go to Autoservicio; the one that said it keeps its own.
  expect(state.tagged?.map((t) => t.p_channel)).toEqual([10, 11])
  expect(state.visits).toHaveLength(2)
  await page.screenshot({ path: `test-results/paste-left-${info.project.name}.png` })

  await sheet.getByLabel('Direcciones').fill('Congreso 3576\n99999; Vallejos 3136')
  await sheet.getByRole('button', { name: 'Agregar 2 direcciones' }).click()
  await expect(sheet).toBeHidden()
  expect(state.visits).toHaveLength(4)
})
