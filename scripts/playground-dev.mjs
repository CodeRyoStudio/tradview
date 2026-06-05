/**
 * Playground dev: build workspace deps, mock gateway, then Vite.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const playgroundDir = path.join(root, 'apps', 'playground');
const isWin = process.platform === 'win32';
const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';
const MOCK_PORT = Number(process.env.MOCK_PORT ?? '4010');
const MOCK_HOST = process.env.MOCK_HOST ?? '127.0.0.1';
const MOCK_BASE = `http://${MOCK_HOST}:${MOCK_PORT}`;
const children = [];

async function mockGatewayReady() {
  try {
    const res = await fetch(`${MOCK_BASE}/api/v1/capabilities`, {
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForMockGateway(maxMs = 12_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    if (await mockGatewayReady()) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function run(args, cwd = root) {
  return new Promise((resolve, reject) => {
    const child = spawn(pnpm, args, { cwd, stdio: 'inherit', shell: isWin });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    children.push(child);
  });
}

function runDetached(args, cwd = root) {
  const child = spawn(pnpm, args, { cwd, stdio: 'inherit', shell: isWin });
  child.on('error', (err) => console.error('[playground-dev]', err));
  children.push(child);
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  console.log('[playground-dev] Building workspace packages…');
  await run(['--filter', '@coderyo/playground', 'run', 'predev']);

  if (await mockGatewayReady()) {
    console.log(`[playground-dev] Mock gateway already up → ${MOCK_BASE}`);
  } else {
    console.log(`[playground-dev] Starting mock gateway → ${MOCK_BASE}`);
    runDetached(['dev:mock']);
    const ready = await waitForMockGateway();
    if (!ready) {
      throw new Error(
        `Mock gateway did not become ready on ${MOCK_BASE} (port in use or dev:mock crashed — see logs above)`,
      );
    }
  }

  console.log('[playground-dev] Vite → http://127.0.0.1:5173 (proxies /api and /ws to mock)');
  await run(['--filter', '@coderyo/playground', 'run', 'dev:vite-only', '--', '--host', '127.0.0.1', '--port', '5173'], playgroundDir);
} catch (err) {
  console.error('[playground-dev] Failed:', err);
  shutdown(1);
}