import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/chart-workspace.test.ts', 'happy-dom'],
      ['tests/workspace-bridge.test.ts', 'happy-dom'],
      ['tests/chart-controller.webgl.test.ts', 'happy-dom'],
    ],
  },
});