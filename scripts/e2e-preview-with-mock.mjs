#!/usr/bin/env node
/**
 * E2E helper: mock gateway (4010) + playground preview (5173).
 * Used by Playwright webServer in CI and local snapshot updates.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';
const children = [];

function run(args, label) {
  const child = spawn(pnpm, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: process.env,
  });
  child.on('error', (err) => console.error(`[e2e-server] ${label}:`, err));
  children.push(child);
  return child;
}

async function waitFor(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`[e2e-server] timeout waiting for ${url}`);
}

function shutdown() {
  for (const c of children) {
    if (!c.killed) c.kill('SIGTERM');
  }
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

run(['dev:mock'], 'mock');
await waitFor('http://127.0.0.1:4010/api/v1/capabilities');
run(
  ['--filter', '@coderyo/playground', 'exec', 'vite', 'preview', '--host', '127.0.0.1', '--port', '5173', '--strictPort'],
  'preview',
);
await waitFor('http://127.0.0.1:5173/workspace.html');
console.log('[e2e-server] mock + preview ready on http://127.0.0.1:5173');