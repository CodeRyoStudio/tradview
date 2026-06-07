import { test, expect } from '@playwright/test';

/**
 * DESIGN-v2 §10.4 — pixel regression for critical chart chrome.
 * Run: pnpm test:e2e-visual
 * Update baselines: pnpm test:e2e-visual:update
 */

/** Charts mounted: WebGL canvas visible in first workspace slot (mock + preview). */
async function waitForWorkspaceReady(page: import('@playwright/test').Page): Promise<void> {
  const slot = page.locator('.tv-workspace-chart-slot').first();
  await expect(slot.locator('canvas').first()).toBeVisible({ timeout: 90_000 });
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
    const workspace = page.locator('#workspace');
    // Mask WebGL canvases — candle pixels vary slightly across runs/OS; chrome grid is stable.
    await expect(workspace).toHaveScreenshot('workspace-layout.png', {
      animations: 'disabled',
      mask: [workspace.locator('canvas')],
    });
  });
});