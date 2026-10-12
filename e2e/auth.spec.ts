import { expect, test } from '@playwright/test'

test('signed-out visitors land on the login screen', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuar con Google' })).toBeVisible()
  await expect(page.getByLabel('DNI o email')).toBeVisible()
})

test('login validates empty fields in Spanish', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByText('Ingresá tu DNI o email')).toBeVisible()
  await expect(page.getByText('Ingresá tu contraseña')).toBeVisible()
})

test('sign-up is reachable and validates the password', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Crear cuenta o aceptar invitación' }).click()
  await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible()
  await page.getByLabel('Email').fill('agus@example.com')
  await page.getByLabel('Creá una contraseña').fill('corta')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page.getByText('Usá al menos 8 caracteres')).toBeVisible()
})

test('protected pages redirect to login', async ({ page }) => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login$/)
})

test('desktop shows the brand panel, phones do not', async ({ page }, info) => {
  await page.goto('/login')
  const panel = page.getByText('Tu jornada de campo, del recorrido al OK.')
  if (info.project.name === 'desktop') await expect(panel).toBeVisible()
  else await expect(panel).toBeHidden()
})

test('the password can be shown and hidden', async ({ page }) => {
  await page.goto('/login')
  const input = page.getByLabel('Contraseña', { exact: true })
  await input.fill('secreto123')
  await expect(input).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar contraseña' }).click()
  await expect(input).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Ocultar contraseña' }).click()
  await expect(input).toHaveAttribute('type', 'password')
})
