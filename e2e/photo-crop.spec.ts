import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import JSZip from 'jszip'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const LANDSCAPE = readFileSync(new URL('./fixtures/after-landscape.jpg', import.meta.url))

/** The size a JPEG says it has (its frame header). */
function jpegSize(b: Buffer) {
  for (let i = 2; i < b.length - 9; ) {
    if (b[i] !== 0xff) return null
    const marker = b[i + 1] ?? 0
    if (marker >= 0xc0 && marker <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    i += 2 + b.readUInt16BE(i + 2)
  }
  return null
}

/** Drags the crop box's bottom-right corner towards its middle. */
async function shrink(page: Page, sheet: Locator) {
  const box = await sheet.getByRole('group', { name: /Recorte/ }).boundingBox()
  if (!box) throw new Error('no crop box')
  await page.mouse.move(box.x + box.width - 6, box.y + box.height - 6)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.55, box.y + box.height - 6, { steps: 6 })
  await page.mouse.up()
}

test('the activador crops a photo of their visit: optional, and it shows cropped', async ({ page }, info) => {
  const s: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Altolaguirre 1952', {
      consent: 'yes', work_status: 'in_progress', arrived_at: '2026-10-12T13:00:00Z',
      photo: [{ id: 'f1', kind: 'storefront', display_id: null, taken_at: '2026-10-12T13:00:00Z', uploaded_at: '2026-10-12T13:00:01Z', deleted_at: null, width: 1400, height: 1054, crop: null }],
    })],
    uploads: [],
    photoUrls: true,
  }
  await installFakeSupabase(page, s)
  await page.route('https://photos.test/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: LANDSCAPE }))
  await page.goto('/visit/v1')

  const thumb = page.getByRole('button', { name: 'Ver la foto de la fachada' })
  await thumb.click()
  const viewer = page.getByRole('dialog', { name: 'Fachada' })
  await viewer.getByRole('button', { name: 'Recortar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Recortar foto' })
  await expect(sheet.getByRole('button', { name: 'Ver entera' })).toBeDisabled() // starts whole
  await shrink(page, sheet)
  await expect(sheet.getByRole('button', { name: 'Ver entera' })).toBeEnabled()
  await page.screenshot({ path: `test-results/photo-crop-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Guardar recorte' }).click()
  await expect(sheet).toBeHidden()

  await expect.poll(() => s.crops?.length).toBe(1)
  const [x, y, w, h] = (s.crops?.[0]?.p_crop as number[]) ?? []
  expect([x, y, h]).toEqual([0, 0, 1])
  expect(w).toBeGreaterThan(0.4)
  expect(w).toBeLessThan(0.7)
  // The viewer and the tile show the cropped part.
  await expect(viewer.locator('svg image')).toHaveCount(1)
  await page.screenshot({ path: `test-results/photo-cropped-${info.project.name}.png` })
  await page.keyboard.press('Escape')
  await expect(thumb.locator('svg image')).toHaveCount(1)

  // And back to whole.
  await thumb.click()
  await viewer.getByRole('button', { name: 'Recortar' }).click()
  await sheet.getByRole('button', { name: 'Ver entera' }).click()
  await sheet.getByRole('button', { name: 'Guardar recorte' }).click()
  await expect.poll(() => s.crops?.length).toBe(2)
  expect(s.crops?.[1]?.p_crop).toBeNull()
})

test('the supervisor crops a después in the presentation and the PowerPoint takes it cropped', async ({ page }) => {
  const photo = (id: string): Row => ({ id, kind: 'after', display_id: 'd1', sort_order: 0, width: 1400, height: 1054, crop: null, uploaded_at: '2026-10-08T15:00:00Z', deleted_at: null, created_at: '2026-10-08T15:00:00Z' })
  const s: FakeState = {
    workday: null, uploads: [], photoUrls: true,
    company: { id: 'c1', name: 'Panda', kind: 'company', geocoding_scope: 'caba', show_whatsapp: true, messages_per_display: false, photo_retention_months: 12, logo_version: null, shift_start: '09:00:00', shift_end: '18:00:00', slides_cover_path: null, slides_page_path: null },
    visits: [visitRow('v1', 0, 'Pedernera 452', {
      work_date: '2026-10-08', work_status: 'done', consent: 'yes',
      display: [{ id: 'd1', sort_order: 0, deleted_at: null }], photo: [photo('a1')],
    })],
    photoFiles: { a1: LANDSCAPE },
  }
  await installFakeSupabase(page, s, 'supervisor')
  await page.route('https://photos.test/**', (r) => (r.request().resourceType() === 'image' ? r.fulfill({ contentType: 'image/jpeg', body: LANDSCAPE }) : r.abort('accessdenied')))
  await page.goto('/s/reports?view=slides&period=custom&from=2026-10-01&to=2026-10-31')

  const slide = page.getByRole('figure', { name: /Diapositiva 2/ })
  await slide.getByRole('button', { name: 'Foto 1 de 1' }).click()
  await slide.getByRole('button', { name: 'Recortar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Recortar foto' })
  await shrink(page, sheet)
  await sheet.getByRole('button', { name: 'Guardar recorte' }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => s.crops?.length).toBe(1)
  await expect(slide.locator('svg image')).toHaveCount(1)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar PowerPoint' }).click()
  const zip = await JSZip.loadAsync(readFileSync(await (await download).path()))
  const media = Object.keys(zip.files).filter((n) => n.startsWith('ppt/media/'))
  const sizes = await Promise.all(media.map(async (n) => jpegSize(Buffer.from(await zip.file(n)?.async('uint8array') ?? []))))
  const photoSize = sizes.find(Boolean)
  // The original is 4:3; cropped to about half its width it comes out taller than wide.
  expect(photoSize && photoSize.w / photoSize.h).toBeLessThan(1)
})
