import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const state = (hoursAgo: number): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Moldes 1365', { work_status: 'in_progress', consent: 'yes', arrived_at: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() })],
  uploads: [],
})

test('a visit about to reach 12 hours in progress says until when it can be finished', async ({ page }, info) => {
  await installFakeSupabase(page, state(11))
  await page.goto('/visit/v1')
  await expect(page.getByText(/Terminala antes de las \d\d:\d\d: si no, vuelve a pendiente y se borra lo cargado\./).filter({ visible: true }).first()).toBeVisible()
  await page.screenshot({ path: `test-results/visit-stale-${info.project.name}.png` })
})

test('a visit started a while ago says nothing', async ({ page }) => {
  await installFakeSupabase(page, state(3))
  await page.goto('/visit/v1')
  await expect(page.getByRole('button', { name: 'Terminar visita' }).filter({ visible: true }).first()).toBeVisible()
  await expect(page.getByText(/vuelve a pendiente/)).toHaveCount(0)
})
