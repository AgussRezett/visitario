import type { Locator, Page } from '@playwright/test'

export type FakeFile = { name: string; mimeType: string; buffer: Buffer }

/** Picks files in "Leer con IA", with optional indications, and reads them. */
export async function readFiles(where: Page | Locator, files: FakeFile[], indications = '') {
  await where.getByLabel('Elegir archivos').setInputFiles(files)
  if (indications) await where.getByLabel('Indicaciones (opcional)').fill(indications)
  await where.getByRole('button', { name: /^Leer (el archivo|los \d archivos)$/ }).click()
}
