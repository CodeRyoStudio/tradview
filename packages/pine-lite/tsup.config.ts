import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/index.ts', 'src/pine.worker.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
});
