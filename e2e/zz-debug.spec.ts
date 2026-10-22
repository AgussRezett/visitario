import { test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'
test('dbg', async ({ page }) => {
  const state: FakeState = { workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' }, visits: [visitRow('v1', 0, 'Cabildo 2000', { consent: 'yes', work_status: 'in_progress', display: [0, 1, 2].map((i) => ({ id: `d${i}`, display_type_id: 1, reference: null, source: 'found', sort_order: i, deleted_at: null })) })], uploads: [] }
  await installFakeSupabase(page, state)
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Terminar visita' }).waitFor()
  const r = page.locator('main [data-scroll]')
  console.log('before', await r.evaluate((el) => [el.scrollHeight, el.clientHeight, getComputedStyle(el).height]))
  await r.evaluate((el) => el.scrollBy(0, 600))
  await page.getByText('Puntera').first().click()
  await page.waitForTimeout(500)
  console.log('after', await r.evaluate((el) => [el.scrollTop, el.scrollHeight, el.clientHeight, getComputedStyle(el).height, getComputedStyle(el).overflowY]))
})
