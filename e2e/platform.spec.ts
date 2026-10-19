import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState, type Row } from './support/fake-supabase'

const company = (id: string, name: string, extra: Row = {}): Row => ({
  id, name, kind: 'distributor', created_at: '2026-10-01T12:00:00-03:00', plan: 'pilot', status: 'active', ends_on: null,
  members: 8, invited: 0, admins: 'Carla López', visits_30d: 412, last_activity_at: new Date().toISOString(),
  photos: 9800, photo_bytes: 2_100_000_000, ai_captures: 104, ai_cost_usd_thousandths: 210, support_until: null, ...extra,
})

const platform = (): FakeState => ({
  workday: null, visits: [], uploads: [],
  platform: {
    companies: [
      company('c1', 'Panda'),
      company('c2', 'Agustin · uso propio', { kind: 'personal', plan: 'free', members: 1, admins: 'Agustín Rezett', visits_30d: 60, photos: 300, photo_bytes: 100_000_000, ai_captures: 0, ai_cost_usd_thousandths: 0 }),
    ],
    snapshot: {
      company: { name: 'Panda' },
      members: [
        { name: 'Lucía Gómez', roles: ['merchandiser'], status: 'active', team: 'Norte', last_visit_at: new Date().toISOString(), sync_pending: 0, sync_failed: 2, sync_reported_at: new Date().toISOString() },
        { name: 'Martín Sosa', roles: ['supervisor'], status: 'active', team: 'Norte', last_visit_at: null, sync_pending: null, sync_failed: null, sync_reported_at: null },
      ],
      teams: ['Norte'],
      days: [{ date: '2026-10-17', visits: 15, finished: 14, approved: 10, photos: 42 }],
      catalogs: { brands: 5, display_types: 6, stores: 230 },
      sessions: [{ reason: 'Martín no ve las visitas de Lucía', starts_at: new Date().toISOString(), ends_at: new Date(Date.now() + 7200_000).toISOString(), by: 'Agustín Rezett' }],
    },
  },
})

test('the super admin sees every company, creates one and changes a plan', async ({ page }, info) => {
  const state = platform()
  await installFakeSupabase(page, state)
  await page.goto('/platform')
  await expect(page.getByRole('heading', { name: 'Empresas · 2' })).toBeVisible()
  await expect(page.getByText('USD 0,21')).toBeVisible()
  await expect(page.getByText('2,6 GB')).toBeVisible()
  await page.screenshot({ path: `test-results/platform-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Crear empresa' }).click()
  const sheet = page.getByRole('dialog', { name: 'Crear empresa' })
  await sheet.getByLabel('Nombre', { exact: true }).fill('Panda')
  await sheet.getByLabel('DNI').fill('33.444.555')
  await sheet.getByLabel('Email del admin').fill('Rita@Sur.com')
  await sheet.getByRole('button', { name: 'Crear e invitar al admin' }).click()
  await expect(sheet.getByText('Ya hay una empresa con ese nombre.')).toBeVisible()
  await sheet.getByLabel('Nombre', { exact: true }).fill('Distribuidora Sur')
  await page.screenshot({ path: `test-results/platform-create-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Crear e invitar al admin' }).click()
  await expect.poll(() => state.platform?.created?.[0]).toMatchObject({ p_name: 'Distribuidora Sur', p_kind: 'distributor', p_plan: 'pilot' })
  // Its first admin, invited by email
  await expect(page.getByText('Le mandamos la invitación a rita@sur.com')).toBeVisible()
  expect(state.invite?.created?.[0]).toMatchObject({ companyId: 'new-2', dni: '33444555', email: 'rita@sur.com', roles: ['admin'] })
  await page.getByRole('button', { name: 'Ver la empresa' }).click()

  // The new company opens: plan to Equipo
  const created = page.getByRole('dialog', { name: 'Distribuidora Sur' })
  await expect(created.getByText('0 usuarios')).toBeVisible()
  await created.getByRole('combobox', { name: 'Plan', exact: true }).selectOption('team')
  await created.getByRole('button', { name: 'Guardar plan' }).click()
  await expect.poll(() => state.platform?.companies.find((c) => c.name === 'Distribuidora Sur')?.plan).toBe('team')
})

test('support: a reason opens a read-only look at the company, on record', async ({ page }, info) => {
  const state = platform()
  await installFakeSupabase(page, state)
  await page.goto('/platform')
  await page.getByRole('button', { name: /^Panda/ }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Panda' })
  const open = sheet.getByRole('button', { name: 'Abrir soporte por 2 horas' })
  await sheet.getByLabel('Motivo').fill('mirar')
  await expect(open).toBeDisabled() // a reason of at least 10 characters
  await sheet.getByLabel('Motivo').fill('Martín no ve las visitas de Lucía')
  await open.click()
  await expect.poll(() => state.platform?.sessions?.[0]).toMatchObject({ p_company: 'c1', p_reason: 'Martín no ve las visitas de Lucía' })
  await sheet.getByRole('link', { name: 'Ver la empresa' }).click()

  await expect(page).toHaveURL(/\/platform\/c1$/)
  await expect(page.getByText('Soporte · solo lectura')).toBeVisible()
  await expect(page.getByText('Lucía Gómez')).toBeVisible()
  await expect(page.getByText('Error al enviar')).toBeVisible()
  await expect(page.getByText('14 de 15 terminadas · 10 aprobadas · 42 fotos')).toBeVisible()
  await expect(page.getByRole('button', { name: /Guardar|Aprobar|Eliminar/ })).toHaveCount(0) // nothing to change here
  await page.screenshot({ path: `test-results/platform-support-${info.project.name}.png`, fullPage: true })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.waitForTimeout(400) // the theme's color transitions
  await page.screenshot({ path: `test-results/platform-support-dark-${info.project.name}.png`, fullPage: true })
})

test('without a support session there is nothing to see', async ({ page }) => {
  await installFakeSupabase(page, platform())
  await page.goto('/platform/c1')
  await expect(page.getByText('No hay una sesión de soporte abierta')).toBeVisible()
  await expect(page.getByText('La sesión de soporte terminó. Abrí otra para seguir mirando.')).toBeVisible()
})

test('only Visitario admins enter the platform panel', async ({ page }) => {
  await installFakeSupabase(page, { workday: null, visits: [], uploads: [] })
  await page.goto('/platform')
  await expect(page).not.toHaveURL(/platform/)
  await expect(page.getByRole('link', { name: 'Empresas' })).toHaveCount(0)
})
