import { expect, test } from '@playwright/test'

// The phone's status bar takes the ground of the active theme, so it reads as the header.
for (const [scheme, ground] of [['light', '#f6f7f2'], ['dark', '#0f1a16']] as const) {
  test(`status bar follows the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await page.goto('/login')
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', ground)
  })
}
