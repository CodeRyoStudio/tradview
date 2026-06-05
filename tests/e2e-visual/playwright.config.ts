import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYGROUND_URL ?? 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
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
  webServer: process.env.CI
    ? {
        command: 'pnpm --filter @coderyo/playground preview --host 127.0.0.1 --port 5173',
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});