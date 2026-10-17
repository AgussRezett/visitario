import { expect, test } from '@playwright/test'
import { FAKE_TODAY, atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const started = { work_status: 'in_progress', arrived_at: `${FAKE_TODAY}T13:00:00Z`, consent: 'yes' }
const rep = (storeId: string, score: number, recent: number, previous: number | null): Row => ({ store_id: storeId, score, recent, previous, rated: 5, last_rated: '2026-10-09' })

test('the merchandiser marks how they were received, and sees how each store usually receives', async ({ page }, info) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: FAKE_TODAY, status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Tres Arroyos 762', started), visitRow('v2', 1, 'Moldes 1365')],
    uploads: [],
    reputation: [rep('s-v1', 1.2, 1, 1.33), rep('s-v2', 2.8, 3, 2.67)],
  }
  await installFakeSupabase(page, state)

  await page.goto('/s/workday')
  const stops = info.project.name === 'desktop' ? page.getByRole('table', { name: 'Locales de la jornada' }) : page.getByRole('region', { name: 'Locales' })
  await expect(stops.getByText('Indiferente').filter({ visible: true })).toBeVisible()
  await expect(stops.getByText('Buena onda').filter({ visible: true })).toBeVisible()

  await page.goto('/visit/v1')
  await expect(page.getByText('Suele recibir con indiferencia').filter({ visible: true }).first()).toBeVisible()
  const rapport = page.getByRole('radiogroup', { name: /¿Cómo te recibieron?/ })
  await expect(rapport.getByRole('radio')).toHaveCount(3) // "no quiso" is a refusal, marked in the authorization
  await rapport.getByRole('radio', { name: 'Con restricciones' }).click()
  await expect(rapport.getByRole('radio', { name: 'Con restricciones' })).toHaveAttribute('aria-checked', 'true')
  await expect.poll(() => state.visits[0]?.rapport).toBe('restricted')
  await page.screenshot({ path: `test-results/reputation-visit-${info.project.name}.png`, fullPage: true })

  await rapport.getByRole('radio', { name: 'Con restricciones' }).click() // optional: tap again to clear
  await expect.poll(() => state.visits[0]?.rapport).toBeNull()

  await page.getByRole('radio', { name: 'No autorizó' }).click()
  await expect(page.getByRole('radiogroup', { name: /¿Cómo te recibieron?/ })).toHaveCount(0)
})

const people = { agus: ['p2', 'Agus', 'Rezett'], lucia: ['p3', 'Lucía', 'Gómez'] } as const
const fact = (week: string, store: string, area: string, who: keyof typeof people, rapport: string, visits: number): Row => ({
  week, store_id: store, store_name: store === 's1' ? 'Mas Ahorro' : store === 's2' ? 'Autoservicio Lili' : 'Kiosco Don Tito', address: 'x', area,
  merchandiser_id: people[who][0], first_name: people[who][1], last_name: people[who][2], rapport, visits,
})
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]

test('the supervisor’s dashboard: index, week by week, stores that got worse, by area and by person', async ({ page }, info) => {
  const state: FakeState = {
    workday: null, visits: [], uploads: [], memberships: supervisor, stores: [],
    rapportFacts: [
      fact('2026-09-21', 's1', 'Paternal', 'agus', 'welcoming', 3),
      fact('2026-09-28', 's2', 'Belgrano', 'lucia', 'restricted', 2),
      fact('2026-10-05', 's1', 'Paternal', 'agus', 'indifferent', 1),
      fact('2026-10-12', 's1', 'Paternal', 'agus', 'unwilling', 2),
      fact('2026-10-12', 's3', 'Belgrano', 'lucia', 'welcoming', 4),
      fact('2026-05-04', 's2', 'Belgrano', 'lucia', 'welcoming', 4), // the 90 days before
    ],
    reputation: [rep('s1', 1.2, 0.67, 2.67), rep('s2', 2, 2, 2), rep('s3', 3, 3, null)],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await page.goto('/s/stores')
  await page.getByRole('link', { name: 'Reputación' }).click()
  await expect(page).toHaveURL(/view=reputation/)

  // 12 rated visits: 7 welcoming, 2 restricted, 1 indifferent, 2 unwilling → (21+4+1)/12 = 2.17 → 72
  await expect(page.getByText('Índice de trato', { exact: true }).locator('..')).toContainText('72/100')
  await expect(page.getByText('Índice de trato', { exact: true }).locator('..')).toContainText('−28 contra los 90 días anteriores')
  await expect(page.getByText('Con buena onda', { exact: true }).locator('..')).toContainText('58 %')
  await expect(page.getByText('7 de 12 visitas calificadas')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Empeoraron' }).getByRole('link')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Empeoraron' })).toContainText('Mas Ahorro')
  await expect(page.getByRole('img', { name: /Semana del 12\/10: Buena onda 67 %, No quiso 33 %/ })).toBeAttached()
  const byPerson = page.getByRole('region', { name: 'Por activador' }).getByRole('listitem')
  await expect(byPerson.first()).toContainText('Agus Rezett') // worst first
  await expect(page.getByRole('region', { name: 'Por zona' }).getByRole('listitem').first()).toContainText('Paternal')

  const sideScroll = await page.evaluate(() => Array.from(document.querySelectorAll('main, main *')).filter((el) => el.scrollWidth > el.clientWidth + 1 && !['hidden', 'visible', 'clip'].includes(getComputedStyle(el).overflowX)).length)
  expect(sideScroll).toBe(0)
  await page.screenshot({ path: `test-results/reputation-dashboard-${info.project.name}.png`, fullPage: true })

  await page.getByRole('radio', { name: 'Últimos 30 días' }).click()
  await expect(page).toHaveURL(/days=30/)
  await expect(page.getByText('Sin período anterior para comparar')).toBeVisible()
})
