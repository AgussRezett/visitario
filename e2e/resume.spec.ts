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

test('discarding pending visits: one from the sheet, then the rest at once', async ({ page }, info) => {
  const state = day()
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  const panel = page.getByRole('region', { name: 'De días anteriores' }).filter({ visible: true })
  await expect(panel).toContainText('Echeverría 1580')

  await panel.getByRole('button', { name: 'Elegir cuáles retomar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Retomar pendientes' })
  await expect(sheet.getByText('3 de 3 elegidas')).toBeVisible()
  await sheet.getByRole('checkbox', { name: /Vidal 2044/ }).uncheck()
  await sheet.getByRole('button', { name: 'No retomar Echeverría 1580' }).click()
  await expect(sheet.getByText('Echeverría 1580')).toHaveCount(0)
  await expect(sheet.getByText('1 de 2 elegidas')).toBeVisible() // Vidal stays unchecked
  expect(state.dismissed).toEqual(['old1'])
  await page.screenshot({ path: `test-results/resume-sheet-${info.project.name}.png` })
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  await panel.getByRole('button', { name: 'Descartar todas' }).click()
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('¿Descartar las 2 pendientes?')
  await confirm.getByRole('button', { name: 'Descartar' }).click()
  await expect(page.getByRole('region', { name: 'De días anteriores' })).toHaveCount(0)
  expect(state.dismissed).toEqual(['old1', 'old2', 'old3'])
})

test('discarding the last one in the sheet closes it', async ({ page }) => {
  const state = { ...day(), resumable: [pending('old1', '2026-10-09', 'Echeverría 1580')] }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await page.getByRole('region', { name: 'De días anteriores' }).filter({ visible: true }).getByRole('button', { name: 'Elegir cuáles retomar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Retomar pendientes' })
  await sheet.getByRole('button', { name: 'No retomar Echeverría 1580' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: 'De días anteriores' })).toHaveCount(0)
})
