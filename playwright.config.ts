import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // GitHub's runners are slower: a test that fails then passes on retry is reported as flaky, not failed.
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: { command: 'npm run build && npm run preview -- --port 4173', port: 4173, reuseExistingServer: !process.env.CI },
})
