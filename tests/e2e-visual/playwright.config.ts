import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYGROUND_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './specs',
  timeout: 120_000,
  /** One baseline per test (no -linux/-win32); generate with `pnpm test:e2e-visual:update`. */
  snapshotPathTemplate: '{testDir}/{testFileDir}/{testFileName}-snapshots/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
    },
  },
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'node ../../scripts/e2e-preview-with-mock.mjs',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});