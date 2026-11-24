import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState, atFakeToday } from './support/fake-supabase'

// Written for Monday 12 October: run as if it were that day.
test.beforeEach(({ page }) => atFakeToday(page))

const DATE = '2026-10-12'

test('a route passed by mistake: "Limpiar jornada" takes off what was not started, after confirming', async ({ page }, info) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: DATE, status: 'published', created_by: 'p9' },
    visits: [
      visitRow('v1', 0, 'Amenábar 1260'),
      visitRow('v2', 1, 'Moldes 1365'),
      visitRow('v3', 2, 'Tres Arroyos 762', { added_by: 'p9', source: 'assigned' }),
      visitRow('v4', 3, 'Vidal 2044', { work_status: 'in_progress', arrived_at: `${DATE}T11:40:00-03:00` }),
    ],
    uploads: [],
  }
  await installFakeSupabase(page, state)
  await page.goto(`/s/workday?date=${DATE}`)
  await page.getByRole('button', { name: 'Limpiar jornada' }).click()
  const ask = page.getByRole('alertdialog', { name: '¿Limpiar tu jornada?' })
  await expect(ask).toContainText('Se quitan los 2 locales que todavía no se empezaron. Quedan 2 que ya tienen algo cargado o los asignó tu supervisor.')
  await page.screenshot({ path: `test-results/clear-day-${info.project.name}.png` })
  await ask.getByRole('button', { name: 'Quitar 2 locales' }).click()
  await expect.poll(() => state.visits.map((v) => v.id)).toEqual(['v3', 'v4'])
  await expect(page.getByText('Amenábar 1260')).toHaveCount(0)
  await expect(page.getByText('Vidal 2044').first()).toBeVisible()
  // Nothing left to clear: the button goes.
  await expect(page.getByRole('button', { name: 'Limpiar jornada' })).toHaveCount(0)
})

test('cancelling "Limpiar jornada" leaves the day as it was', async ({ page }) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: DATE, status: 'published', created_by: 'p9' },
    visits: [visitRow('v1', 0, 'Amenábar 1260'), visitRow('v2', 1, 'Moldes 1365')],
    uploads: [],
  }
  await installFakeSupabase(page, state)
  await page.goto(`/s/workday?date=${DATE}`)
  await page.getByRole('button', { name: 'Limpiar jornada' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  expect(state.visits).toHaveLength(2)
})
