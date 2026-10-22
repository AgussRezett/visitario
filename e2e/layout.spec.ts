import { expect, test, type Locator, type Page } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState, atFakeToday } from './support/fake-supabase'

// Written for Monday 12 October: run as if it were that day.
test.beforeEach(({ page }) => atFakeToday(page))

const DATE = '2026-10-12'

const longDay = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: DATE, status: 'published', created_by: 'p1' },
  visits: Array.from({ length: 14 }, (_, i) => visitRow(`v${i + 1}`, i, `Cabildo ${2000 + i * 10}`)),
  uploads: [],
})

const box = async (l: Locator) => (await l.boundingBox()) ?? { x: -1, y: -1, width: 0, height: 0 }
const documentScroll = (page: Page) => page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)
const scrollTop = (l: Locator) => l.evaluate((el) => el.scrollTop)

/** While a dialog is open every scroll region behind it is locked. */
async function expectBackgroundLocked(page: Page, region: Locator) {
  // Opening a sheet can shorten the page behind it by a few pixels: measure once it settles.
  let settled = -1
  await expect.poll(async () => {
    const was = settled
    settled = await scrollTop(region)
    return settled === was
  }, { intervals: [150] }).toBe(true)
  const before = await scrollTop(region)
  await page.mouse.move(20, 20) // over the backdrop, outside the sheet
  await page.mouse.wheel(0, 600)
  await page.waitForTimeout(200)
  expect(await scrollTop(region)).toBe(before)
  const overflows = await page.locator('[data-scroll]').evaluateAll((els) => els.map((el) => getComputedStyle(el).overflowY))
  expect(overflows.every((o) => o === 'hidden')).toBe(true)
}

test('only the main content scrolls; the bars never move', async ({ page }, info) => {
  await installFakeSupabase(page, longDay())
  await page.goto('/s/workday')
  await expect(page.getByText('Cabildo 2130').first()).toBeAttached()
  const main = page.locator('main')
  const bar = info.project.name === 'mobile' ? page.getByRole('navigation', { name: 'Secciones' }).last() : page.locator('aside').first()
  const barBefore = await box(bar)

  await main.evaluate((el) => el.scrollBy(0, 800))
  expect(await scrollTop(main)).toBeGreaterThan(0)
  expect(await documentScroll(page)).toBe(0)
  expect(await box(bar)).toEqual(barBefore)
  if (info.project.name === 'mobile') {
    // The floating action stays over the content, above the bottom bar.
    const fab = page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true })
    const fabBox = await box(fab)
    expect(fabBox.y + fabBox.height).toBeLessThanOrEqual(barBefore.y)
  }
})

test('with a sheet open the page behind does not scroll', async ({ page }) => {
  await installFakeSupabase(page, longDay())
  await page.goto('/s/workday')
  await expect(page.getByText('Cabildo 2130').first()).toBeAttached()
  const main = page.locator('main')
  await main.evaluate((el) => el.scrollBy(0, 300))
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  await expect(page.getByRole('dialog', { name: 'Agregar a mi jornada' })).toBeVisible()
  await expectBackgroundLocked(page, main)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Agregar a mi jornada' })).toBeHidden()
  const overflow = await main.evaluate((el) => getComputedStyle(el).overflowY)
  expect(overflow).toBe('auto') // unlocked again
})

test('visit on a phone: top bar and finish bar stay, only the visit scrolls; its sheets lock it', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phone layout')
  const state = longDay()
  state.visits[0] = visitRow('v1', 0, 'Cabildo 2001', {
    consent: 'yes',
    work_status: 'in_progress',
    display: [0, 1, 2].map((i) => ({ id: `d${i}`, display_type_id: 1, reference: null, source: 'found', sort_order: i, deleted_at: null })),
  })
  await installFakeSupabase(page, state)
  await page.goto('/visit/v1')
  const region = page.locator('main [data-scroll]')
  const finish = page.getByRole('button', { name: 'Terminar visita' })
  await expect(finish).toBeVisible()
  const finishBefore = await box(finish)
  const titleBefore = await box(page.getByRole('link', { name: 'Volver a la jornada' }))

  await region.evaluate((el) => el.scrollBy(0, 600))
  expect(await scrollTop(region)).toBeGreaterThan(0)
  expect(await documentScroll(page)).toBe(0)
  expect(await box(finish)).toEqual(finishBefore)
  expect(await box(page.getByRole('link', { name: 'Volver a la jornada' }))).toEqual(titleBefore)

  await page.getByText('Puntera').first().click()
  await expect(page.getByRole('dialog', { name: 'Puntera' })).toBeVisible()
  await expectBackgroundLocked(page, region)
})
