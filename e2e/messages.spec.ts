import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'
import { pick } from './support/select'

type Grouping = 'visit' | 'display' | 'type'
const company = (before: Grouping, after: Grouping = before) => ({ id: 'c1', name: 'Panda', geocoding_scope: 'caba', show_whatsapp: true, messages_before: before, messages_after: after, photo_retention_months: 12, logo_version: null, shift_start: '09:00:00', shift_end: '14:00:00' })
const display = (id: string, type: number, order: number) => ({ id, display_type_id: type, reference: null, source: 'found', sort_order: order, deleted_at: null })
const store = { id: 's1', name: null, address: 'Altolaguirre 1952', area: 'Villa Urquiza', customer_number: '1462', lat: null, lng: null, location_status: 'verified' }

const visitState = (grouping: [Grouping, Grouping], displays: ReturnType<typeof display>[]): FakeState => ({
  workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
  visits: [visitRow('v1', 0, 'Altolaguirre 1952', { store, consent: 'yes', work_status: 'in_progress', display: displays })],
  uploads: [],
  company: company(...grouping),
  catalogs: { display_type: [{ id: 1, name: 'Góndola', active: true }, { id: 2, name: 'Puntera', active: true }] },
  templates: [
    { kind: 'before', body: 'ANTES\nCLIENTE: {nro_cliente}\nTIPO DE EXHIBICION: {EXHIBICIONES}' },
    { kind: 'after', body: 'DESPUÉS\nTIPO DE EXHIBICION: {EXHIBICIONES}' },
  ],
})

test('with one message per display, each display has its own ANTES and DESPUÉS', async ({ page }, info) => {
  const state = visitState(['display', 'display'], [display('d1', 1, 0), display('d2', 2, 1), display('d3', 1, 2)])
  await installFakeSupabase(page, state)
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  const list = page.getByRole('list', { name: 'Mensajes por exhibición' })
  for (const name of ['ANTES de Góndola 1', 'ANTES de Puntera', 'ANTES de Góndola 2', 'DESPUÉS de Góndola 1', 'DESPUÉS de Puntera', 'DESPUÉS de Góndola 2']) {
    await expect(list.getByRole('button', { name: `Copiar ${name}` })).toBeVisible()
  }
  await expect(page.getByRole('button', { name: 'Copiar ANTES', exact: true })).toHaveCount(0)
  await list.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `test-results/messages-per-display-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Copiar ANTES de Puntera' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('ANTES\nCLIENTE: 1462\nTIPO DE EXHIBICION: PUNTERA')
  await page.getByRole('button', { name: 'Copiar DESPUÉS de Góndola 2' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: GÓNDOLA')
})

test('ANTES for the whole visit, DESPUÉS one per kind of display: a message for the góndolas, one for the puntera', async ({ page }, info) => {
  await installFakeSupabase(page, visitState(['visit', 'type'], [display('d1', 1, 0), display('d2', 2, 1), display('d3', 1, 2)]))
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  await expect(page.getByText('Dirección · ANTES · DESPUÉS (2)', { exact: false })).toBeVisible()
  const list = page.getByRole('list', { name: 'Mensajes por exhibición' })
  await list.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `test-results/messages-by-type-${info.project.name}.png` })
  await page.getByRole('button', { name: 'Copiar ANTES', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('ANTES\nCLIENTE: 1462\nTIPO DE EXHIBICION: 2 GÓNDOLA, PUNTERA')
  await page.getByRole('button', { name: 'Copiar DESPUÉS de Góndola (2)' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: GÓNDOLA')
  await page.getByRole('button', { name: 'Copiar DESPUÉS de Puntera' }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: PUNTERA')
})

test('grouped by display with none added yet: one ANTES and one DESPUÉS for the visit', async ({ page }) => {
  await installFakeSupabase(page, visitState(['display', 'type'], []))
  await page.goto('/visit/v1')
  await expect(page.getByRole('button', { name: 'Copiar ANTES', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Copiar DESPUÉS', exact: true })).toBeVisible()
})

test('without it, one ANTES and one DESPUÉS name every display', async ({ page }) => {
  await installFakeSupabase(page, visitState(['visit', 'visit'], [display('d1', 1, 0), display('d2', 2, 1), display('d3', 1, 2)]))
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/visit/v1')
  await page.getByRole('button', { name: 'Copiar DESPUÉS', exact: true }).click()
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('DESPUÉS\nTIPO DE EXHIBICION: 2 GÓNDOLA, PUNTERA')
})

test('the admin chooses ANTES and DESPUÉS on their own in Plantillas', async ({ page }) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], company: company('visit'),
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['admin'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
  }
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/templates')
  await pick(page.getByLabel('DESPUÉS', { exact: true }), 'Uno por tipo de exhibición')
  await expect.poll(() => [state.company?.messages_before, state.company?.messages_after]).toEqual(['visit', 'type'])
  await expect(page.getByText('Ej.: una puntera, dos primarias y tres góndolas son tres mensajes.')).toBeVisible()
})
