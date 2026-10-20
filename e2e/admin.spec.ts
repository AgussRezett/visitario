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
  if (info.project.name === 'desktop') {
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.getByRole('button', { name: 'Editar Equipo Norte' }).hover()
    await page.waitForTimeout(400) // the theme's color transitions
    await page.screenshot({ path: 'test-results/users-dark-desktop.png' })
    await page.evaluate(() => { delete document.documentElement.dataset.theme })
  }

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

test('a merchandiser nobody reviews: their visits approve themselves', async ({ page }, info) => {
  const state = company()
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users')
  await page.getByRole('button', { name: /Martín Sosa/ }).click()
  await expect(page.getByRole('dialog', { name: 'Martín Sosa' }).getByText('Aprobar sus visitas solas')).toHaveCount(0) // a supervisor only
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: /Lucía Gómez/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Lucía Gómez' })
  await expect(sheet.getByText('Sus visitas terminadas esperan en Revisión a que un supervisor las apruebe.')).toBeVisible()
  await sheet.getByRole('switch', { name: /Aprobar sus visitas solas/ }).click()
  await expect(sheet.getByText('Al terminar una visita queda aprobada; no pasa por Revisión.')).toBeVisible()
  await page.screenshot({ path: `test-results/person-auto-approve-${info.project.name}.png`, fullPage: true })
  await sheet.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByRole('alertdialog')).toContainText('Las que ya terminó y esperan revisión se aprueban ahora.')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Aprobar solas' }).click()
  await expect.poll(() => state.members?.find((m) => m.person_id === 'p3')?.auto_approve).toBe(true)
})

test('inviting someone Visitario already knows: DNI and email, and the email goes out with an hour to accept', async ({ page }, info) => {
  const state = company({ dnis: { '38112904': { person_id: 'p9', first_name: 'Lucas', last_name: 'Méndez', phone_last4: '7782', is_member: false } } })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users')
  await page.getByRole('button', { name: 'Dar de alta' }).click()
  await page.getByLabel('DNI', { exact: true }).fill('38.112.904')
  await page.getByRole('button', { name: 'Ver si ya usa Visitario' }).click()
  await expect(page.getByText('Ya tiene perfil en Visitario')).toBeVisible()
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveCount(0) // nothing personal is asked
  const send = page.getByRole('button', { name: 'Invitar a Lucas' })
  await expect(send).toBeDisabled() // the email is needed
  await page.getByLabel('Email').fill('Lucas@Mendez.com ')
  await page.getByRole('radio', { name: /Supervisor/ }).click()
  await page.getByLabel('Equipo que supervisa').selectOption({ label: 'Equipo Norte' })
  await page.screenshot({ path: `test-results/invite-${info.project.name}.png`, fullPage: true })
  await send.click()

  await expect(page.getByText('Le mandamos la invitación a lucas@mendez.com')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mandar por WhatsApp' })).toHaveAttribute('href', /invitacion%2Ftok-1/)
  expect(state.invite?.created?.[0]).toMatchObject({ action: 'create', dni: '38112904', email: 'lucas@mendez.com', roles: ['supervisor'], teamId: 'north' })
})

test('when the email cannot go out, the link is there to send it by WhatsApp', async ({ page }, info) => {
  const state = company({ invite: { sent: false } })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users/new')
  await page.getByLabel('DNI', { exact: true }).fill('40555666')
  await page.getByLabel('Email').fill('nora@ibarra')
  await expect(page.getByText('Revisá el email.')).toBeVisible()
  await page.getByLabel('Email').fill('nora@ibarra.com')
  await page.getByRole('button', { name: 'Mandar invitación' }).click()
  await expect(page.getByText('No pudimos mandar el mail')).toBeVisible()
  await expect(page.getByText(/\/invitacion\/tok-1/)).toBeVisible()
  await page.screenshot({ path: `test-results/invite-failed-${info.project.name}.png`, fullPage: true })
})

test('open invitations: sent, failed and expired; resend gives a new link, cancel asks first', async ({ page }, info) => {
  const at = (min: number) => new Date(Date.now() + min * 60_000).toISOString()
  const row = (id: string, email: string, extra = {}) => ({ id, dni: '40555666', email, roles: ['merchandiser'], team_id: null, starts_on: '2026-10-19', expires_at: at(40), sent_at: at(-20), send_error: null, sends: 1, created_at: at(-20), ...extra })
  const state = company({ invite: { list: [
    row('i1', 'nora@ibarra.com'),
    row('i2', 'pablo@gomez.com', { sent_at: null, send_error: 'not_configured' }),
    row('i3', 'ana@ruiz.com', { expires_at: at(-90), sends: 2 }),
  ] } })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/users')
  if (info.project.name !== 'desktop') await page.getByRole('radio', { name: 'Invitaciones 3' }).click()
  const list = page.getByRole('list', { name: 'Invitaciones abiertas' })
  const item = (email: string) => list.getByRole('listitem').filter({ hasText: email })
  await expect(item('nora@ibarra.com')).toContainText('Enviada')
  await expect(item('nora@ibarra.com')).toContainText(/vence en (39|40) min/)
  await expect(item('pablo@gomez.com')).toContainText('No se pudo enviar')
  await expect(item('ana@ruiz.com')).toContainText('Vencida')
  await expect(item('ana@ruiz.com')).toContainText('venció hace 2 h · enviada 2 veces')
  await page.screenshot({ path: `test-results/invitations-${info.project.name}.png`, fullPage: true })

  await item('ana@ruiz.com').getByRole('button', { name: 'Reenviar con enlace nuevo' }).click()
  await expect(item('ana@ruiz.com')).toContainText('Le mandamos la invitación a ana@ruiz.com')
  expect(state.invite?.resent).toEqual(['i3'])

  await item('pablo@gomez.com').getByRole('button', { name: 'Cancelar' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar invitación' }).click()
  await expect.poll(() => state.invite?.canceled).toEqual(['i2'])
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
  await expect.poll(() => state.catalogs?.brand?.some((b) => b.name === 'Aperol' && b.group_name === 'Grupo Campari')).toBe(true)

  await page.getByRole('switch', { name: 'Kits de bolsas activo' }).click()
  await expect.poll(() => state.catalogs?.work_metric?.find((m) => m.id === 2)?.active).toBe(false)
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
    company: { id: 'c1', name: 'Panda', geocoding_scope: 'caba', show_whatsapp: true, photo_retention_months: 12, logo_version: null, shift_start: '09:00:00', shift_end: '14:00:00' },
    templates: [{ kind: 'after', body: '*ACTIVACIÓN DE GONDOLA DESPUES\nFecha: {date}\nDireccion: {address}\nNum clte: {customer_number}\nZona: {area}\nObservación: {notes}' }],
    visits: [visitRow('v1', 0, 'Tres Arroyos 762', { store, work_status: 'done', finished_at: '2026-10-09T15:00:00Z', notes: 'Faltó SKYY; reordené la puntera.', merchandiser: { first_name: 'Lucía', last_name: 'Gómez' } })],
  })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/templates')
  const preview = page.getByRole('region', { name: 'Vista previa' })
  await expect(preview.getByText(/Num clte: 12345/)).toBeVisible()
  await expect(preview.getByText(/Observación: Faltó SKYY/)).toBeVisible()
  if (info.project.name === 'desktop') {
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await page.getByRole('button', { name: 'Insertar Tarea' }).hover()
    await page.waitForTimeout(400) // the theme's color transitions
    await page.screenshot({ path: 'test-results/templates-dark-desktop.png' })
    await page.evaluate(() => { delete document.documentElement.dataset.theme })
  }

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
    company: { id: 'c1', name: 'Panda', kind: 'distributor', geocoding_scope: 'caba', show_whatsapp: true, photo_retention_months: 12, logo_version: null, shift_start: '09:00:00', shift_end: '14:00:00' },
    subscription: { company_id: 'c1', plan: 'pilot', status: 'active', ends_on: '2026-11-30', next_billing_on: '2026-12-01', auto_debit: false, payment_method_summary: null, estimated_amount_cents: null, currency: 'ARS' },
    usage: { active_people: 7, photo_bytes: 2_100_000_000, photos: 9800, visits_this_month: 412, stores: 230, ai_captures_this_month: 0 },
    visits: [visitRow('v1', 0, 'Tres Arroyos 762', { notes: 'Faltó "SKYY"; volver' })],
    supportLog: [{ id: 's1', reason: 'Martín no ve las visitas de Lucía', starts_at: '2026-10-12T15:00:00-03:00', ends_at: '2026-10-12T17:00:00-03:00' }],
  })
  await installFakeSupabase(page, state, 'admin')
  await page.goto('/s/company')
  await expect(page.getByRole('heading', { name: 'Plan piloto' })).toBeVisible()
  // Visitario looking at the company's data is on record, with its reason
  const log = page.getByRole('region', { name: 'Accesos de soporte' })
  await expect(log.getByText('Martín no ve las visitas de Lucía')).toBeVisible()
  await expect(log.getByText('Equipo de Visitario · 12/10/2026, 15:00 a 17:00')).toBeVisible()
  await expect(page.getByText('El piloto termina el 30/11/2026')).toBeVisible()
  await expect(page.getByText('2,1 GB')).toBeVisible()
  await expect(page.getByText('A definir')).toBeVisible()
  await page.screenshot({ path: `test-results/company-${info.project.name}.png`, fullPage: true })

  const hours = page.getByRole('region', { name: 'Horario de trabajo' })
  await hours.getByLabel('Desde').fill('08:30')
  await hours.getByLabel('Hasta').fill('15:00')
  await hours.getByRole('button', { name: 'Guardar' }).click()
  await expect.poll(() => [state.company?.shift_start, state.company?.shift_end]).toEqual(['08:30', '15:00'])

  await page.getByLabel('Nombre').fill('Panda Distribuidora')
  await page.getByRole('region', { name: 'Datos de la empresa' }).getByRole('button', { name: 'Guardar' }).click()
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
