import { expect, test } from '@playwright/test'
import { FAKE_TODAY, atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

// A fake camera: Chromium plays a test pattern as the video and never asks.
test.use({ launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] } })
test.beforeEach(({ page }) => atFakeToday(page))

const state = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: FAKE_TODAY, status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Gorostiaga 1708', { work_date: FAKE_TODAY, consent: 'yes' })],
  uploads: [],
})

test('on the phone the storefront photo is taken inside Visitario, without leaving the app', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'phones only: the computer opens its files')
  await context.grantPermissions(['camera'])
  const s = state()
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Marcar llegada con la foto de la fachada' }).click()
  const camera = page.getByRole('dialog', { name: 'Cámara' })
  await expect(camera).toBeVisible()
  const shutter = camera.getByRole('button', { name: 'Sacar la foto' })
  await expect(shutter).toBeEnabled()
  await page.screenshot({ path: 'test-results/camera-mobile.png' })
  await shutter.click()
  await expect(camera).toBeHidden()
  await expect(page.getByText(/con la foto de fachada/)).toBeVisible()
  await expect.poll(() => s.uploads.map((u) => u.meta.kind)).toEqual(['storefront'])
})

test('closing the camera takes nothing', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'phones only')
  await context.grantPermissions(['camera'])
  const s = state()
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Sacar la foto de la fachada' }).click()
  await page.getByRole('dialog', { name: 'Cámara' }).getByRole('button', { name: 'Cerrar la cámara' }).click()
  await expect(page.getByRole('dialog', { name: 'Cámara' })).toBeHidden()
  expect(s.uploads).toHaveLength(0)
})

test('without camera access it offers the phone’s camera app', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'phones only')
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { configurable: true, value: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) })
  })
  await installFakeSupabase(page, state())
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Marcar llegada con la foto de la fachada' }).click()
  const camera = page.getByRole('dialog', { name: 'Cámara' })
  await expect(camera.getByText('No pudimos abrir la cámara acá')).toBeVisible()
  const chooser = page.waitForEvent('filechooser')
  await camera.getByRole('button', { name: 'Abrir la cámara del celular' }).click()
  expect(await (await chooser).element().getAttribute('capture')).toBe('environment')
})

test('on the computer the button opens the files, as before', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'computer only')
  await installFakeSupabase(page, state())
  await page.goto('/visit/v1')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Marcar llegada con la foto de la fachada' }).click()
  await chooser
  await expect(page.getByRole('dialog', { name: 'Cámara' })).toHaveCount(0)
})

test('if the phone closed the app while choosing a photo, the visit says so once', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e.marked')) return
    sessionStorage.setItem('e2e.marked', '1')
    sessionStorage.setItem('visitario.picking', JSON.stringify({ path: '/visit/v1', at: Date.now() }))
  })
  await installFakeSupabase(page, state())
  await page.goto('/visit/v1')
  await expect(page.getByText('El celular cerró Visitario mientras elegías la foto', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Entendido' }).click()
  await expect(page.getByText('La foto no llegó')).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Marcar llegada con la foto de la fachada' }).first()).toBeAttached()
  await expect(page.getByText('La foto no llegó')).toHaveCount(0)
})
