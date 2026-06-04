import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    deps: {
      optimizer: {
        ssr: {
          include: ['@coderyo/renderer-lite', '@coderyo/indicators'],
        },
      },
    },
  },
});