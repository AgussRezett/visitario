import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { installFakeSupabase, type FakeState, type Row } from './support/fake-supabase'

const LANDSCAPE = readFileSync(new URL('./fixtures/after-landscape.jpg', import.meta.url))
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
const seller = [{ id: 'm1', company_id: 'c1', roles: ['seller'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const catalogs = () => ({
  issue_type: [{ id: 1, name: 'Necesita pedido', active: true }, { id: 2, name: 'Falta de stock', active: true }],
  channel: [{ id: 10, name: 'Autoservicio', active: true, sort_order: 1 }],
  seller: [{ id: 1, name: 'Florencia Paz', active: true, person_id: 'p1' }],
})
const store = { id: 's1', name: 'Coto Cabildo', address: 'Cabildo 2280', area: 'Belgrano', customer_number: '1462', channel_id: 10, seller_id: 1 }
const issue = (id: string, typeId: number, note: string | null): Row => ({
  id, visit_id: 'v1', type_id: typeId, note, status: 'open', created_at: `${day(0)}T15:00:00Z`, created_by: 'p2', resolved_at: null, resolved_by: null,
  resolution: null, deleted_at: null, company_id: 'c1', store_id: 's1', creator: { first_name: 'Lucía', last_name: 'Gómez' }, resolver: null, store,
})

test('the seller gets their clients\' novedades and closes them in one tap', async ({ page }, info) => {
  const s: FakeState = { workday: null, visits: [], uploads: [], memberships: seller, catalogs: catalogs(), issues: [issue('i1', 1, '2 cajas de SKYY 750'), issue('i2', 2, null)] }
  await installFakeSupabase(page, s, 'seller')
  await page.goto('/s/issues')

  await expect(page.getByRole('heading', { name: 'Novedades de mis clientes', level: 1 })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Secciones' }).filter({ visible: true })
  await expect(nav.getByRole('link', { name: /Novedades/ })).toContainText('2')
  const order = page.getByRole('article', { name: 'Necesita pedido: Coto Cabildo' })
  await expect(order).toContainText('2 cajas de SKYY 750')
  await expect(order.getByRole('link', { name: /Mandar/ })).toHaveCount(0) // they are the seller
  await expect(order.getByRole('link', { name: 'Ver el cliente' })).toHaveAttribute('href', '/s/clients/s1')
  await page.screenshot({ path: `test-results/seller-issues-${info.project.name}.png`, fullPage: true })

  await order.getByRole('button', { name: 'Pedido cargado' }).click()
  await expect.poll(() => s.resolved?.[0]).toMatchObject({ p_issue: 'i1', p_resolved: true, p_note: 'Pedido cargado' })
  await expect(order).toHaveCount(0)
  await page.getByRole('article', { name: 'Falta de stock: Coto Cabildo' }).getByRole('button', { name: 'No corresponde' }).click()
  await expect.poll(() => s.resolved?.[1]).toMatchObject({ p_issue: 'i2', p_note: 'No corresponde' })
  await expect(page.getByText('No hay novedades abiertas')).toBeVisible()
})

test('the client\'s page shows the next activation, the open novedades and how each shelf was left', async ({ page }, info) => {
  const photo = (id: string) => ({ id, width: 1400, height: 1054, crop: null })
  const s: FakeState = {
    workday: null, visits: [], uploads: [], memberships: seller, catalogs: catalogs(), photoUrls: true,
    issues: [issue('i1', 1, 'SKYY 750')],
    clientHistory: {
      s1: {
        store: { ...store, lat: -34.56, lng: -58.46 },
        visits: [
          { id: 'v9', date: day(2), status: 'pending', review: 'unreviewed', consent: null, merchandiser: 'Diego Pérez', displays: [], metrics: [], photos: [] },
          { id: 'v1', date: day(-3), status: 'done', review: 'approved', consent: 'yes', merchandiser: 'Lucía Gómez', displays: ['Puntera'], metrics: [], photos: [photo('a1'), photo('a2')] },
        ],
      },
    },
  }
  await installFakeSupabase(page, s, 'seller')
  await page.route('https://photos.test/**', (r) => r.fulfill({ contentType: 'image/jpeg', body: LANDSCAPE }))
  await page.goto('/s/clients/s1')

  await expect(page.getByRole('heading', { name: 'Coto Cabildo' })).toBeVisible()
  await expect(page.getByText(/Próxima activación: .*, con Diego/)).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Novedades abiertas · 1' })).toBeVisible()
  const history = page.getByRole('region', { name: 'Historial de activaciones' })
  await expect(history.getByRole('button', { name: 'Después 1 de 2' })).toBeVisible()
  await page.screenshot({ path: `test-results/seller-client-${info.project.name}.png`, fullPage: true })
  await history.getByRole('button', { name: 'Después 2 de 2' }).click()
  await expect(page.getByRole('dialog', { name: 'Coto Cabildo' })).toBeVisible()
})

test('the seller asks to activate a client, and can take it back', async ({ page }, info) => {
  const s: FakeState = {
    workday: null, visits: [], uploads: [], memberships: seller, catalogs: catalogs(), requestStore: store,
    clientHistory: { s1: { store: { ...store, lat: null, lng: null }, visits: [] } },
  }
  await installFakeSupabase(page, s, 'seller')
  await page.goto('/s/clients/s1')
  const card = page.getByRole('region', { name: 'Pedido de activación' })
  await card.getByRole('button', { name: 'Pedir una activación' }).click()
  const sheet = page.getByRole('dialog', { name: 'Pedir una activación' })
  await sheet.getByLabel('¿Para qué? (opcional)').fill('Lanzamiento de Aperol')
  await page.screenshot({ path: `test-results/seller-request-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Mandar al supervisor' }).click()
  await expect(sheet).toBeHidden()
  await expect.poll(() => s.requests?.[0]).toMatchObject({ store_id: 's1', note: 'Lanzamiento de Aperol', status: 'open' })
  await expect(card.getByText(/Pediste una activación el .*Esperando al supervisor/)).toBeVisible()
  await expect(card.getByText('Lanzamiento de Aperol')).toBeVisible()

  await card.getByRole('button', { name: 'Quitar el pedido' }).click()
  await expect.poll(() => s.requests?.[0]?.deleted_at).toBeTruthy()
  await expect(card.getByRole('button', { name: 'Pedir una activación' })).toBeVisible()
})

test('the supervisor adds a seller\'s request to the day being planned, or dismisses it with a reason', async ({ page }, info) => {
  const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
  const request = (id: string, place: Row, note: string | null): Row => ({
    id, store_id: place.id, company_id: 'c1', note, status: 'open', created_at: `${day(-1)}T13:00:00Z`, deleted_at: null, scheduled_for: null, answer: null,
    asker: { first_name: 'Florencia', last_name: 'Paz' }, assignee: null, store: place,
  })
  const s: FakeState = {
    workday: null, visits: [], uploads: [], memberships: supervisor, catalogs: catalogs(),
    people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }], workdays: [],
    requests: [request('r1', store, 'Lanzamiento de Aperol'), request('r2', { ...store, id: 's2', name: null, address: 'Moldes 1365' }, null)],
  }
  await installFakeSupabase(page, s, 'supervisor')
  const tomorrow = day(1)
  await page.goto(`/s/assign?date=${tomorrow}&person=p2`)

  const board = page.getByRole('region', { name: 'Pedidos de vendedores' })
  await expect(board.getByRole('heading', { name: 'Pedidos de vendedores · 2' })).toBeVisible()
  await expect(board).toContainText('Lo pidió Florencia Paz')
  await page.screenshot({ path: `test-results/assign-requests-${info.project.name}.png`, fullPage: true })
  await board.getByRole('button', { name: /^Sumar a Lucía el / }).first().click()
  await expect.poll(() => s.scheduled?.[0]).toMatchObject({ p_request: 'r1', p_merchandiser: 'p2', p_date: tomorrow })
  await expect(board.getByRole('heading', { name: 'Pedidos de vendedores · 1' })).toBeVisible()

  await board.getByRole('button', { name: 'Descartar' }).click()
  const sheet = page.getByRole('dialog', { name: 'Descartar el pedido' })
  await sheet.getByLabel('Motivo para el vendedor (opcional)').fill('Ya se activó la semana pasada')
  await sheet.getByRole('button', { name: 'Descartar' }).click()
  await expect.poll(() => s.requests?.[1]?.status).toBe('dismissed')
  expect(s.requests?.[1]?.answer).toBe('Ya se activó la semana pasada')
  await expect(board).toHaveCount(0)
})
