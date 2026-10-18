import { expect, test, type Page } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const day = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Tres Arroyos 762')],
  uploads: [],
})

/** As if the phone's site data were cleared or the session were revoked elsewhere. */
const endSession = (page: Page) =>
  page.evaluate(() => {
    localStorage.setItem('e2e.noSession', '1')
    localStorage.removeItem('sb-mjpzawlyjjlmluozjwap-auth-token')
  })

test('a saved copy of the app without a session opens sign-in, not screens that never load', async ({ page }) => {
  await installFakeSupabase(page, day())
  await page.goto('/s/workday')
  await expect(page.getByText('Tres Arroyos 762').first()).toBeVisible()

  await endSession(page)
  await page.reload()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})

test('the session ending while the app is open sends to sign-in on the next screen', async ({ page }) => {
  await installFakeSupabase(page, day())
  await page.goto('/s/workday')
  await expect(page.getByText('Tres Arroyos 762').first()).toBeVisible()

  await endSession(page)
  await page.getByRole('link', { name: 'Recorrido' }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
})
