import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const names = ['Florencia Sereno', 'Martín Sosa', 'Josefina Gil', 'Joaquín Pérez', 'Victoria Paz', 'Nora Ruiz', 'Diego Álvarez', 'Lucía Gómez', 'Ana Díaz']
const state = (): FakeState => ({
  workday: null, uploads: [], visits: [], memberships: supervisor,
  catalogs: { display_type: [], channel: [], seller: names.map((name, i) => ({ id: i + 1, name, active: true, person_id: null })) },
  stores: [
    { id: 's1', name: 'Mas Ahorro', address: 'Tres Arroyos 762', area: 'Paternal', location_status: 'verified', seller_id: 6 },
    { id: 's2', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', location_status: 'verified', seller_id: 1 },
  ],
})

test('Visitario’s Select: keyboard, search in long lists, a sheet on phones, and it follows the theme', async ({ page }, info) => {
  const desktop = info.project.name === 'desktop'
  await page.emulateMedia({ colorScheme: 'dark' })
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/stores')
  const zone = page.getByRole('combobox', { name: 'Zona' })
  await expect(zone).toHaveText(/Zona: todas/)

  // Keyboard: arrows open it on the chosen one, move, Enter picks; focus goes back.
  await zone.focus()
  await page.keyboard.press('ArrowDown')
  const list = page.getByRole('listbox', { name: 'Zona' })
  await expect(list).toBeVisible()
  await expect(zone).toHaveAttribute('aria-expanded', 'true')
  await expect(list.getByRole('option', { name: 'Zona: todas' })).toHaveAttribute('aria-selected', 'true')
  await page.waitForTimeout(250) // the list's entrance
  if (desktop) await page.screenshot({ path: `test-results/select-open-${info.project.name}.png` })
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(list).toBeHidden()
  await expect(zone).toHaveAttribute('data-value', 'Paternal')
  await expect(zone).toBeFocused()
  await expect(page.getByRole('link', { name: /Autoservicio Lili/ })).toHaveCount(0)

  // Escape closes without changing; typing a letter jumps to it.
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('b')
  await expect(list.getByRole('option', { name: 'Belgrano' })).toHaveAttribute('data-active', 'true')
  await page.keyboard.press('Escape')
  await expect(list).toBeHidden()
  await expect(zone).toHaveAttribute('data-value', 'Paternal')

  // A long list has a search box; a phone gets a bottom sheet with its title.
  const seller = page.getByRole('combobox', { name: 'Vendedor' })
  await seller.click()
  const search = page.getByRole('textbox', { name: 'Buscar en Vendedor' })
  await expect(search).toBeFocused()
  await search.fill('nora')
  await expect(page.getByRole('listbox', { name: 'Vendedor' }).getByRole('option')).toHaveCount(1)
  if (!desktop) {
    await expect(page.getByText('Vendedor', { exact: true }).last()).toBeVisible() // the sheet's title
    await page.screenshot({ path: `test-results/select-sheet-${info.project.name}.png` })
  }
  await page.keyboard.press('Enter')
  await expect(seller).toHaveAttribute('data-value', '6')
  await expect(seller).toHaveText(/Nora Ruiz/)

  // A tap outside closes it.
  await seller.click()
  await page.mouse.click(5, 5)
  await expect(page.getByRole('listbox')).toHaveCount(0)
})
