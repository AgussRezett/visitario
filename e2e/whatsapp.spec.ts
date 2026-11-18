import { expect, test, type Page } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const photo = (id: string, kind: string, displayId: string | null) => ({ id, kind, display_id: displayId, taken_at: '2026-10-12T13:00:00Z', uploaded_at: '2026-10-12T13:00:01Z', deleted_at: null })
const display = (id: string, type: number, order: number) => ({ id, display_type_id: type, reference: null, source: 'found', sort_order: order, deleted_at: null })

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
const state = (): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Altolaguirre 1952', {
    consent: 'yes', work_status: 'in_progress', arrived_at: '2026-10-12T13:00:00Z',
    display: [display('d1', 1, 0), display('d2', 2, 1)],
    // The Puntera has no DESPUÉS photo yet.
    photo: [photo('f1', 'storefront', null), photo('b1', 'before', 'd1'), photo('b2', 'before', 'd2'), photo('a1', 'after', 'd1'), photo('a1b', 'after', 'd1')],
  })],
  uploads: [],
  photoUrls: true,
  // The bytes come through the photos function.
  photoFiles: Object.fromEntries(['f1', 'b1', 'b2', 'a1', 'a1b'].map((id) => [id, JPEG])),
  company: { id: 'c1', name: 'Panda', show_whatsapp: true, messages_per_display: true },
  catalogs: { display_type: [{ id: 1, name: 'Góndola', active: true }, { id: 2, name: 'Puntera', active: true }] },
  templates: [
    { kind: 'before', body: 'ANTES\nTIPO DE EXHIBICION: {EXHIBICIONES}' },
    { kind: 'after', body: 'DESPUÉS\nTIPO DE EXHIBICION: {EXHIBICIONES}' },
  ],
})

/** The phone's share sheet: records what goes out; `cancelNext` acts as closing it without sending. */
async function fakeShare(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { shares: { text?: string; files: string[] }[]; cancelNext?: boolean }
    w.shares = []
    Object.defineProperty(Navigator.prototype, 'canShare', { configurable: true, value: () => true })
    Object.defineProperty(Navigator.prototype, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        if (w.cancelNext) {
          w.cancelNext = false
          throw new DOMException('Share canceled', 'AbortError')
        }
        w.shares.push({ text: data.text, files: (data.files ?? []).map((f) => f.name) })
      },
    })
  })
  // Like the real bucket: its links show as images but cannot be read (no CORS).
  await page.route('https://photos.test/**', (r) => (r.request().resourceType() === 'image'
    ? r.fulfill({ contentType: 'image/jpeg', body: JPEG })
    : r.abort('accessdenied')))
}

const shares = (page: Page) => page.evaluate(() => (window as unknown as { shares: { text?: string; files: string[] }[] }).shares)

test('the activador sends the visit to WhatsApp one message at a time, with its photos', async ({ page }, info) => {
  await fakeShare(page)
  await installFakeSupabase(page, state())
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: /Enviar a WhatsApp/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Enviar a WhatsApp' })
  await expect(sheet.getByText('0 de 5 enviados')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Enviar DESPUÉS · Puntera · Falta la foto' })).toBeDisabled()
  await page.screenshot({ path: `test-results/whatsapp-send-${info.project.name}.png` })

  await sheet.getByRole('button', { name: 'Enviar Fachada', exact: true }).click()
  await expect.poll(() => shares(page)).toEqual([{ text: 'Altolaguirre 1952', files: ['Fachada.jpg'] }])
  await sheet.getByRole('button', { name: 'Enviar ANTES · Góndola', exact: true }).click()
  await expect.poll(async () => (await shares(page))[1]).toEqual({ text: 'ANTES\nTIPO DE EXHIBICION: GÓNDOLA', files: ['ANTES - Góndola.jpg'] })
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('ANTES\nTIPO DE EXHIBICION: GÓNDOLA')

  // Closing WhatsApp's sheet without sending keeps it as the next one.
  await page.evaluate(() => { (window as unknown as { cancelNext: boolean }).cancelNext = true })
  await sheet.getByRole('button', { name: 'Enviar ANTES · Puntera', exact: true }).click()
  await expect(sheet.getByText('2 de 5 enviados')).toBeVisible()
  await sheet.getByRole('button', { name: 'Enviar ANTES · Puntera', exact: true }).click()
  // Two photos: one album, the text copied to paste once (WhatsApp would repeat it on each photo).
  await expect(sheet.getByText('Van 2 fotos juntas y el texto queda copiado: pegalo en la primera, así sale una sola vez.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Enviar DESPUÉS · Góndola', exact: true }).click()
  await expect.poll(async () => (await shares(page))[3]).toEqual({ files: ['DESPUÉS - Góndola.jpg', 'DESPUÉS - Góndola 2.jpg'] })
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: GÓNDOLA')
  await expect(sheet.getByText('4 de 5 enviados')).toBeVisible()
  await expect(sheet.getByText('Lo que falta se habilita cuando saques sus fotos.')).toBeVisible()
  await page.screenshot({ path: `test-results/whatsapp-sent-${info.project.name}.png` })

  // Coming back from WhatsApp may reload the app: what was sent is remembered.
  await page.reload()
  await expect(page.getByRole('button', { name: /Enviar a WhatsApp/ })).toContainText('4 de 5 enviados')
  await page.getByRole('button', { name: /Enviar a WhatsApp/ }).click()
  await sheet.getByRole('button', { name: 'Volver a enviar Fachada · Enviado' }).click()
  await expect.poll(async () => (await shares(page)).length).toBe(1)
})

test('without a share sheet (a computer), the texts are still there to copy', async ({ page }) => {
  await installFakeSupabase(page, state())
  await page.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'share', { configurable: true, value: undefined }) })
  await page.goto('/visit/v1')
  await expect(page.getByRole('button', { name: 'Copiar ANTES de Góndola' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Enviar a WhatsApp/ })).toHaveCount(0)
})

test('the observations are copied and sent too, as text, after the photos', async ({ page }, info) => {
  await fakeShare(page)
  const s = state()
  s.visits = s.visits.map((v) => ({ ...v, notes: 'Faltó SKYY en la góndola' }))
  await installFakeSupabase(page, s)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Copiar Observaciones' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('Observaciones: Faltó SKYY en la góndola')
  await page.screenshot({ path: `test-results/whatsapp-notes-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: /Enviar a WhatsApp/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Enviar a WhatsApp' })
  await expect(sheet.getByText('0 de 6 enviados')).toBeVisible()
  await sheet.getByRole('region', { name: 'Observaciones' }).getByRole('button', { name: /Enviar Observaciones/ }).click()
  await expect.poll(() => shares(page)).toEqual([{ text: 'Observaciones: Faltó SKYY en la góndola', files: [] }])
  await expect(sheet.getByText('1 de 6 enviados')).toBeVisible()
})

test('without observations there is nothing extra to send', async ({ page }) => {
  await fakeShare(page)
  await installFakeSupabase(page, state())
  await page.goto('/visit/v1')
  await expect(page.getByRole('button', { name: 'Copiar Observaciones' })).toHaveCount(0)
  await expect(page.getByText('Si escribís observaciones en la visita')).toBeVisible()
})

test('photos taken earlier (not on this phone) are sent: their bytes come through the function, not the link', async ({ page }) => {
  await fakeShare(page)
  // The storefront photo fails once (still uploading, no signal), then comes.
  const s = state()
  let tries = 0
  await page.route('**/functions/v1/photos/file', async (r) => {
    if ((r.request().postDataJSON() as { id?: string }).id === 'f1' && tries++ === 0) return r.fulfill({ status: 502, body: '{"error":"storage_failed"}' })
    return r.fallback()
  })
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: /Enviar a WhatsApp/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Enviar a WhatsApp' })
  // It does not stay on "Reintentar": it tries again by itself and gets ready.
  await expect(sheet.getByRole('button', { name: 'Enviar Fachada · Siguiente', exact: true })).toBeVisible({ timeout: 10_000 })
  await sheet.getByRole('button', { name: 'Enviar Fachada · Siguiente', exact: true }).click()
  await expect.poll(() => shares(page)).toEqual([{ text: 'Altolaguirre 1952', files: ['Fachada.jpg'] }])
  await sheet.getByRole('button', { name: 'Enviar ANTES · Góndola', exact: true }).click()
  await expect.poll(async () => (await shares(page))[1]?.files).toEqual(['ANTES - Góndola.jpg'])
})
