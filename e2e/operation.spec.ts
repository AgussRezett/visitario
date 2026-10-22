import { expect, test } from '@playwright/test'
import { FAKE_TODAY, ME, atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const workday = { id: 'w1', company_id: 'c1', work_date: FAKE_TODAY, status: 'published', created_by: ME }
const teammates = [
  { person_id: ME, person: { first_name: 'Agustín', last_name: 'Rezett' } },
  { person_id: 'p2', person: { first_name: 'Lucía', last_name: 'Gómez' } },
  { person_id: 'p3', person: { first_name: 'Diego', last_name: 'Paz' } },
]
/** Lucía hosts it; I (Agustín) am in it with my own day w1. */
const operation = (extra: Row = {}): Row => ({
  id: 'op1', workday_id: 'w-op', host_id: 'p2', name: null, created_by: 'p2', created_at: `${FAKE_TODAY}T12:00:00Z`, ended_at: null, workday_status: 'published',
  members: [
    { person_id: 'p2', first_name: 'Lucía', last_name: 'Gómez', left_at: null, workday_id: 'w-op' },
    { person_id: ME, first_name: 'Agustín', last_name: 'Rezett', left_at: null, workday_id: 'w1' },
  ],
  total: 2, visited: 1, in_progress: 0, refused: 0, closed: 0, approved: 0, needs_fix: 0, metrics: {}, ...extra,
})
const shared = [
  visitRow('vo1', 0, 'Cabildo 2280', { workday_id: 'w-op', merchandiser_id: 'p2', added_by: 'p2', source: 'added', adder: { first_name: 'Lucía' }, work_status: 'done' }),
  visitRow('vo2', 1, 'Juramento 2101', { workday_id: 'w-op', merchandiser_id: 'p2', added_by: 'p2', source: 'added', adder: { first_name: 'Lucía' } }),
]

test('an activador starts an operativo with a teammate', async ({ page }, info) => {
  const state: FakeState = { workday, visits: [visitRow('v1', 0, 'Moldes 1365')], uploads: [], teammates }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await expect(page.getByText('¿Salen juntos?')).toBeVisible()
  await page.getByRole('button', { name: 'Armar operativo' }).click()
  const sheet = page.getByRole('dialog', { name: 'Armar operativo' })
  await expect(sheet.getByRole('checkbox', { name: /Agustín/ })).toHaveCount(0) // not myself
  await sheet.getByRole('checkbox', { name: /Lucía Gómez/ }).click()
  await sheet.getByLabel('Nombre').fill('Coto Cabildo')
  await page.screenshot({ path: `test-results/operation-create-${info.project.name}.png` })
  await sheet.getByRole('button', { name: 'Armar con 1 compañero' }).click()
  await expect.poll(() => state.operationCalls?.[0]).toMatchObject({ fn: 'create', p_members: ['p2'], p_name: 'Coto Cabildo', p_date: FAKE_TODAY })
  expect(state.operationCalls?.[0]?.p_host).toBeUndefined()
})

test('someone just made activador shows up the next time the picker opens', async ({ page }) => {
  const state: FakeState = { workday, visits: [visitRow('v1', 0, 'Moldes 1365')], uploads: [], teammates: [teammates[0] as Row] }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  await page.getByRole('button', { name: 'Armar operativo' }).click()
  const sheet = page.getByRole('dialog', { name: 'Armar operativo' })
  await expect(sheet.getByText('No hay otros activadores en la empresa.')).toBeVisible()
  await page.keyboard.press('Escape')

  // An admin gives Lucía the role meanwhile.
  state.teammates = teammates
  await page.getByRole('button', { name: 'Armar operativo' }).click()
  await expect(sheet.getByRole('checkbox', { name: /Lucía Gómez/ })).toBeVisible()
})

test('a member sees the operativo’s stops in their day, brings their own and can leave', async ({ page }, info) => {
  const state: FakeState = {
    workday, uploads: [], teammates, operations: [operation()],
    visits: [...shared, visitRow('v1', 0, 'Moldes 1365')],
  }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  const card = page.getByRole('region', { name: 'Operativo' })
  await expect(card.getByText('Operativo con Lucía')).toBeVisible()
  await expect(card.getByText('1 de 2 locales')).toBeVisible()
  await expect(page.getByRole('link', { name: /Juramento 2101/ }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: /Moldes 1365/ }).first()).toBeVisible()
  await expect(page.getByText('Operativo', { exact: true }).filter({ visible: true }).first()).toBeVisible() // the stop's tag
  await page.screenshot({ path: `test-results/operation-member-${info.project.name}.png`, fullPage: true })

  await card.getByRole('button', { name: 'Traer mi local' }).click()
  const bring = page.getByRole('dialog', { name: 'Traer mis locales' })
  await bring.getByRole('button', { name: 'Traer 1' }).click()
  await expect.poll(() => state.operationCalls?.find((c) => c.fn === 'bring')).toMatchObject({ p_operation: 'op1', p_visits: ['v1'] })

  await card.getByRole('button', { name: 'Salir' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Salir' }).click()
  await expect.poll(() => state.operationCalls?.some((c) => c.fn === 'leave_operation' && c.p_operation === 'op1')).toBe(true)
})

test('the location switch asks the phone, and it is only shared while on', async ({ page, context }) => {
  await context.grantPermissions(['geolocation'])
  await context.setGeolocation({ latitude: -34.56, longitude: -58.46 })
  const state: FakeState = { workday, uploads: [], teammates, operations: [operation()], visits: [...shared] }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday')
  const toggle = page.getByRole('switch', { name: /Compartir mi ubicación/ })
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => localStorage.getItem('visitario.operation.share.op1'))).toBe('1')
  await page.getByRole('button', { name: 'Ver en el mapa' }).click()
  await expect(page.getByRole('dialog', { name: 'Operativo con Lucía' })).toBeVisible()
})

test('a visit of the operativo says so', async ({ page }) => {
  const state: FakeState = { workday, uploads: [], teammates, operations: [operation()], visits: [...shared] }
  await installFakeSupabase(page, state)
  await page.goto('/visit/vo2')
  await expect(page.getByText('Visita del operativo: el equipo ve lo que cargás al momento.')).toBeVisible()
})

test('the supervisor sees the day’s operativos, and the team counts a shared visit once', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, uploads: [], teammates,
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
    people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez', total: 2, visited: 1 }, { id: ME, first_name: 'Agustín', last_name: 'Rezett', total: 2, visited: 1 }],
    operations: [operation()],
    visits: [...shared],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/today')
  const board = page.getByRole('region', { name: 'Operativos' })
  await expect(board.getByRole('heading', { name: 'Operativos · 1' })).toBeVisible()
  await expect(board.getByText('Operativo con Lucía', { exact: true })).toBeVisible() // the supervisor here is also Agustín
  await page.screenshot({ path: `test-results/operation-board-${info.project.name}.png`, fullPage: true })
  await board.getByRole('button', { name: 'Terminar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Terminar' }).click()
  await expect.poll(() => state.operationCalls?.some((c) => c.fn === 'end_operation')).toBe(true)
})

test('Asignar prepares an operativo for others', async ({ page }) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], teammates,
    memberships: [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }],
    people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/assign?date=2026-10-16')
  await page.getByRole('button', { name: 'Armar operativo' }).click()
  const sheet = page.getByRole('dialog', { name: 'Armar operativo' })
  await sheet.getByRole('checkbox', { name: /Lucía Gómez/ }).click()
  await sheet.getByRole('checkbox', { name: /Diego Paz/ }).click()
  await sheet.getByLabel('Encabeza').selectOption({ label: 'Diego Paz' })
  await sheet.getByRole('button', { name: 'Armar con 1 compañero' }).click()
  await expect.poll(() => state.operationCalls?.[0]).toMatchObject({ fn: 'create', p_host: 'p3', p_date: '2026-10-16' })
})
