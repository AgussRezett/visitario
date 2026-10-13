import { expect, test } from '@playwright/test'
import { installFakeSupabase, visitRow, type FakeState } from './support/fake-supabase'

const admin = [{ id: 'm1', company_id: 'c1', roles: ['admin'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda', kind: 'distributor' } }]
const member = (id: string, first: string, last: string, extra: Record<string, unknown> = {}) => ({
  membership_id: `m-${id}`, person_id: id, first_name: first, last_name: last, roles: ['merchandiser'], team_id: 'north', status: 'active',
  starts_on: '2026-10-01', phone_last4: '4521', last_activity_at: new Date(Date.now() - 4 * 60_000).toISOString(), invited_at: '2026-10-01T12:00:00Z', ...extra,
})
const company = (extra: Partial<FakeState> = {}): FakeState => ({
  workday: null, visits: [], uploads: [], memberships: admin,
  teams: [{ id: 'north', name: 'Equipo Norte', areas: 'Belgrano, Paternal' }, { id: 'west', name: 'Equipo Oeste', areas: null }],
  members: [
    member('p2', 'Martín', 'Sosa', { roles: ['supervisor'] }),
    member('p3', 'Lucía', 'Gómez'),
    member('p4', 'Sofía', 'Benítez', { status: 'invited', last_activity_at: null }),
    member('p5', 'Juan', 'Pérez', { status: 'disabled', team_id: 'west', last_activity_at: '2026-08-01T12:00:00Z' }),
    member('p1', 'Carla', 'López', { roles: ['admin'], team_id: null }),
  ],
  ...extra,
})

test('the admin sees people and teams, changes a role, brings someone back and adds a team', async ({ page }, info) => {
  const state = company()
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users')
  await expect(page.getByRole('heading', { name: 'Usuarios y equipos' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Lucía Gómez/ })).toBeVisible()
  await page.screenshot({ path: `test-results/users-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: /Lucía Gómez/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Lucía Gómez' })
  await sheet.getByRole('button', { name: 'Supervisor', exact: true }).click()
  await sheet.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect.poll(() => state.members?.find((m) => m.person_id === 'p3')?.roles).toEqual(['merchandiser', 'supervisor'])

  await page.getByRole('button', { name: /Juan Pérez/ }).click()
  await page.getByRole('dialog', { name: 'Juan Pérez' }).getByRole('button', { name: 'Reactivar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Reactivar' }).click()
  await expect.poll(() => state.members?.find((m) => m.person_id === 'p5')?.status).toBe('active')

  if (info.project.name !== 'desktop') await page.getByRole('radio', { name: /Equipos/ }).click()
  await expect(page.getByText('Supervisor: Martín Sosa')).toBeVisible()
  await page.getByRole('button', { name: 'Nuevo equipo' }).click()
  await page.getByRole('dialog', { name: 'Nuevo equipo' }).getByLabel('Nombre', { exact: true }).fill('Equipo Sur')
  await page.getByRole('button', { name: 'Crear equipo' }).click()
  await expect.poll(() => state.teams?.some((t) => t.name === 'Equipo Sur')).toBe(true)
})

test('inviting someone Visitario already knows: nothing personal is asked again', async ({ page }, info) => {
  const state = company({ dnis: { '38112904': { person_id: 'p9', first_name: 'Lucas', last_name: 'Méndez', phone_last4: '7782', is_member: false } } })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users')
  await page.getByRole('button', { name: 'Dar de alta' }).click()
  await page.getByLabel('DNI', { exact: true }).fill('38.112.904')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('Ya tiene perfil en Visitario')).toBeVisible()
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveCount(0)
  await page.getByRole('radio', { name: /Supervisor/ }).click()
  await page.getByLabel('Equipo que supervisa').selectOption({ label: 'Equipo Norte' })
  await page.screenshot({ path: `test-results/invite-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Invitar a Lucas' }).click()

  await expect(page.getByText('Listo: Lucas tiene la invitación')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mandar por WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=Hola%20Lucas/)
  expect(state.members?.find((m) => m.person_id === 'p9')).toMatchObject({ roles: ['supervisor'], team_id: 'north', status: 'invited' })
})

test('inviting a new DNI asks for name and phone, and the WhatsApp goes to that phone', async ({ page }) => {
  const state = company()
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users/new')
  await page.getByLabel('DNI', { exact: true }).fill('40555666')
  await page.getByRole('button', { name: 'Buscar' }).click()
  await expect(page.getByText('El DNI 40.555.666 no está en Visitario')).toBeVisible()
  await page.getByLabel('Nombre', { exact: true }).fill('Nora')
  await page.getByLabel('Apellido').fill('Ibarra')
  await page.getByLabel('Celular').fill('11 15 5555-0000')
  await page.getByRole('button', { name: 'Invitar a Nora' }).click()
  await expect(page.getByRole('link', { name: 'Mandar por WhatsApp' })).toHaveAttribute('href', /wa\.me\/5491155550000\?/)
  expect(state.members?.at(-1)).toMatchObject({ first_name: 'Nora', roles: ['merchandiser'], status: 'invited' })
})

test('catalogs: add a brand, deactivate a work metric, rename and forget a format', async ({ page }, info) => {
  const state = company({
    catalogs: {
      brand: [{ id: 1, name: 'Campari', group_name: 'Grupo Campari', active: true }, { id: 2, name: 'SKYY', group_name: 'Grupo Campari', active: true }],
      display_type: [{ id: 1, name: 'Puntera', active: true }, { id: 3, name: 'Góndola', active: true }],
      work_metric: [{ id: 1, name: 'Unidades repuestas', report_label: null, active: true }, { id: 2, name: 'Kits de bolsas', report_label: 'CUANTOS KIT DE BOLSAS ARME', active: true }],
    },
    formats: [{ id: 'f1', company_id: 'c1', name: 'Panda diaria', signature: 'cliente|domicilio|repositor', mapping: { columns: ['customer_number', 'address', 'merchandiser'], hasHeader: true, scope: 'caba', aliases: {} }, last_used_at: '2026-10-09T22:00:00Z' }],
  })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/catalogs')
  await expect(page.getByRole('heading', { name: 'Catálogos', level: 1 })).toBeVisible()
  await expect(page.getByText('CLIENTE → Nro. de cliente · DOMICILIO → Dirección · REPOSITOR → Activador')).toBeVisible()

  await page.getByRole('button', { name: 'Agregar marca' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nueva marca' })
  await sheet.getByLabel('Nombre').fill('Aperol')
  await sheet.getByLabel('Grupo').fill('Grupo Campari')
  await sheet.getByRole('button', { name: 'Agregar' }).click()
  await expect.poll(() => state.catalogs?.brand.some((b) => b.name === 'Aperol' && b.group_name === 'Grupo Campari')).toBe(true)

  await page.getByRole('switch', { name: 'Kits de bolsas activo' }).click()
  await expect.poll(() => state.catalogs?.work_metric.find((m) => m.id === 2)?.active).toBe(false)
  await expect(page.getByRole('switch', { name: 'Kits de bolsas activo' })).toHaveAttribute('aria-checked', 'false')
  await page.waitForTimeout(300) // let the switch finish moving
  await page.screenshot({ path: `test-results/catalogs-${info.project.name}.png`, fullPage: true })

  await page.getByRole('button', { name: 'Editar Panda diaria' }).click()
  await page.getByRole('dialog', { name: 'Panda diaria' }).getByLabel('Nombre').fill('Panda semanal')
  await page.getByRole('dialog', { name: 'Panda diaria' }).getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => state.formats?.[0]?.name).toBe('Panda semanal')
  await page.getByRole('button', { name: 'Editar Panda semanal' }).click()
  await page.getByRole('button', { name: 'Olvidar formato' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Olvidar formato' }).click()
  await expect.poll(() => state.formats?.length).toBe(0)
})

test('templates: write with Spanish data, preview on a real visit, save, hide WhatsApp', async ({ page }, info) => {
  const store = { id: 's1', name: 'Mas Ahorro', address: 'Tres Arroyos 762', area: 'Paternal', customer_number: '12345', lat: null, lng: null, location_status: 'verified' }
  const state = company({
    company: { id: 'c1', name: 'Panda', geocoding_scope: 'caba', show_whatsapp: true, photo_retention_months: 12, logo_version: null },
    templates: [{ kind: 'after', body: '*ACTIVACIÓN DE GONDOLA DESPUES\nFecha: {date}\nDireccion: {address}\nNum clte: {customer_number}\nZona: {area}\nObservación: {notes}' }],
    visits: [visitRow('v1', 0, 'Tres Arroyos 762', { store, work_status: 'done', finished_at: '2026-10-09T15:00:00Z', notes: 'Faltó SKYY; reordené la puntera.', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' } })],
  })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/templates')
  const preview = page.getByRole('region', { name: 'Vista previa' })
  await expect(preview.getByText(/Num clte: 12345/)).toBeVisible()
  await expect(preview.getByText(/Observación: Faltó SKYY/)).toBeVisible()

  await page.getByLabel('Texto', { exact: true }).fill('HOLA {nombre}\nZona: {zona}\nTarea: ')
  await page.getByRole('button', { name: 'Insertar Tarea' }).click()
  await expect(page.getByLabel('Texto', { exact: true })).toHaveValue('HOLA {nombre}\nZona: {zona}\nTarea: {tarea}')
  await expect(preview.getByText(/HOLA Mas Ahorro/)).toBeVisible()
  await expect(preview.getByText(/Tarea:/)).toHaveCount(0) // no task: the line is left out
  await page.screenshot({ path: `test-results/templates-${info.project.name}.png`, fullPage: true })
  await page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByText('Guardada: los activadores la usan desde su próxima visita.')).toBeVisible()
  expect(state.templates?.find((t) => t.kind === 'after')?.body).toBe('HOLA {nombre}\nZona: {zona}\nTarea: {tarea}')

  await page.getByRole('switch', { name: /Mostrar los botones de WhatsApp/ }).click()
  await expect.poll(() => state.company?.show_whatsapp).toBe(false)
})

test('company and plan: billing shows, settings save, data exports', async ({ page }, info) => {
  const state = company({
    company: { id: 'c1', name: 'Panda', kind: 'distributor', geocoding_scope: 'caba', show_whatsapp: true, photo_retention_months: 12, logo_version: null },
    subscription: { company_id: 'c1', plan: 'pilot', status: 'active', ends_on: '2026-11-30', next_billing_on: '2026-12-01', auto_debit: false, payment_method_summary: null, estimated_amount_cents: null, currency: 'ARS' },
    usage: { active_people: 7, photo_bytes: 2_100_000_000, photos: 9800, visits_this_month: 412, stores: 230, ai_captures_this_month: 0 },
    visits: [visitRow('v1', 0, 'Tres Arroyos 762', { notes: 'Faltó "SKYY"; volver' })],
  })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/company')
  await expect(page.getByRole('heading', { name: 'Plan piloto' })).toBeVisible()
  await expect(page.getByText('El piloto termina el 30/11/2026')).toBeVisible()
  await expect(page.getByText('2,1 GB')).toBeVisible()
  await expect(page.getByText('A definir')).toBeVisible()
  await page.screenshot({ path: `test-results/company-${info.project.name}.png`, fullPage: true })

  await page.getByLabel('Nombre').fill('Panda Distribuidora')
  await page.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => state.company?.name).toBe('Panda Distribuidora')
  await page.getByRole('radio', { name: 'Toda Argentina' }).click()
  await expect.poll(() => state.company?.geocoding_scope).toBe('argentina')
  await page.getByLabel('Guardar fotos durante').selectOption('24')
  await expect.poll(() => state.company?.photo_retention_months).toBe(24)

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Exportar visitas' }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^panda-distribuidora-visitas-\d{4}-\d{2}-\d{2}\.csv$/)
  const text = await (await file.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'))
  expect(text).toContain('Fecha;Activador;Comercio;Dirección')
  expect(text).toContain('"Faltó ""SKYY""; volver"')
})
