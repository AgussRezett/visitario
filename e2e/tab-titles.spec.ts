import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]

test('each browser tab says what it shows', async ({ page }) => {
  const state: FakeState = {
    workday: null, uploads: [], visits: [], memberships: supervisor,
    stores: [{ id: 's1', name: 'Mas Ahorro', address: 'Tres Arroyos 762', location_status: 'verified', source: 'imported' }],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/map')
  await expect(page).toHaveTitle('Mapa de puntos · Visitario')
  await page.goto('/s/stores')
  await expect(page).toHaveTitle('Directorio · Visitario')
  await page.goto('/s/reports')
  await expect(page).toHaveTitle('Informes · Visitario')
  // A page with something more precise says it; leaving it goes back to the section.
  await page.goto('/stores/s1')
  await expect(page).toHaveTitle('Mas Ahorro · Visitario')
  await page.getByRole('link', { name: 'Directorio' }).filter({ visible: true }).last().click()
  await expect(page).toHaveTitle('Directorio · Visitario')
})
