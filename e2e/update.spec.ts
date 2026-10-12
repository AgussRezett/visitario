import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { installFakeSupabase } from './support/fake-supabase'

// A deploy while the app is open: the new version waits until the person taps "Actualizar".
// It changes the served sw.js on disk, so it runs once (phone) to not race the other project.
test('a new version is announced and applied on request', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'changes the shared build')
  await installFakeSupabase(page, { workday: null, visits: [], uploads: [] })
  await page.goto('/s/workday')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.reload() // like an installed app: opened with the service worker already in control
  await expect(page.getByText('Hay una versión nueva')).toHaveCount(0)

  const file = 'dist/sw.js'
  const original = readFileSync(file, 'utf8')
  try {
    writeFileSync(file, `${original}\n// deploy ${Date.now()}`) // what a deploy looks like
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))) // back to the app
    await expect(page.getByText('Hay una versión nueva de Visitario')).toBeVisible()
    await page.screenshot({ path: `test-results/update-${info.project.name}.png` })

    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Actualizar' }).click()
    await reloaded
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Hay una versión nueva')).toHaveCount(0)
  } finally {
    writeFileSync(file, original)
  }
})
