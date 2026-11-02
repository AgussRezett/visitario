import { pick } from './support/select'
import { expect, test, type Page } from '@playwright/test'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const state = (): FakeState => ({
  workday: null, uploads: [], visits: [], memberships: supervisor,
  stores: [
    { id: 's1', name: 'Mas Ahorro', address: 'Tres Arroyos 762', area: 'Paternal', customer_number: '1362', location_status: 'verified', last_visit_date: '2026-10-09', visits_30d: 2 },
    { id: 's2', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', customer_number: '975', location_status: 'verified', last_visit_date: '2026-09-01', visits_30d: 5 },
    { id: 's3', name: 'Kiosco Don Tito', address: 'Cabildo 2280', area: 'Belgrano', customer_number: null, location_status: 'verified' },
  ],
})

/** The store names, in the order shown. */
const order = async (page: Page, desktop: boolean) => {
  const links = desktop ? page.getByRole('table', { name: 'Comercios' }).getByRole('link') : page.getByRole('list').last().getByRole('link')
  return (await links.allInnerTexts()).map((t) => ['Mas Ahorro', 'Autoservicio Lili', 'Kiosco Don Tito'].find((n) => t.includes(n)))
}

test('the directory sorts by what is useful, and keeps the order coming back from a store', async ({ page }, info) => {
  const desktop = info.project.name === 'desktop'
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/stores')
  await expect.poll(() => order(page, desktop)).toEqual(['Autoservicio Lili', 'Kiosco Don Tito', 'Mas Ahorro'])

  const sort = page.getByLabel('Ordenar comercios por')
  await pick(sort, 'Nro. de cliente')
  // 975 before 1362: as numbers; the store without one last.
  await expect.poll(() => order(page, desktop)).toEqual(['Autoservicio Lili', 'Mas Ahorro', 'Kiosco Don Tito'])
  await pick(sort, 'Más tiempo sin visitar')
  await expect.poll(() => order(page, desktop)).toEqual(['Kiosco Don Tito', 'Autoservicio Lili', 'Mas Ahorro'])
  await expect(page.getByText('Más tiempo sin visitar').first()).toBeVisible()
  await page.screenshot({ path: `test-results/directory-sort-${info.project.name}.png` })

  await page.getByRole('link', { name: /Mas Ahorro/ }).first().click()
  await page.getByRole('link', { name: 'Directorio' }).first().click()
  await expect(sort).toHaveAttribute('data-value', 'oldest_visit')

  if (desktop) {
    // The table's headers sort too, and say which way.
    const th = (name: string) => page.locator('th', { has: page.getByRole('button', { name }) })
    const header = th('Visitas 30 días')
    await header.getByRole('button').click()
    await expect(header).toHaveAttribute('aria-sort', 'descending')
    await expect.poll(() => order(page, desktop)).toEqual(['Autoservicio Lili', 'Mas Ahorro', 'Kiosco Don Tito'])
    await expect(sort).toHaveAttribute('data-value', 'most_visits')
    const last = th('Última visita')
    await last.getByRole('button').click()
    await expect(last).toHaveAttribute('aria-sort', 'descending')
    await last.getByRole('button').click()
    await expect(last).toHaveAttribute('aria-sort', 'ascending')
  }
})
