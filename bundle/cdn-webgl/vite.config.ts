import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const stubs = resolve(__dirname, 'src/stubs');

export default defineConfig({
  resolve: {
    alias: {
      '@coderyo/renderer-lite': resolve(stubs, 'renderer-lite-stub.ts'),
      'lightweight-charts': resolve(stubs, 'lightweight-charts-stub.ts'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/entry-webgl.ts'),
      name: 'TradView',
      formats: ['umd'],
      fileName: () => 'tradview-webgl.min.js',
    },
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: { globals: {} },
    },
  },
});