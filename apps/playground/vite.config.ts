import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:4010', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:4010', ws: true },
    },
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
    proxy: {
      '/api': { target: 'http://127.0.0.1:4010', changeOrigin: true },
      '/ws': { target: 'ws://127.0.0.1:4010', ws: true },
    },
  },
  optimizeDeps: {
    include: ['lightweight-charts'],
  },
});