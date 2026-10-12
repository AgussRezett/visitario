import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const DATE = '2026-10-12'
const ADDRESSES = ['Amenábar 1260', 'Moldes 1365', 'Tres Arroyos 762', 'Vidal 2044', 'Cabildo 2280']

test('opens an own workday, adds 5 addresses and sees them in order', async ({ page }, info) => {
  const state: FakeState = { workday: null, visits: [], uploads: [] }
  await installFakeSupabase(page, state)
  await page.goto(`/s/workday?date=${DATE}`)

  await expect(page.getByRole('heading', { name: /no tenés jornada/i })).toBeVisible()
  await page.getByRole('button', { name: 'Abrir jornada' }).click()
  await expect(page.getByRole('heading', { name: 'Mi jornada' })).toBeVisible()

  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  await page.getByRole('radio', { name: 'Pegar varias' }).click()
  await page.getByLabel('Direcciones').fill(ADDRESSES.join('\n'))
  await page.getByRole('button', { name: 'Agregar 5 direcciones' }).click()

  await expect(page.getByText('0 de 5 visitados')).toBeVisible()
  const region = info.project.name === 'desktop' ? page.getByRole('table', { name: 'Locales de la jornada' }) : page.getByRole('region', { name: 'Locales' })
  const text = await region.innerText()
  const positions = ADDRESSES.map((a) => text.indexOf(a))
  expect(positions.every((p) => p >= 0)).toBe(true)
  expect([...positions].sort((a, b) => a - b)).toEqual(positions)
})

test('a visit cannot end without the storefront photo and the store’s answer', async ({ page }) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: DATE, status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Tres Arroyos 762')],
    uploads: [],
  }
  await installFakeSupabase(page, state)
  await page.goto('/visit/v1')

  const finish = page.getByRole('button', { name: 'Terminar visita' })
  await expect(finish).toBeDisabled()
  await expect(page.getByText('Falta la foto de la fachada. Falta marcar si el local te autorizó.')).toBeVisible()

  // A big phone photo with a GPS tag in its metadata
  const photo = await page.evaluate(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 4000
    canvas.height = 3000
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    const g = ctx.createLinearGradient(0, 0, 4000, 3000)
    g.addColorStop(0, '#5b7f6a')
    g.addColorStop(1, '#d8c9a3')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4000, 3000)
    // Fine grain like a real photo, from a repeated noise tile (fast to draw)
    const tile = document.createElement('canvas')
    tile.width = 256
    tile.height = 256
    const tctx = tile.getContext('2d')
    if (!tctx) throw new Error('no canvas')
    const noise = tctx.createImageData(256, 256)
    for (let i = 0; i < noise.data.length; i += 4) {
      const n = Math.random() * 255
      noise.data[i] = n
      noise.data[i + 1] = n
      noise.data[i + 2] = n
      noise.data[i + 3] = 40
    }
    tctx.putImageData(noise, 0, 0)
    const pattern = ctx.createPattern(tile, 'repeat')
    if (pattern) {
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, 4000, 3000)
    }
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
    const dataUrl = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.readAsDataURL(blob as Blob)
    })
    return dataUrl.slice(dataUrl.indexOf(',') + 1)
  })
  const jpeg = Buffer.from(photo, 'base64')
  const exif = Buffer.concat([Buffer.from([0xff, 0xe1, 0x00, 0x1a]), Buffer.from('Exif\0\0MM\0*\0\0\0\x08\0\0GPSLatitude', 'latin1')])
  const withGps = Buffer.concat([jpeg.subarray(0, 2), exif, jpeg.subarray(2)])
  expect(withGps.length).toBeGreaterThan(3_500_000)

  await page.locator('input[type=file]').first().setInputFiles({ name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer: withGps })
  await expect(page.getByText(/con la foto de fachada/)).toBeVisible()
  const upload = state.uploads[0]
  expect(upload?.bytes.length).toBeLessThan(400_000)
  expect(upload?.meta.width).toBe(1400)
  expect(upload?.bytes.includes(Buffer.from('Exif'))).toBe(false)
  expect(upload?.bytes.includes(Buffer.from('GPS'))).toBe(false)

  await expect(finish).toBeDisabled()
  await page.getByRole('radio', { name: 'Sí' }).click()
  await expect(finish).toBeEnabled()
  await finish.click()
  await expect(page).toHaveURL(/\/s\/workday/)
  expect(state.visits[0]?.work_status).toBe('done')
})
