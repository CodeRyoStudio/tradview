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
const children = [];

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

  console.log('[playground-dev] Mock gateway → http://127.0.0.1:4010');
  runDetached(['dev:mock']);

  await new Promise((r) => setTimeout(r, 1200));

  console.log('[playground-dev] Vite → http://127.0.0.1:5173 (proxies /api and /ws to mock)');
  await run(['--filter', '@coderyo/playground', 'run', 'dev:vite-only', '--', '--host', '127.0.0.1', '--port', '5173'], playgroundDir);
} catch (err) {
  console.error('[playground-dev] Failed:', err);
  shutdown(1);
}