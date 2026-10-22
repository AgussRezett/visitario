import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const TODAY = '2026-10-12'
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const lucia = { id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }
const ofLucia = { merchandiser_id: 'p2', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' }, workday_id: 'w-p2', source: 'assigned', added_by: 'p1', adder: { first_name: 'Martín' } }

test.beforeEach(({ page }) => atFakeToday(page))

const luciaDay = (): FakeState => ({
  workday: null,
  uploads: [],
  memberships: supervisor,
  people: [lucia],
  workdays: [{ id: 'w-p2', company_id: 'c1', merchandiser_id: 'p2', work_date: TODAY, status: 'published' }],
  visits: [
    visitRow('v1', 0, 'Tres Arroyos 762', { ...ofLucia, work_status: 'done', arrived_at: `${TODAY}T10:02:00-03:00`, finished_at: `${TODAY}T10:40:00-03:00` }),
    visitRow('v2', 1, 'Juramento 2101', { ...ofLucia, work_status: 'in_progress', arrived_at: `${TODAY}T11:05:00-03:00` }),
    visitRow('v3', 2, 'Cuba 1940', ofLucia),
    visitRow('v4', 3, 'Moldes 1365', { ...ofLucia, source: 'added', added_by: 'p2', adder: { first_name: 'Lucía' } }),
  ],
})

test('the supervisor follows an activador’s day, read only, in the activador’s order', async ({ page }, info) => {
  await installFakeSupabase(page, luciaDay(), 'supervisor')
  await page.goto('/s/today')
  await page.getByRole('link', { name: /Lucía Gómez/ }).filter({ visible: true }).first().click()

  await expect(page.getByRole('heading', { name: 'Jornada de Lucía Gómez' })).toBeVisible()
  await expect(page.getByText(/solo vista/)).toBeVisible()
  await expect(page.getByText(/1\s*de 4 con resultado/)).toBeVisible()

  const list = page.getByRole('region', { name: 'Locales de Lucía en su orden' })
  const text = await list.innerText()
  const order = ['Tres Arroyos 762', 'Juramento 2101', 'Cuba 1940', 'Moldes 1365'].map((a) => text.indexOf(a))
  expect(order.every((p) => p >= 0)).toBe(true)
  expect([...order].sort((a, b) => a - b)).toEqual(order)
  await expect(list.getByText('Ahora acá')).toBeVisible()
  await expect(list.getByText('Sigue')).toBeVisible()
  await expect(list.getByText('Agregada por Lucía')).toBeVisible()

  // Nothing to start or change from here: only a finished visit opens, to review it.
  await expect(page.getByRole('button', { name: /Llegué|Empezar|Agregar/ })).toHaveCount(0)
  await expect(list.getByRole('link')).toHaveCount(1)

  await page.getByRole('radio', { name: /Por hacer/ }).click()
  await expect(list.getByText('Tres Arroyos 762')).toHaveCount(0)
  await expect(list.getByText('Cuba 1940')).toBeVisible()
  await page.screenshot({ path: `test-results/member-day-${info.project.name}.png`, fullPage: true })
})

test('a day not yet built says so and points to assigning it', async ({ page }) => {
  const state = luciaDay()
  state.workdays = []
  state.visits = []
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/today/p2')
  await expect(page.getByText('Lucía no tiene jornada hoy.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Armarle la jornada' })).toBeVisible()
})

test('adding a store someone else already has that day warns before adding it', async ({ page }, info) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: TODAY, status: 'published', created_by: 'p1' },
    visits: [],
    uploads: [],
    stores: [{ id: 's9', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', customer_number: '20577' }],
    overlaps: [
      { store_id: 's9', address: 'Moldes 1365', merchandiser_first: 'Lucía', merchandiser_last: 'Gómez', added_by_first: 'Martín' },
      { store_id: 's-x', address: 'Cuba 1940', merchandiser_first: 'Diego', merchandiser_last: 'Paz', added_by_first: 'Diego', added_by_merchandiser: true, work_status: 'done' },
    ],
  }
  await installFakeSupabase(page, state)
  await page.goto(`/s/workday?date=${TODAY}`)
  await page.getByRole('button', { name: 'Agregar dirección' }).filter({ visible: true }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a mi jornada' })

  // From the directory: the note is under the result, before tapping it.
  await sheet.getByLabel('Buscar en el directorio').fill('lili')
  await expect(sheet.getByText('Lucía G. ya lo tiene en su jornada de hoy, asignado por Martín.')).toBeVisible()
  await expect(sheet.getByRole('button', { name: /Autoservicio Lili/ })).toHaveAccessibleDescription(/Lucía G\./)

  // A new store typed by hand: the same address written another way.
  await sheet.getByLabel('Dirección').fill('cuba  1940')
  await expect(sheet.getByText('Diego P. ya lo tiene en su jornada de hoy, lo sumó por su cuenta y ya lo visitó.')).toBeVisible()
  await page.screenshot({ path: `test-results/overlap-one-${info.project.name}.png` })

  // Pasted lines: one banner names which ones.
  await sheet.getByRole('radio', { name: 'Pegar varias' }).click()
  await sheet.getByLabel('Direcciones').fill('Moldes 1365\nVidal 2044')
  await expect(sheet.getByText('Una dirección ya está en otra jornada')).toBeVisible()
  await expect(sheet.getByText(/Moldes 1365: Lucía G\. ya lo tiene/)).toBeVisible()
  await page.screenshot({ path: `test-results/overlap-many-${info.project.name}.png` })

  // It is a heads-up: adding still works.
  await sheet.getByRole('button', { name: 'Agregar 2 direcciones' }).click()
  await expect.poll(() => state.visits.length).toBe(2)
})

test('the supervisor assigning a day sees who else already has the store', async ({ page }) => {
  const state = luciaDay()
  state.workdays = []
  state.visits = []
  state.stores = [{ id: 's9', name: 'Autoservicio Lili', address: 'Moldes 1365', area: 'Belgrano', customer_number: '20577' }]
  state.overlaps = [{ store_id: 's9', address: 'Moldes 1365', merchandiser_first: 'Diego', merchandiser_last: 'Paz', added_by_first: 'Diego', added_by_merchandiser: true }]
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/assign?date=2026-10-16')
  await page.getByRole('button', { name: 'Agregar locales' }).click()
  const sheet = page.getByRole('dialog', { name: 'Agregar a la jornada de Lucía' })
  await sheet.getByLabel('Buscar en el directorio').fill('lili')
  await expect(sheet.getByText('Diego P. ya lo tiene en su jornada de ese día, lo sumó por su cuenta.')).toBeVisible()
})
