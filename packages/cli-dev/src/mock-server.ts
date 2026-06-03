import { startMockGateway } from '@coderyo/data/mock';

const port = Number(process.env.MOCK_PORT ?? '4010');
const host = process.env.MOCK_HOST ?? '127.0.0.1';

const gateway = await startMockGateway({ port, host });

console.log('[tradview-mock] REST:', gateway.restBaseUrl);
console.log('[tradview-mock] WS:  ', gateway.wsUrl);
console.log('[tradview-mock] Press Ctrl+C to stop');

process.on('SIGINT', async () => {
  await gateway.close();
  process.exit(0);
});