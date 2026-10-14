import { expect, test } from '@playwright/test'
import { FAKE_TODAY, atFakeToday, installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

test.beforeEach(({ page }) => atFakeToday(page))

const supervisor = [{ id: 'm1', company_id: 'c1', roles: ['supervisor'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const of = (who: 'p2' | 'p3') => ({ source: 'assigned', merchandiser_id: who, work_date: FAKE_TODAY, merchandiser: who === 'p2' ? { first_name: 'Lucía', last_name: 'Gómez' } : { first_name: 'Diego', last_name: 'Paz' } })

const team = (): FakeState => ({
  workday: null,
  uploads: [],
  memberships: supervisor,
  people: [{ id: 'p2', first_name: 'Lucía', last_name: 'Gómez' }, { id: 'p3', first_name: 'Diego', last_name: 'Paz' }, { id: 'p4', first_name: 'Valentina', last_name: 'Ortiz' }],
  visits: [
    visitRow('l1', 0, 'Tres Arroyos 762', { ...of('p2'), work_status: 'done', review_status: 'approved' }),
    visitRow('l2', 1, 'Vidal 2044', { ...of('p2'), work_status: 'closed', review_status: 'needs_fix' }),
    visitRow('l3', 2, 'Echeverría 1580', { ...of('p2') }),
    visitRow('d1', 0, 'Moldes 1365', { ...of('p3'), work_status: 'done', review_status: 'approved' }),
    visitRow('d2', 1, 'Cabildo 2280', { ...of('p3'), work_status: 'refused', review_status: 'approved' }),
    visitRow('d3', 2, 'Blanco Encalada 2120', { ...of('p3'), work_status: 'done', review_status: 'approved', source: 'added' }), // added by Diego: an extra
  ],
  catalogs: {
    brand: [],
    display_type: [],
    work_metric: [
      { id: 1, name: 'Kits de bolsas', report_label: 'CUANTOS KIT DE BOLSAS ARME', active: true },
      { id: 2, name: 'Agrupaciones', report_label: 'CUANTAS AGRUPACIONES ARME', active: true },
    ],
  },
  dailyMetrics: [
    { company_id: 'c1', work_date: FAKE_TODAY, merchandiser_id: 'p2', metric_id: 1, quantity: 10 },
    { company_id: 'c1', work_date: FAKE_TODAY, merchandiser_id: 'p2', metric_id: 2, quantity: 7 },
    { company_id: 'c1', work_date: FAKE_TODAY, merchandiser_id: 'p3', metric_id: 1, quantity: 6 },
  ],
})

test("the team's day: numbers per merchandiser, each one's report and the team's to copy", async ({ page, context }, info) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await installFakeSupabase(page, team(), 'supervisor')
  await page.goto('/s/reports')
  const desktop = info.project.name === 'desktop'

  if (desktop) {
    const table = page.getByRole('table', { name: 'Informe del equipo por activador' })
    await expect(table.getByRole('row', { name: /Lucía/ })).toContainText('2 / 3')
    await expect(table.getByRole('row', { name: /Lucía/ })).toContainText('1 corrección')
    await expect(table.getByRole('row', { name: /Diego/ })).toContainText('3 aprobadas')
    await expect(table.getByRole('row', { name: /Equipo/ })).toContainText('5 / 6')
    await expect(table.getByRole('row', { name: /Equipo/ })).toContainText('16') // kits
    await expect(table.getByText('Valentina')).toHaveCount(0) // no visits that day
  } else {
    await expect(page.getByText('5/6')).toBeVisible()
    await expect(page.getByText('16', { exact: true }).filter({ visible: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /Lucía/ })).toContainText('10 kits de bolsas · 1 no visit. · 1 corrección')
  }

  const report = page.getByRole('region', { name: 'Informe de Lucía' })
  await expect(report).toContainText('CUANTOS CLIENTES VISITE: 2')
  await expect(report).toContainText('CUANTOS KIT DE BOLSAS ARME: 10')
  await expect(report).toContainText('Vidal 2044 (cerrado)')
  await page.screenshot({ path: `test-results/reports-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: /Diego/ }).click()
  const diego = page.getByRole('region', { name: 'Informe de Diego' })
  await expect(diego).toContainText('Cabildo 2280 (no autorizó)')
  await expect(diego).toContainText('Extras:\nBlanco Encalada 2120')

  await page.getByRole('button', { name: 'Copiar informe del equipo' }).filter({ visible: true }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text.startsWith('INFORME DEL EQUIPO 12/10\n\n*LUCÍA*\nRESUMEN DEL DIA 12/10')).toBe(true)
  expect(text).toContain('*DIEGO*\nRESUMEN DEL DIA 12/10\nCUANTOS CLIENTES VISITE: 3')
})

test('a day without visits says so', async ({ page }) => {
  await installFakeSupabase(page, { ...team(), visits: [] }, 'supervisor')
  await page.goto('/s/reports?date=2026-10-09')
  await expect(page.getByRole('heading', { name: 'Viernes 9 de octubre' })).toBeVisible()
  await expect(page.getByText('Nadie del equipo tiene visitas ese día')).toBeVisible()
})
