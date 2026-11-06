import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const LANDSCAPE = readFileSync(new URL('./fixtures/after-landscape.jpg', import.meta.url))
const PORTRAIT = readFileSync(new URL('./fixtures/after-portrait.jpg', import.meta.url))
const BACKGROUND = readFileSync(new URL('./fixtures/slide-bg.png', import.meta.url))

const photo = (id: string, displayId: string, kind: string, w: number, h: number, order = 0): Row => ({
  id, kind, display_id: displayId, sort_order: order, width: w, height: h, uploaded_at: '2026-10-08T15:00:00Z', deleted_at: null, created_at: '2026-10-08T15:00:00Z',
})
const done = (id: string, address: string, number: string | null, date: string, displays: Row[], photos: Row[], extra: Row = {}) =>
  visitRow(id, 0, address, {
    work_date: date, work_status: 'done', consent: 'yes',
    store: { id: `s-${id}`, name: null, address, area: 'Palermo', customer_number: number, lat: null, lng: null, location_status: 'verified', channel_id: null, seller_id: null },
    display: displays, photo: photos, ...extra,
  })

const state = (): FakeState => ({
  workday: null,
  uploads: [],
  photoUrls: true,
  company: { id: 'c1', name: 'Panda', kind: 'company', geocoding_scope: 'caba', show_whatsapp: true, messages_per_display: false, photo_retention_months: 12, logo_version: null, shift_start: '09:00:00', shift_end: '18:00:00', slides_cover_path: 'c1/cover-1.png', slides_page_path: 'c1/page-1.png' },
  visits: [
    // Two displays: the después of both, in the displays' order; the antes stay out.
    done('v1', 'Pedernera 452', '673', '2026-10-08',
      [{ id: 'd2', sort_order: 1, deleted_at: null }, { id: 'd1', sort_order: 0, deleted_at: null }],
      [photo('a2', 'd2', 'after', 1050, 1400), photo('b1', 'd1', 'before', 1050, 1400), photo('a1', 'd1', 'after', 1400, 1054), photo('a3', 'd2', 'after', 1050, 1400, 1)]),
    done('v2', 'Alberdi 1021', '10142', '2026-10-09', [{ id: 'd3', sort_order: 0, deleted_at: null }], [photo('a4', 'd3', 'after', 1050, 1400)]),
    // Authorized and finished but without después: counts in the total, no slide.
    done('v3', 'Tinogasta 5957', '1762', '2026-10-09', [], []),
  ],
})

test('the photo presentation: total on the cover, one slide per visit with every después, tidied and downloaded', async ({ page }, info) => {
  const s = { ...state(), photoFiles: { a1: LANDSCAPE, a2: PORTRAIT, a3: PORTRAIT, a4: PORTRAIT } }
  await installFakeSupabase(page, s, 'supervisor')
  // After the fake: the routes added last answer first.
  // Like the real bucket: its links show as images, but a script cannot read them (no CORS).
  await page.route('https://photos.test/**', (r) => (r.request().resourceType() === 'image'
    ? r.fulfill({ contentType: 'image/jpeg', body: r.request().url().includes('/a1.') ? LANDSCAPE : PORTRAIT })
    : r.abort('accessdenied')))
  await page.route('**/storage/v1/object/public/slides/**', (r) => r.fulfill({ contentType: 'image/png', body: BACKGROUND }))
  await page.goto('/s/reports?view=slides&period=custom&from=2026-10-01&to=2026-10-31')

  await expect(page.getByRole('heading', { name: 'Presentación de fotos' })).toBeVisible()
  const summary = page.getByRole('region', { name: 'La presentación' })
  await expect(summary).toContainText('3activaciones autorizadas y terminadas')
  await expect(summary).toContainText('3diapositivas con la portada')
  await expect(summary).toContainText('4fotos del después')
  await expect(summary).toContainText('1 activación no tiene fotos del después')

  const first = page.getByRole('figure', { name: 'Diapositiva 2: Pedernera 452 #673' })
  await expect(first).toBeVisible()
  await expect(first.getByRole('button', { name: /^Foto \d de 3$/ })).toHaveCount(3)
  await expect(page.getByRole('figure', { name: 'Diapositiva 3: Alberdi 1021 #10142' })).toContainText('09/10')
  await expect(page.getByRole('figure', { name: /Tinogasta/ })).toHaveCount(0) // no después: no slide
  await page.screenshot({ path: `test-results/slides-${info.project.name}.png`, fullPage: true })

  // One photo out of the slide, and back.
  await first.getByRole('button', { name: 'Foto 3 de 3' }).click()
  await first.getByRole('button', { name: 'Sacar de la diapositiva' }).click()
  await expect(first.getByRole('button', { name: /^Foto \d de 2$/ })).toHaveCount(2)
  await expect(summary).toContainText('3fotos del después')
  await first.getByRole('button', { name: 'Volver a poner esta foto' }).click()
  await expect(summary).toContainText('4fotos del después')

  const download = page.waitForEvent('download')
  await summary.getByRole('button', { name: 'Descargar PowerPoint' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('visitario-2026-10-01-a-2026-10-31.pptx')
  await file.saveAs(`test-results/deck-${info.project.name}.pptx`)
  const pptx = readFileSync(await file.path())
  const names = pptx.toString('latin1')
  // The cover and two slides (the visit without después has none).
  expect(names).toContain('ppt/slides/slide3.xml')
  expect(names).not.toContain('ppt/slides/slide4.xml')
  // The backgrounds are pictures behind everything, not slide backgrounds: those are lost
  // when a slide is pasted into another presentation.
  const zip = await JSZip.loadAsync(pptx)
  for (const n of [1, 2, 3]) {
    const xml = (await zip.file(`ppt/slides/slide${n}.xml`)?.async('string')) ?? ''
    expect(xml).not.toContain('<p:bg>')
    expect(xml.indexOf('descr="Fondo"')).toBeGreaterThan(0)
    expect(xml.indexOf('descr="Fondo"')).toBeLessThan(xml.indexOf('<p:sp>') < 0 ? Infinity : xml.indexOf('<p:sp>'))
  }
  await expect(summary).toContainText('Listo: la presentación se descargó.')
})
