import { expect, test, type Page } from '@playwright/test'

// Supabase is mocked: these tests check what the app does with each answer.
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', exp: 9999999999, aud: 'authenticated', role: 'authenticated' })}.c2ln`

async function mockSupabase(page: Page, { dniOk }: { dniOk: boolean }) {
  await page.route('**/*.supabase.co/**', async (route) => {
    const url = route.request().url()
    if (url.includes('sign-in-with-dni')) {
      return dniOk
        ? route.fulfill({ json: { access_token: token, refresh_token: 'refresh' } })
        : route.fulfill({ status: 401, json: { error: 'invalid_credentials' } })
    }
    if (url.includes('/auth/v1/user')) {
      return route.fulfill({ json: { id: 'u1', email: 'agus@example.com', identities: [{ provider: 'email' }], aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' } })
    }
    if (url.includes('has_password')) return route.fulfill({ json: true })
    if (url.includes('/person?')) return route.fulfill({ json: [{ id: 'p1', first_name: 'Agus', last_name: 'Rezett' }] })
    if (url.includes('person_private')) return route.fulfill({ json: { dni: '35111222', phone: null, birth_date: null } })
    if (url.includes('membership')) {
      return route.fulfill({ json: [{ id: 'm1', company_id: 'c1', roles: ['merchandiser'], status: 'active', starts_on: '2026-10-01', company: { name: 'Panda' } }] })
    }
    return route.fulfill({ json: [] })
  })
}

async function signInWithDni(page: Page) {
  await page.goto('/login')
  await page.getByLabel('DNI o email').fill('35.111.222')
  await page.getByLabel('Contraseña', { exact: true }).fill('secreto123')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
}

test('signing in with DNI opens the role view right away', async ({ page }) => {
  await mockSupabase(page, { dniOk: true })
  await signInWithDni(page)
  await expect(page).toHaveURL(/\/s\/workday$/)
  await expect(page.getByRole('heading', { name: /jornada/i })).toBeVisible()
})

test('a wrong DNI or password says so', async ({ page }) => {
  await mockSupabase(page, { dniOk: false })
  await signInWithDni(page)
  await expect(page.getByRole('alert')).toHaveText('El DNI o la contraseña no coinciden.')
  await expect(page).toHaveURL(/\/login$/)
})
