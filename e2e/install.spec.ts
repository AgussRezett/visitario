import { expect, test, type Page } from '@playwright/test'
import { atFakeToday, installFakeSupabase, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const fresh = (): FakeState => ({ workday: null, visits: [], uploads: [], installOffer: true })
const IPHONE_SAFARI_26 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1'
const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/138.0 Mobile Safari/537.36'

/** Chrome's install event, as the browser would fire it; records the prompt. */
const fireInstallEvent = (page: Page) =>
  page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
    e.prompt = async () => { (window as unknown as { prompted: boolean }).prompted = true }
    e.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(e)
  })

test('where the browser installs with one tap, the guide opens by itself and installs', async ({ page }, info) => {
  await installFakeSupabase(page, fresh())
  await page.goto('/s/workday')
  await fireInstallEvent(page)
  const sheet = page.getByRole('dialog', { name: 'Instalá Visitario' })
  await expect(sheet).toBeVisible({ timeout: 8_000 })
  await expect(sheet.getByText('Funciona sin señal', { exact: false })).toBeVisible()
  await page.screenshot({ path: `test-results/install-native-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Instalar Visitario' }).click()
  await expect.poll(() => page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true)
  await expect(sheet).toBeHidden()
})

test('on Android without the dialog: menu steps; "Ahora no" rests a week', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'Android phone only')
  await installFakeSupabase(page, fresh())
  await page.goto('/s/workday')
  const sheet = page.getByRole('dialog', { name: 'Instalá Visitario' })
  await expect(sheet).toBeVisible({ timeout: 8_000 })
  await expect(sheet.getByText('Instalar app', { exact: true })).toBeVisible()
  await page.screenshot({ path: `test-results/install-android-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Ahora no' }).click()
  await expect(sheet).toBeHidden()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('visitario.install') ?? '{}').dismissals)).toBe(1)
  await page.reload()
  await page.waitForTimeout(5_000)
  await expect(page.getByRole('dialog', { name: 'Instalá Visitario' })).toHaveCount(0)
})

test('a computer without one-tap install is not interrupted; the profile keeps the guide', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'computer only')
  await installFakeSupabase(page, fresh())
  await page.goto('/profile')
  await page.waitForTimeout(5_000)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('button', { name: /Instalar Visitario/ }).click()
  await expect(page.getByRole('dialog', { name: 'Instalá Visitario' }).getByText('Este navegador no instala apps', { exact: false })).toBeVisible()
})

test.describe('iPhone with Safari 26', () => {
  test.use({ userAgent: IPHONE_SAFARI_26 })
  test('shows the Share steps from the "···" menu', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only')
    await installFakeSupabase(page, fresh())
    await page.goto('/s/workday')
    const sheet = page.getByRole('dialog', { name: 'Instalá Visitario' })
    await expect(sheet).toBeVisible({ timeout: 8_000 })
    await expect(sheet.getByText('Tocá los tres puntos', { exact: false })).toBeVisible()
    await expect(sheet.getByText('Agregar a pantalla de inicio', { exact: true })).toBeVisible()
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(scroll).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `test-results/install-iphone-${info.project.name}.png` })
    await sheet.getByRole('button', { name: 'Ya lo instalé' }).click()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('visitario.install') ?? '{}').dismissals)).toBe(3)
  })
})

test.describe('inside another app on Android', () => {
  test.use({ userAgent: ANDROID_WEBVIEW })
  test('offers to open it in Chrome', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only')
    await installFakeSupabase(page, fresh())
    await page.goto('/s/workday')
    const sheet = page.getByRole('dialog', { name: 'Instalá Visitario' })
    await expect(sheet).toBeVisible({ timeout: 8_000 })
    await expect(sheet.getByRole('link', { name: 'Abrir en Chrome' })).toHaveAttribute('href', /^intent:\/\/.*package=com\.android\.chrome/)
    await expect(sheet.getByRole('button', { name: 'Copiar enlace' })).toBeVisible()
  })
})
