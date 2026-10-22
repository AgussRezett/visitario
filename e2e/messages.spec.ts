import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const company = (perDisplay: boolean) => ({ id: 'c1', name: 'Panda', geocoding_scope: 'caba', show_whatsapp: true, messages_per_display: perDisplay, photo_retention_months: 12, logo_version: null, shift_start: '09:00:00', shift_end: '14:00:00' })
const display = (id: string, type: number, order: number) => ({ id, display_type_id: type, reference: null, source: 'found', sort_order: order, deleted_at: null })
const store = { id: 's1', name: null, address: 'Altolaguirre 1952', area: 'Villa Urquiza', customer_number: '1462', lat: null, lng: null, location_status: 'verified' }

const visitState = (perDisplay: boolean, displays: ReturnType<typeof display>[]): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Altolaguirre 1952', { store, consent: 'yes', work_status: 'in_progress', display: displays })],
  uploads: [],
  company: company(perDisplay),
  catalogs: { display_type: [{ id: 1, name: 'Góndola', active: true }, { id: 2, name: 'Puntera', active: true }] },
  templates: [
    { kind: 'before', body: 'ANTES\nCLIENTE: {nro_cliente}\nTIPO DE EXHIBICION: {EXHIBICIONES}' },
    { kind: 'after', body: 'DESPUÉS\nTIPO DE EXHIBICION: {EXHIBICIONES}' },
  ],
})

test('with one message per display, each display has its own ANTES and DESPUÉS', async ({ page }, info) => {
  const state = visitState(true, [display('d1', 1, 0), display('d2', 2, 1), display('d3', 1, 2)])
  await installFakeSupabase(page, state)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  const list = page.getByRole('list', { name: 'Mensajes por exhibición' })
  await expect(list.getByText('Góndola 1')).toBeVisible()
  await expect(list.getByText('Puntera', { exact: true })).toBeVisible()
  await expect(list.getByText('Góndola 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar ANTES', exact: true })).toHaveCount(0)
  await list.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `test-results/messages-per-display-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Copiar ANTES de Puntera' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('ANTES\nCLIENTE: 1462\nTIPO DE EXHIBICION: PUNTERA')
  await page.getByRole('button', { name: 'Copiar DESPUÉS de Góndola 2' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: GÓNDOLA')
})

test('with one message per display and none added yet, it says how to get them', async ({ page }) => {
  await installFakeSupabase(page, visitState(true, []))
  await page.goto('/visit/v1')
  await expect(page.getByText('Agregá una exhibición y vas a tener su ANTES y su DESPUÉS para copiar.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar Dirección' })).toBeVisible()
})

test('without it, one ANTES and one DESPUÉS name every display', async ({ page }) => {
  await installFakeSupabase(page, visitState(false, [display('d1', 1, 0), display('d2', 2, 1), display('d3', 1, 2)]))
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Copiar DESPUÉS', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: 2 GÓNDOLA, PUNTERA')
})

test('the admin turns it on in Plantillas', async ({ page }) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], company: company(false),
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['admin'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
  }
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/templates')
  const toggle = page.getByRole('switch', { name: /Un ANTES y un DESPUÉS por cada exhibición/ })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect.poll(() => state.company?.messages_per_display).toBe(true)
})
