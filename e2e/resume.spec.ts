import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const pending = (id: string, date: string, address: string, extra: Row = {}): Row => ({
  visit_id: id, work_date: date, store_name: null, address, work_status: 'pending', finished_at: null, pending_displays: 0, ...extra,
})

const day = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Moldes 1365')],
  uploads: [],
  resumable: [
    pending('old1', '2026-10-09', 'Echeverría 1580'),
    pending('old2', '2026-10-08', 'Vidal 2044', { work_status: 'closed', finished_at: '2026-10-08T15:00:00Z' }),
    pending('old3', '2026-10-07', 'Monroe 2650'),
  ],
})

test('the chosen ones are discarded or added: the same choice works for both', async ({ page }, info) => {
  const state = day()
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  const panel = page.getByRole('region', { name: 'De días anteriores' }).filter({ visible: true })
  await expect(panel).toContainText('Echeverría 1580')
  await expect(panel.getByRole('button')).toHaveCount(1) // one action per moment

  await panel.getByRole('button', { name: 'Retomar o descartar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pendientes de días anteriores' })
  await expect(sheet.getByText('3 de 3 elegidas')).toBeVisible()
  await sheet.getByRole('button', { name: 'Quitar todas' }).click()
  await expect(sheet.getByRole('button', { name: 'Descartar 0' })).toBeDisabled()
  await sheet.getByRole('checkbox', { name: /Echeverría 1580/ }).check()
  await sheet.getByRole('checkbox', { name: /Monroe 2650/ }).check()
  await page.screenshot({ path: `test-results/resume-sheet-${info.project.name}.png` })

  await sheet.getByRole('button', { name: 'Descartar 2' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('¿Descartar 2 pendientes?')
  await confirm.getByRole('button', { name: 'Descartar' }).click()
  await expect(sheet.getByText('Echeverría 1580')).toHaveCount(0)
  await expect(sheet.getByText('Monroe 2650')).toHaveCount(0)
  await expect(sheet.getByText('0 de 1 elegidas')).toBeVisible()
  expect(state.dismissed).toEqual(['old1', 'old3'])

  // The one left can still be added.
  await sheet.getByRole('checkbox', { name: /Vidal 2044/ }).check()
  await expect(sheet.getByRole('button', { name: 'Agregar 1 a mi jornada' })).toBeEnabled()
})

test('discarding the last ones closes the sheet and the panel goes away', async ({ page }) => {
  const state = { ...day(), resumable: [pending('old1', '2026-10-09', 'Echeverría 1580')] }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await page.getByRole('region', { name: 'De días anteriores' }).filter({ visible: true }).getByRole('button', { name: 'Retomar o descartar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pendientes de días anteriores' })
  await sheet.getByRole('button', { name: 'Descartar 1' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: 'De días anteriores' })).toHaveCount(0)
  expect(state.dismissed).toEqual(['old1'])
})
