import { readFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'tradview-proto-text',
      load(id) {
        if (id.endsWith('.proto')) {
          return `export default ${JSON.stringify(readFileSync(id, 'utf8'))};`;
        }
      },
    },
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});