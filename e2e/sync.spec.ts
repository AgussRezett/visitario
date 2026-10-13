import { expect, test, type Page } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState, atFakeToday } from './support/fake-supabase'

// Written for Monday 12 October: run as if it were that day.
test.beforeEach(({ page }) => atFakeToday(page))

const DATE = '2026-10-12'

const day = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: DATE, status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Tres Arroyos 762')],
  uploads: [],
})

async function storefront(page: Page) {
  const photo = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1200
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.fillStyle = '#5b7f6a'
    ctx.fillRect(0, 0, 1200, 900)
    const url = canvas.toDataURL('image/jpeg', 0.9)
    return url.slice(url.indexOf(',') + 1)
  })
  await page.locator('input[type=file]').first().setInputFiles({ name: 'IMG.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(photo, 'base64') })
}

const pill = (page: Page, name: RegExp) => page.getByRole('button', { name }).filter({ visible: true }).first()

test('without signal the visit is worked and finished; it reaches the server when signal returns', async ({ page, context }, info) => {
  const state = day()
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await page.getByRole('link', { name: /Marcar llegada/ }).click() // the day is on the phone from here
  await expect(page.getByText('Llegada y fachada')).toBeVisible()

  await context.setOffline(true)
  await storefront(page)
  await expect(page.getByText(/con la foto de fachada/)).toBeVisible()
  await page.getByRole('radio', { name: 'Sí' }).click()
  await page.getByRole('button', { name: 'Terminar visita' }).click()
  await expect(page).toHaveURL(/\/s\/workday/)

  // The day already counts it; the pill says it is waiting on the phone.
  await expect(page.getByText(/1 de 1 visitados/)).toBeVisible()
  await pill(page, /Sin señal · 3 cambios guardados en el celu/).click()
  const sheet = page.getByRole('dialog', { name: /Sin señal/ })
  await expect(sheet.getByText('Foto de fachada · Tres Arroyos 762')).toBeVisible()
  await expect(sheet.getByText('Visita terminada · Tres Arroyos 762')).toBeVisible()
  await page.screenshot({ path: `test-results/sync-offline-${info.project.name}.png` })
  expect(state.uploads).toHaveLength(0)
  await page.keyboard.press('Escape')

  await context.setOffline(false)
  await expect.poll(() => state.uploads.length, { timeout: 10_000 }).toBe(1)
  await expect.poll(() => state.visits[0]?.work_status).toBe('done')
  await expect(pill(page, /Todo guardado/)).toBeVisible()
})

test('pending changes survive closing the app and go out on the next start', async ({ page }) => {
  const state = { ...day(), photoStatus: 503 }
  await installFakeSupabase(page, state)
  await page.goto('/visit/v1')
  await storefront(page)
  await expect(pill(page, /Enviando 1 cambio/)).toBeVisible()

  await page.reload()
  await expect(page.getByText(/con la foto de fachada/)).toBeVisible() // still shown, from the phone
  state.photoStatus = 0
  await pill(page, /Enviando 1 cambio/).click()
  await page.getByRole('button', { name: 'Enviar ahora' }).click()
  await expect.poll(() => state.uploads.length, { timeout: 10_000 }).toBe(1)
})

test('a change the server refuses can be retried or discarded', async ({ page }, info) => {
  const state = { ...day(), photoStatus: 403 }
  await installFakeSupabase(page, state)
  await page.goto('/visit/v1')
  await storefront(page)
  await pill(page, /Un cambio no se pudo guardar/).click()
  const sheet = page.getByRole('dialog', { name: 'Un cambio no se pudo guardar' })
  await expect(sheet.getByText('El servidor no aceptó la foto para esta visita.')).toBeVisible()
  await page.screenshot({ path: `test-results/sync-failed-${info.project.name}.png` })

  await sheet.getByRole('button', { name: 'Descartar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Descartar' }).click()
  await expect(page.getByRole('dialog', { name: 'Todo guardado' }).getByText('No hay nada pendiente en este celular.')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByText('Al llegar, sacá la foto de la fachada')).toBeVisible() // back to what the server has
})
