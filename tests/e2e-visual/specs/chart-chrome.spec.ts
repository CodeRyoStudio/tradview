import { test, expect } from '@playwright/test';

/**
 * DESIGN-v2 §10.4 — pixel regression for critical chart chrome.
 * Run: pnpm test:e2e-visual
 * Update baselines: E2E_UPDATE_SNAPSHOTS=1 pnpm test:e2e-visual
 */

/** Wait for Bridge workspace mount (avoids flaky fixed timeouts while WS loads). */
async function waitForWorkspaceReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const log = document.getElementById('log')?.textContent ?? '';
      return log.includes('chart.workspaceReady') || log.includes('chart.ready');
    },
    { timeout: 45_000 },
  );
}

test.describe('chart chrome (playground)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/workspace.html');
    await page.waitForSelector('.tv-workspace-chart-slot, [data-chart-id]', {
      timeout: 30_000,
    });
    await waitForWorkspaceReady(page);
  });

  test('workspace chart slot is visible', async ({ page }) => {
    const slot = page.locator('.tv-workspace-chart-slot').first();
    await expect(slot).toBeVisible();
    const canvas = slot.locator('canvas').first();
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  });

  test('workspace layout snapshot', async ({ page }) => {
    // Baselines not committed yet — skip pixel compare in CI until E2E_UPDATE_SNAPSHOTS=1 run.
    test.skip(
      !!process.env.CI,
      'Pixel baselines not in repo; run E2E_UPDATE_SNAPSHOTS=1 locally, then commit specs/**-snapshots/',
    );
    await expect(page).toHaveScreenshot('workspace-layout.png', {
      fullPage: false,
      animations: 'disabled',
    });
  });
});