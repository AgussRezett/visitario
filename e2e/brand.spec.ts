import { expect, test, type Page } from '@playwright/test'
import { installFakeSupabase, type FakeState } from './support/fake-supabase'

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const membership = (roles: string[], look: { brand_color?: string | null; logo_path?: string | null } = {}) =>
  [{ id: 'm1', company_id: 'c1', roles, status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor', ...look } }]
const settings = { id: 'c1', name: 'Panda', kind: 'distributor', geocoding_scope: 'caba', show_whatsapp: true, photo_retention_months: 12, logo_version: null, brand_color: null, logo_path: null, shift_start: '09:00:00', shift_end: '14:00:00' }
/** The color the app paints its main buttons with right now. */
const action = (page: Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--action').trim())

test('the admin gives the app the company’s color and logo, with a live preview', async ({ page }, info) => {
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships: membership(['admin']), company: { ...settings } }
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/company')
  const card = page.getByRole('region', { name: 'Marca' })
  await expect(card.getByRole('radio', { name: 'El de Visitario' })).toHaveAttribute('aria-checked', 'true')
  expect(await action(page)).toBe('#173b30')

  // Choosing previews it over the whole app; discarding puts it back.
  await card.getByRole('radio', { name: '#1f4e8c' }).click()
  await expect.poll(() => action(page)).toBe('#1f4e8c')
  await card.getByRole('button', { name: 'Descartar' }).click()
  await expect.poll(() => action(page)).toBe('#173b30')

  // A light color gets readable text; the code can be typed too.
  await card.getByLabel('Código del color').fill('#ffd400')
  await expect.poll(() => action(page)).toBe('#ffd400')
  await card.getByLabel('Código del color').fill('#c2185b')
  await card.getByRole('button', { name: 'Guardar color' }).click()
  await expect.poll(() => state.company?.brand_color).toBe('#c2185b')
  await expect.poll(() => action(page)).toBe('#c2185b')

  // The logo, as a PNG in the company's folder; it shows in the app at once.
  await card.getByLabel('Elegir el logo').setInputFiles({ name: 'panda.png', mimeType: 'image/png', buffer: PNG })
  await expect.poll(() => state.company?.logo_path).toMatch(/^c1\/\d+\.png$/)
  expect(state.storage?.logos?.uploaded).toEqual([state.company?.logo_path])
  await expect(page.getByRole('img', { name: 'Panda' }).first()).toBeVisible()
  await page.screenshot({ path: `test-results/brand-${info.project.name}.png`, fullPage: true })

  await card.getByRole('button', { name: 'Quitar' }).click()
  await expect.poll(() => state.company?.logo_path).toBeNull()
  await card.getByRole('button', { name: 'Volver al estilo Visitario' }).click()
  await expect.poll(() => state.company?.brand_color).toBeNull()
  await expect.poll(() => action(page)).toBe('#173b30')
})

test('leaving without saving keeps the saved color', async ({ page }) => {
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships: membership(['admin']), company: { ...settings } }
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/company')
  await page.getByRole('region', { name: 'Marca' }).getByRole('radio', { name: '#6b4bd8' }).click()
  await expect.poll(() => action(page)).toBe('#6b4bd8')
  await page.getByRole('link', { name: /Usuarios/ }).first().click()
  await expect.poll(() => action(page)).toBe('#173b30')
  expect(state.company?.brand_color).toBeNull()
})

test('everyone in the company sees its color and logo, in light and dark', async ({ page }, info) => {
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships: membership(['merchandiser'], { brand_color: '#c2185b', logo_path: 'c1/1.png' }) }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await expect.poll(() => action(page)).toBe('#c2185b')
  await expect(page.getByRole('img', { name: 'Panda' }).first()).toBeVisible()
  await page.screenshot({ path: `test-results/brand-member-${info.project.name}.png` })
  // In the dark the button is lighter, so it stands out on the dark card.
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await expect.poll(() => action(page)).toBe('#d25486')
  await page.waitForTimeout(300) // let the color transitions finish
  await page.screenshot({ path: `test-results/brand-member-dark-${info.project.name}.png` })
})
