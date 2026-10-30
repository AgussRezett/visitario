import { expect, test, type Page } from '@playwright/test'
import { installFakeSupabase, type FakeState } from './support/fake-supabase'

const base = (extra: Partial<FakeState> = {}): FakeState => ({ workday: null, visits: [], uploads: [], ...extra })

/** A real JPEG made in the page: the profile re-encodes it before uploading. */
async function photo(page: Page) {
  const b64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 800
    canvas.height = 600
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#3a7'
      ctx.fillRect(0, 0, 800, 600)
    }
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1] ?? ''
  })
  return { name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') }
}

test('everyone sees their data, edits it and adds a profile photo', async ({ page }, info) => {
  const state = base()
  await installFakeSupabase(page, state)
  await page.goto('/profile')
  await expect(page.getByRole('heading', { name: 'Agustín Rezett' })).toBeVisible()
  await expect(page.getByText('Activador · Panda')).toBeVisible()
  await expect(page.getByText('35.111.222')).toBeVisible()
  await expect(page.getByText('No se cambia: es tu identidad en Visitario')).toBeVisible()
  await page.screenshot({ path: `test-results/profile-${info.project.name}.png`, fullPage: true })

  // Data
  await page.getByRole('button', { name: 'Editar mis datos' }).click()
  const form = page.getByRole('form', { name: 'Editar mis datos' })
  await form.getByLabel('Nombre', { exact: true }).fill('Agus')
  await form.getByLabel('Celular').fill('1234')
  await form.getByRole('button', { name: 'Guardar' }).click()
  await expect(form.getByText('Escribilo con característica, por ejemplo 11 5555-4521')).toBeVisible()
  await form.getByLabel('Celular').fill('11 5555-4521')
  await form.getByLabel('Fecha de nacimiento').fill('1995-04-12')
  await form.getByRole('button', { name: 'Guardar' }).click()
  await expect(page.getByText('Datos guardados.')).toBeVisible()
  expect(state.profile).toMatchObject({ first_name: 'Agus', last_name: 'Rezett', phone: '+5491155554521', birth_date: '1995-04-12' })
  await expect(page.getByText('11 5555-4521')).toBeVisible()

  // Photo
  await page.getByRole('button', { name: 'Agregar una foto de perfil' }).click()
  const sheet = page.getByRole('dialog', { name: 'Foto de perfil' })
  await expect(sheet.getByText('Se guarda sin ubicación.', { exact: false })).toBeVisible()
  await page.locator('input[type=file]').nth(1).setInputFiles(await photo(page))
  // Framing: the person moves and zooms before using it; nothing is uploaded until then.
  const crop = page.getByRole('dialog', { name: 'Encuadrá tu foto' })
  const frame = crop.getByRole('group', { name: /Encuadre de la foto/ })
  await expect(frame.locator('img')).toBeVisible()
  await crop.getByRole('slider', { name: 'Acercar' }).fill('2')
  const box = await frame.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 4 })
    await page.mouse.up()
  }
  await page.screenshot({ path: `test-results/profile-crop-${info.project.name}.png` })
  expect(state.storage?.avatars?.uploaded ?? []).toHaveLength(0)
  await crop.getByRole('button', { name: 'Elegir otra' }).click()
  await expect(page.getByRole('dialog', { name: 'Foto de perfil' })).toBeVisible()
  await page.locator('input[type=file]').nth(1).setInputFiles(await photo(page))
  await page.getByRole('dialog', { name: 'Encuadrá tu foto' }).getByRole('button', { name: 'Usar esta foto' }).click()
  await expect.poll(() => state.storage?.avatars?.uploaded?.length).toBe(1)
  expect(state.storage?.avatars?.uploaded?.[0]).toMatch(/^u1\/\d+\.jpg$/)
  await expect.poll(() => state.profile?.avatar_path).toBe(state.storage?.avatars?.uploaded?.[0])
  await expect(page.getByRole('button', { name: 'Cambiar mi foto de perfil' })).toBeVisible()

  await page.getByRole('button', { name: 'Cambiar mi foto de perfil' }).click()
  await page.getByRole('dialog', { name: 'Foto de perfil' }).getByRole('button', { name: 'Quitar la foto' }).click()
  await expect.poll(() => state.profile?.avatar_path).toBeNull()
  await expect.poll(() => state.storage?.avatars?.removed ?? []).toContain(state.storage?.avatars?.uploaded?.[0])
})

test('changing the email sends a link and says so until it is opened', async ({ page }) => {
  const state = base()
  await installFakeSupabase(page, state)
  await page.goto('/profile')
  await page.getByRole('button', { name: 'Cambiar', exact: true }).first().click()
  const form = page.getByRole('form', { name: 'Cambiar email' })
  await form.getByLabel('Email nuevo').fill('agus@example.com')
  await form.getByRole('button', { name: 'Mandar enlace' }).click()
  await expect(form.getByText('Es el mismo que ya tenés')).toBeVisible()
  await form.getByLabel('Email nuevo').fill('agus.nuevo@example.com')
  await form.getByRole('button', { name: 'Mandar enlace' }).click()
  await expect(page.getByText('Te mandamos un enlace a agus.nuevo@example.com.', { exact: false })).toBeVisible()
  expect(state.profile?.new_email).toBe('agus.nuevo@example.com')
  await page.reload()
  await expect(page.getByText('Te mandamos un enlace a agus.nuevo@example.com.', { exact: false })).toBeVisible()
})

test('my photo shows in the bottom bar and the sidebar', async ({ page }, info) => {
  await installFakeSupabase(page, base({ profile: { avatar_path: 'u1/1792740000000.jpg' } }))
  await page.goto('/s/workday')
  const where = info.project.name === 'mobile' ? page.getByRole('navigation', { name: 'Secciones' }) : page.locator('aside')
  await expect(where.getByRole('link', { name: /Perfil|Agustín/ }).locator('img')).toHaveAttribute('src', /avatars\/u1\/1792740000000\.jpg$/)
})

test('a supervisor sees the same profile, with their photo in the header', async ({ page }) => {
  const state = base({
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
    profile: { avatar_path: 'u1/1792740000000.jpg' },
  })
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/profile')
  await expect(page.getByText('Supervisor · Panda')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cambiar mi foto de perfil' }).locator('img')).toHaveAttribute('src', /avatars\/u1\/1792740000000\.jpg$/)
})
