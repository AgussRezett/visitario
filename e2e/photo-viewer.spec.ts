import { expect, test, type Locator, type Page } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

const TODAY = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9])
const photo = (id: string, kind: string, displayId: string | null, order = 0): Row => ({ id, kind, display_id: displayId, sort_order: order, taken_at: `${TODAY}T14:20:00-03:00`, uploaded_at: `${TODAY}T14:20:01-03:00`, deleted_at: null })
const display = (id: string, type: number, order: number): Row => ({ id, display_type_id: type, reference: null, source: 'assigned', sort_order: order, deleted_at: null })

const state = (): FakeState => ({
  workday: null,
  uploads: [],
  photoUrls: true,
  memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
  people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }],
  catalogs: { display_type: [{ id: 1, name: 'Primaria', active: true }, { id: 2, name: 'Puntera', active: true }] },
  visits: [visitRow('v1', 0, 'Tres Arroyos 762', {
    merchandiser_id: 'p2', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' }, work_date: TODAY,
    work_status: 'done', consent: 'yes', arrived_at: `${TODAY}T14:12:00-03:00`, finished_at: `${TODAY}T14:58:00-03:00`,
    display: [display('d1', 1, 0), display('d2', 2, 1)],
    photo: [photo('f1', 'storefront', null), photo('b1', 'before', 'd1'), photo('a1', 'after', 'd1'), photo('b2', 'before', 'd2')],
  })],
})

/** A finger dragged sideways across the photo. */
async function swipe(page: Page, stage: Locator, direction: 'left' | 'right') {
  const box = await stage.boundingBox()
  if (!box) throw new Error('no stage')
  const y = box.y + box.height / 2
  const [from, to] = direction === 'left' ? [0.8, 0.2] : [0.2, 0.8]
  await page.mouse.move(box.x + box.width * from, y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * to, y + 10, { steps: 6 })
  await page.mouse.up()
}

test('the photo viewer names each photo\'s display as it moves, and moves by swiping too', async ({ page }, info) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.route('https://photos.test/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: JPEG }))
  await page.goto('/s/review')
  if (info.project.name !== 'desktop') await page.getByRole('link', { name: /Tres Arroyos 762/ }).click()

  await page.getByRole('button', { name: 'Ver 1 Primaria · antes' }).click()
  const viewer = page.getByRole('dialog', { name: '1 Primaria · antes' })
  await expect(viewer.getByText('Foto 2 de 4')).toBeVisible()

  // Tapping the right side: the next photo, with its own title.
  await page.getByRole('button', { name: 'Foto siguiente' }).click()
  await expect(page.getByRole('dialog', { name: '1 Primaria · después' })).toBeVisible()
  await expect(page.getByText('Foto 3 de 4')).toBeVisible()

  // Swiping left: the next one (only one step, though the swipe ends on a side).
  const stage = page.getByRole('button', { name: 'Foto siguiente' }).locator('..')
  await swipe(page, stage, 'left')
  await expect(page.getByRole('dialog', { name: '2 Puntera · antes' })).toBeVisible()
  await expect(page.getByText('Foto 4 de 4')).toBeVisible()
  await page.screenshot({ path: `test-results/photo-viewer-${info.project.name}.png` })

  // Swiping right: back.
  await swipe(page, stage, 'right')
  await expect(page.getByRole('dialog', { name: '1 Primaria · después' })).toBeVisible()
  await expect(page.getByText('Foto 3 de 4')).toBeVisible()

  // A short drag is not a swipe.
  const box = await stage.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 20, box.y + box.height / 2)
    await page.mouse.up()
  }
  await expect(page.getByText('Foto 3 de 4')).toBeVisible()

  // The keyboard too, on a computer.
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('dialog', { name: '1 Primaria · antes' })).toBeVisible()
})
