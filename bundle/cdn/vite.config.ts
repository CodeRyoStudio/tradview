import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/entry.ts'),
      name: 'TradView',
      formats: ['umd'],
      fileName: () => 'tradview.min.js',
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: { globals: {} },
    },
  },
});