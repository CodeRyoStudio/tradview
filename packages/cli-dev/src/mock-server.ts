import { startMockGateway } from '@coderyo/data/mock';

const port = Number(process.env.MOCK_PORT ?? '4010');
const host = process.env.MOCK_HOST ?? '127.0.0.1';

let gateway: Awaited<ReturnType<typeof startMockGateway>>;
try {
  gateway = await startMockGateway({ port, host });
} catch (err) {
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : '';
  if (code === 'EADDRINUSE') {
    console.error(`[tradview-mock] Port ${port} is already in use (${host}:${port}).`);
    console.error('[tradview-mock] Another mock gateway is probably still running.');
    console.error('[tradview-mock] Fix: close the other terminal, or on Windows:');
    console.error(`[tradview-mock]   netstat -ano | findstr :${port}`);
    console.error('[tradview-mock]   taskkill /PID <pid> /F');
    console.error(`[tradview-mock] Or use a different port: MOCK_PORT=${port + 1} pnpm dev:mock`);
    console.error('[tradview-mock] (and point Vite proxy in apps/playground/vite.config.ts to that port)');
  } else {
    console.error('[tradview-mock] Failed to start:', err);
  }
  process.exit(1);
}

console.log('[tradview-mock] REST:', gateway.restBaseUrl);
console.log('[tradview-mock] WS:  ', gateway.wsUrl);
console.log('[tradview-mock] Press Ctrl+C to stop');

process.on('SIGINT', async () => {
  await gateway.close();
  process.exit(0);
});