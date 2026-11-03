import { expect, test } from '@playwright/test'
import { atFakeToday, installFakeSupabase, visitRow, type FakeState, type Row } from './support/fake-supabase'
import { pick } from './support/select'

test.beforeEach(({ page }) => atFakeToday(page)) // Monday 12 October 2026

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const people = { p2: ['Lucía', 'Gómez'], p3: ['Diego', 'Paz'] } as const
const at = (d: string, h: number, m = 0) => `${d}T${String(h + 3).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`

/** A visit of someone on a day, ending a given way, in a store of a zone and channel. */
const visit = (id: string, who: 'p2' | 'p3', d: string, ws: string, store: Row, extra: Row = {}): Row =>
  visitRow(id, 0, String(store.address), {
    merchandiser_id: who, merchandiser: { first_name: people[who][0], last_name: people[who][1] }, work_date: d, work_status: ws,
    arrived_at: ws === 'pending' ? null : at(d, 10), finished_at: ws === 'done' ? at(d, 10, 25) : null, consent: ws === 'refused' ? 'refused' : 'yes',
    store_id: store.id, store: { ...store, lat: null, lng: null, location_status: 'verified', name: null, customer_number: null }, ...extra,
  })

const s1 = { id: 's1', address: 'Tres Arroyos 762', area: 'Paternal', channel_id: 1 }
const s2 = { id: 's2', address: 'Moldes 1365', area: 'Belgrano', channel_id: 2 }
const s3 = { id: 's3', address: 'Cabildo 2280', area: 'Belgrano', channel_id: 1 }

const state = (): FakeState => ({
  workday: null, uploads: [], memberships: supervisor,
  people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }, { id: 'p3', first_name: 'Diego', last_name: 'Paz' }],
  catalogs: {
    brand: [], display_type: [],
    channel: [{ id: 1, name: 'Autoservicio', active: true }, { id: 2, name: 'Kiosco', active: true }],
    work_metric: [{ id: 1, name: 'Punteras activadas', report_label: 'PUNTERAS', active: true }],
  },
  visits: [
    // The week before (to compare): 2 visits
    visit('o1', 'p2', '2026-10-01', 'done', s1),
    visit('o2', 'p3', '2026-10-02', 'refused', s3),
    // This week: 6 visits, one pending
    visit('a1', 'p2', '2026-10-06', 'done', s1),
    visit('a2', 'p2', '2026-10-07', 'done', s2),
    visit('a3', 'p3', '2026-10-07', 'refused', s3),
    visit('a4', 'p3', '2026-10-09', 'done', s2),
    visit('a5', 'p2', '2026-10-10', 'closed', s3),
    visit('a6', 'p3', '2026-10-12', 'pending', s1),
  ],
  dailyMetrics: [
    { company_id: 'c1', work_date: '2026-10-06', merchandiser_id: 'p2', metric_id: 1, quantity: 4 },
    { company_id: 'c1', work_date: '2026-10-09', merchandiser_id: 'p3', metric_id: 1, quantity: 3 },
  ],
})

test('the reports panel: the period in figures, against the one before, by person, with estimates and export', async ({ page }, info) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/reports?period=7d')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Del 6 al 12 (de )?oct/)

  const kpis = page.getByRole('list', { name: 'Indicadores del período' })
  const tile = (label: string) => kpis.getByRole('listitem').filter({ hasText: label })
  await expect(tile('Visitas con resultado')).toContainText('5')
  await expect(tile('Visitas con resultado')).toContainText('+150 %') // 5 against 2
  await expect(tile('Cumplimiento')).toContainText('83 %')
  await expect(tile('No autorizadas')).toContainText('20 %')
  await expect(page.getByRole('region', { name: 'Lectura rápida' })).toContainText('subieron 150 %')
  await expect(page.getByRole('list', { name: 'Visitas por día' }).getByRole('listitem')).toHaveCount(7)
  await expect(page.getByRole('region', { name: 'Trabajo realizado' })).toContainText('7') // punteras
  const ranking = page.getByRole('region', { name: 'Activadores' })
  await expect(ranking.getByRole('row', { name: /Lucía/ })).toContainText('3/3')
  // The whole panel, tall enough for every block (the app scrolls inside, not the page).
  const size = page.viewportSize()
  if (size) await page.setViewportSize({ width: size.width, height: 3400 })
  await page.screenshot({ path: `test-results/reports-panel-${info.project.name}.png` })
  if (size) await page.setViewportSize(size)

  // One person only: everything follows.
  await ranking.getByRole('button', { name: /Diego Paz/ }).click()
  await expect(tile('Visitas con resultado')).toContainText('2')
  await page.getByRole('button', { name: 'Limpiar' }).click()

  // Another period, without comparing.
  await pick(page.getByRole('combobox', { name: 'Período' }), 'Últimos 30 días')
  await expect(page).toHaveURL(/period=30d/)
  await page.getByRole('switch', { name: 'Comparar con el período anterior' }).click()
  await expect(tile('Visitas con resultado')).toContainText('7')
  await expect(tile('Visitas con resultado')).not.toContainText('vs. período anterior')

  // The numbers as a spreadsheet.
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar CSV' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^visitario-2026-09-13-2026-10-12\.csv$/)
})

test('the day’s reports are one tab away, and old links with a date open them', async ({ page }) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto('/s/reports?date=2026-10-07')
  await expect(page.getByRole('radio', { name: 'Informes del día' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('heading', { name: 'Miércoles 7 de octubre' })).toBeVisible()
  await page.getByRole('radio', { name: 'Panel' }).click()
  await expect(page.getByRole('list', { name: 'Indicadores del período' })).toBeVisible()
})

test('the version of Visitario is in sight', async ({ page }, info) => {
  await installFakeSupabase(page, state(), 'supervisor')
  await page.goto(info.project.name === 'desktop' ? '/s/today' : '/profile')
  await expect(page.getByText(/^Visitario v\d+\.\d+\.\d+$/).filter({ visible: true })).toBeVisible()
})
