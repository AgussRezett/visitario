import type { Locator, Page } from '@playwright/test'

/** Visitario's Select: opens it by its label and picks the option with that text. */
export async function choose(scope: Page | Locator, label: string | RegExp, option: string | RegExp) {
  const page = 'goto' in scope ? scope : scope.page()
  await scope.getByRole('combobox', { name: label, exact: typeof label === 'string' }).filter({ visible: true }).first().click()
  await page.getByRole('listbox').getByRole('option', { name: option, exact: typeof option === 'string' }).click()
  await closeIfMultiple(page)
}

/** A filter of several stays open after a pick: "Listo" closes it. */
async function closeIfMultiple(page: Page) {
  const done = page.getByRole('button', { name: 'Listo', exact: true })
  if (await page.locator('[role="listbox"][aria-multiselectable="true"]').count()) await done.click()
}

/** The value a Select holds (its button's data-value). */
export const selectValue = (scope: Page | Locator, label: string | RegExp) =>
  scope.getByRole('combobox', { name: label, exact: typeof label === 'string' }).filter({ visible: true }).first().getAttribute('data-value')

/** Opens the Select (its button) and picks the option with that text. */
export async function pick(trigger: Locator, option: string | RegExp) {
  await trigger.filter({ visible: true }).first().click()
  await trigger.page().getByRole('listbox').getByRole('option', { name: option, exact: typeof option === 'string' }).click()
  await closeIfMultiple(trigger.page())
}
