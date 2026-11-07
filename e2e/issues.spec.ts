import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const TYPES = [
  { id: 1, name: 'Necesita pedido', active: true },
  { id: 2, name: 'Falta de stock', active: true },
  { id: 3, name: 'Otro', active: false },
]
const store = { id: 's-v1', name: 'Autoservicio Lili', address: 'Av. Brasil 3076', area: 'Constitución', customer_number: '1004', lat: null, lng: null, location_status: 'verified', channel_id: 10, seller_id: 1 }

test('the activador reports a novedad from the visit, and can take it back', async ({ page }, info) => {
  const s: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Av. Brasil 3076', { consent: 'yes', work_status: 'in_progress', arrived_at: '2026-10-12T13:00:00Z', store })],
    uploads: [],
    catalogs: { issue_type: TYPES },
  }
  await installFakeSupabase(page, s)
  await page.goto('/visit/v1')

  const section = page.getByRole('region', { name: 'Novedades del local' })
  await section.getByRole('button', { name: 'Reportar novedad' }).click()
  const sheet = page.getByRole('dialog', { name: 'Reportar novedad' })
  await expect(sheet.getByRole('radio', { name: 'Otro' })).toHaveCount(0) // inactive
  await expect(sheet.getByRole('button', { name: 'Enviar al supervisor' })).toBeDisabled()
  await sheet.getByRole('radio', { name: 'Necesita pedido' }).click()
  await expect(sheet.getByLabel('Detalle (opcional)')).toHaveAttribute('placeholder', /SKYY/)
  await sheet.getByLabel('Detalle (opcional)').fill('2 cajas de SKYY 750')
  await page.screenshot({ path: `test-results/issue-report-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Enviar al supervisor' }).click()
  await expect(sheet).toBeHidden()

  await expect.poll(() => s.issues?.length).toBe(1)
  expect(s.issues?.[0]).toMatchObject({ visit_id: 'v1', store_id: 's-v1', type_id: 1, note: '2 cajas de SKYY 750' })
  await expect(section.getByText('2 cajas de SKYY 750')).toBeVisible()
  await expect(section.getByText(/Enviada al supervisor/)).toBeVisible()

  await section.getByRole('button', { name: 'Quitar novedad: Necesita pedido' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Quitar', exact: true }).click()
  await expect.poll(() => s.issues?.[0]?.deleted_at).toBeTruthy()
  await expect(section.getByText('2 cajas de SKYY 750')).toHaveCount(0)
})

const issue = (id: string, typeId: number, note: string | null, at: string, by = { first_name: 'Agustín', last_name: 'Rezett' }, who = 'p1'): Row => ({
  id, visit_id: 'v1', type_id: typeId, note, status: 'open', created_at: at, created_by: who, resolved_at: null, resolved_by: null, resolution: null, deleted_at: null,
  company_id: 'c1', store_id: 's-v1', creator: by, resolver: null, store,
})

test('the supervisor gets the novedades, passes the order to the seller and marks it resolved', async ({ page }, info) => {
  const s: FakeState = {
    workday: null, visits: [], uploads: [],
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
    catalogs: { issue_type: TYPES, seller: [{ id: 1, name: 'Florencia Paz', active: true, person_id: null }], channel: [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }] },
    issues: [
      issue('i1', 1, '2 cajas de SKYY 750', '2026-10-12T17:30:00Z'),
      issue('i2', 2, null, '2026-10-12T15:00:00Z', { first_name: 'Lucía', last_name: 'Gómez' }, 'p2'),
    ],
  }
  await installFakeSupabase(page, s, 'supervisor')
  await page.goto('/s/issues')

  await expect(page.getByRole('heading', { name: 'Novedades', level: 1 })).toBeVisible()
  await expect(page.getByRole('radio', { name: 'Abiertas · 2' })).toBeVisible()
  // The open ones are counted in the navigation (under "Más" on phones).
  const nav = page.getByRole('navigation', { name: 'Secciones' }).filter({ visible: true })
  await expect(info.project.name === 'desktop' ? nav.getByRole('link', { name: /Novedades/ }) : nav.getByRole('button', { name: /Más/ })).toContainText('2')
  const order = page.getByRole('article', { name: 'Necesita pedido: Autoservicio Lili' })
  await expect(order).toContainText('Lo reportó Agustín Rezett')
  await expect(order).toContainText('vend. Florencia Paz')
  const link = order.getByRole('link', { name: 'Mandar al vendedor' })
  const href = decodeURIComponent((await link.getAttribute('href')) ?? '')
  expect(href).toContain('Hola Florencia! Novedad de un cliente tuyo:')
  expect(href).toContain('Detalle: 2 cajas de SKYY 750')
  expect(href).toContain('Lo vio Agustín el 12/10 14:30.')
  await page.screenshot({ path: `test-results/issues-inbox-${info.project.name}.png`, fullPage: true })

  await order.getByRole('button', { name: 'Marcar resuelta' }).click()
  const sheet = page.getByRole('dialog', { name: 'Marcar resuelta' })
  await sheet.getByLabel('Qué se hizo (opcional)').fill('Pedido cargado')
  await sheet.getByRole('button', { name: 'Marcar resuelta' }).click()
  await expect.poll(() => s.resolved?.[0]).toMatchObject({ p_issue: 'i1', p_resolved: true, p_note: 'Pedido cargado' })
  await expect(order).toHaveCount(0)
  await expect(page.getByRole('radio', { name: 'Abiertas · 1' })).toBeVisible()

  await page.getByRole('radio', { name: 'Resueltas' }).click()
  await expect(page.getByRole('article', { name: 'Necesita pedido: Autoservicio Lili' })).toContainText('Resuelta por Martín')
})
