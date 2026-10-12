import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const memberships = [
  { id: 'm0', company_id: 'own', roles: ['merchandiser', 'admin'], status: 'active', starts_on: '2026-10-01', company: { name: 'Agustín · uso propio', kind: 'personal' } },
  { id: 'm1', company_id: 'c1', roles: ['admin', 'merchandiser'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } },
]

test('on a phone the open view is in the header and can be changed', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the sidebar select covers desktop')
  const state: FakeState = { workday: null, visits: [], uploads: [], memberships }
  await installFakeSupabase(page, state)
  await page.goto('/s/workday?date=2026-10-12')

  const pill = page.getByRole('button', { name: 'Vista: Panda · Activador. Cambiar de vista' })
  await expect(pill).toBeVisible()
  await pill.click()
  const sheet = page.getByRole('dialog', { name: 'Cambiar de vista' })
  await expect(sheet.getByRole('region', { name: 'Autónomo' })).toBeVisible()
  await expect(sheet.locator('[aria-current="true"]')).toContainText('Activador')
  await page.screenshot({ path: 'test-results/views-sheet.png' })

  await sheet.getByRole('region', { name: 'Panda' }).getByRole('button', { name: /Admin/ }).click()
  await expect(page).toHaveURL(/\/s\/users/)
  await expect(page.getByRole('button', { name: 'Vista: Panda · Admin. Cambiar de vista' })).toBeVisible()
})

test('a stop added by mistake can be taken off the day', async ({ page }) => {
  const state: FakeState = {
    workday: { id: 'w1', company_id: 'c1', work_date: '2026-10-12', status: 'published', created_by: 'p1' },
    visits: [visitRow('v1', 0, 'Moldes 1365'), visitRow('v2', 1, 'Vidal 2044', { source: 'assigned', added_by: 'sup' })],
    uploads: [],
  }
  await installFakeSupabase(page, state)

  await page.goto('/visit/v2')
  await expect(page.getByText('Llegada y fachada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quitar de la jornada' })).toHaveCount(0)

  await page.goto('/visit/v1')
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: 'Quitar de la jornada' }).click()
  await expect(page).toHaveURL(/\/s\/workday/)
  expect(state.visits.map((v) => v.id)).toEqual(['v2'])
})
