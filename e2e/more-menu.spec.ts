import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]

test('phones show at most 5 tabs; the rest are one tap away under "Más"', async ({ page }, info) => {
  test.skip(info.project.name === 'desktop', 'the sidebar lists every section')
  const state: FakeState = { workday: null, uploads: [], visits: [], memberships: supervisor, stores: [] }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/today')
  const bar = page.getByRole('navigation', { name: 'Secciones' }).filter({ visible: true })
  await expect(bar.getByRole('link')).toHaveText(['Hoy', 'Revisión', 'Asignar', 'Directorio'])
  const more = bar.getByRole('button', { name: 'Más' })
  await expect(more).toBeVisible()

  await more.click()
  const sheet = page.getByRole('dialog', { name: 'Más secciones' })
  await expect(sheet.getByRole('link')).toHaveCount(2)
  await page.screenshot({ path: `test-results/more-menu-${info.project.name}.png` })
  await sheet.getByRole('link', { name: /Mapa de puntos/ }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(/\/s\/map/)
  // The open page lives under "Más": the tab says so.
  await expect(more).toHaveAttribute('data-current', 'true')
})
