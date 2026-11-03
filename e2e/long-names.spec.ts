import { expect, test, type Page } from '@playwright/test'
import { atFakeToday, FAKE_TODAY, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

// Real addresses get long: nothing may push the page wider than the screen.
test.beforeEach(({ page }) => atFakeToday(page))

const LONG = 'Avenida General José Gervasio Artigas esquina Presidente Figueroa Alcorta 4965'
const NAME = 'Autoservicio Supermercado Horizonte Chino Hermanos Rodríguez'
const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const lucia = { id: 'p2', first_name: 'Maximiliano Alejandro', last_name: 'Fernández de la Torre' }

/** The page's own scrolling areas (main, the visit) must never scroll sideways: what widens them. */
async function overflowing(page: Page) {
  return page.evaluate(() => {
    const boxes = [document.documentElement, ...Array.from(document.querySelectorAll<HTMLElement>('[data-scroll]'))]
    return boxes
      .filter((box) => box.getClientRects().length && box.scrollWidth > box.clientWidth + 1)
      .flatMap((box) => {
        const edge = box.getBoundingClientRect().left + box.clientWidth
        return Array.from(box.querySelectorAll('*'))
          .filter((el) => el.getBoundingClientRect().right > edge + 1 && el.getBoundingClientRect().width > 0)
          .slice(-4)
          .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 40)}"`)
      })
  })
}

const check = async (page: Page, url: string, ready: RegExp | string) => {
  await page.goto(url)
  await expect(page.getByText(ready).filter({ visible: true }).first()).toBeVisible()
  await page.waitForTimeout(150)
  expect(await overflowing(page), url).toEqual([])
}

test('long names and addresses stay inside the screen, for the supervisor', async ({ page }, info) => {
  const of = { merchandiser_id: 'p2', merchandiser: { first_name: lucia.first_name, last_name: lucia.last_name }, workday_id: 'w-p2', work_date: FAKE_TODAY }
  const state: FakeState = {
    workday: null, uploads: [], memberships: supervisor, people: [lucia],
    workdays: [{ id: 'w-p2', company_id: 'c1', merchandiser_id: 'p2', work_date: FAKE_TODAY, status: 'published' }],
    stores: [{ id: 's-v1', name: NAME, address: LONG, area: 'Villa Urquiza Norte y Coghlan', customer_number: '422', location_status: 'verified', source: 'imported' }],
    visits: [
      visitRow('v1', 0, LONG, { ...of, work_status: 'done', consent: 'yes', task: 'Activar Punteras Campari y Skyy con collarines y armado de comedias', notes: 'COLOCACIÓN DE COLLARINES Y ARMADO DE COMEDIAS EN TODAS LAS GÓNDOLAS DEL LOCAL', arrived_at: `${FAKE_TODAY}T11:48:00-03:00`, finished_at: `${FAKE_TODAY}T12:06:00-03:00`, store: { id: 's-v1', name: NAME, address: LONG, area: 'Villa Urquiza', customer_number: '422', lat: null, lng: null, location_status: 'verified' } }),
      visitRow('v2', 1, LONG.replace('4965', '5000'), of),
    ],
  }
  await installFakeSupabase(page, state, 'supervisor')
  await check(page, '/s/today', /Maximiliano/)
  await check(page, '/s/today/p2', 'Locales en su orden')
  await check(page, '/review/v1', 'Notas del activador')
  await page.screenshot({ path: `test-results/long-review-${info.project.name}.png` })
  // From the review, the store's page in the directory, and back to the review.
  await page.getByRole('link', { name: 'Ver ficha del local' }).filter({ visible: true }).first().click()
  await expect(page).toHaveURL(/\/stores\/s-v1\?from=/)
  await expect(page.getByText(/Cliente 422/).filter({ visible: true }).first()).toBeVisible()
  await page.getByRole('main').getByRole('link', { name: 'Revisión' }).click()
  await expect(page).toHaveURL(/review/) // desktop shows it inside the inbox
  await check(page, '/s/stores', /Directorio/)
  await check(page, '/stores/s-v1', /Cliente 422/)
  await page.screenshot({ path: `test-results/long-store-${info.project.name}.png` })
})

test('long names and addresses stay inside the screen, for the activador', async ({ page }) => {
  const store = { id: 's-v1', name: NAME, address: LONG, area: 'Villa Urquiza Norte y Coghlan', customer_number: '422', lat: null, lng: null, location_status: 'verified' }
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: FAKE_TODAY, status: 'published', created_by: 'p1' },
    uploads: [],
    visits: [visitRow('v1', 0, LONG, { store, task: 'Activar Punteras Campari y Skyy con collarines y armado de comedias' }), visitRow('v2', 1, `${LONG} bis`)],
  }
  await installFakeSupabase(page, state)
  await check(page, '/s/workday', 'Autoservicio')
  await check(page, '/visit/v1', 'Llegada y fachada')
  await check(page, '/s/route', /Recorrido|recorrido/)
  await check(page, '/s/report', /Informe|informe/)
})
