import type { Locator, Page } from '@playwright/test'
import { pick } from './select'

/**
 * Several stores pasted: open the review, give the channel to the ones without it (when the
 * company has channels) and add them.
 */
export async function reviewAndAdd(scope: Page | Locator, count: number, channel = 'Sin canal') {
  const word = count === 1 ? 'local' : 'locales'
  await scope.getByRole('button', { name: `Revisar ${count} ${word}` }).click()
  const bulk = scope.getByLabel(/^Canal de(l local| los \d+) sin canal$/)
  if (await bulk.isVisible().catch(() => false)) await pick(bulk, channel)
  await scope.getByRole('button', { name: `Agregar ${count} ${word}` }).click()
}
