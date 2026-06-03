/**
 * One-command local demo: mock gateway + TradView playground.
 * Usage: node scripts/demo.mjs [--mode=dev|preview]
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv.find((a) => a.startsWith('--mode='))?.split('=')[1] ?? 'dev';
const isWin = process.platform === 'win32';
const pnpm = isWin ? 'pnpm.cmd' : 'pnpm';

const children = [];

function run(label, args, extraEnv = {}) {
  const child = spawn(pnpm, args, {
    cwd: root,
    stdio: 'inherit',
    shell: isWin,
    env: { ...process.env, ...extraEnv },
  });
  child.on('error', (err) => console.error(`[demo] ${label} failed:`, err));
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const c of children) {
    if (!c.killed) c.kill('SIGTERM');
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[demo] Starting mock gateway on http://127.0.0.1:4010 …');
run('mock', ['dev:mock']);

if (mode === 'preview') {
  console.log('[demo] Building packages + playground …');
  const build = spawn(pnpm, ['build'], { cwd: root, stdio: 'inherit', shell: isWin });
  build.on('close', (code) => {
    if (code !== 0) shutdown(code ?? 1);
    spawn(pnpm, ['--filter', '@tradview/playground', 'build'], {
      cwd: root,
      stdio: 'inherit',
      shell: isWin,
    }).on('close', (c2) => {
      if (c2 !== 0) shutdown(c2 ?? 1);
      console.log('[demo] Preview at http://127.0.0.1:4173 (proxy → mock)');
      setTimeout(() => run('preview', ['--filter', '@tradview/playground', 'preview', '--host', '127.0.0.1', '--port', '4173']), 800);
    });
  });
} else {
  setTimeout(() => {
    console.log('[demo] Dev UI at http://127.0.0.1:5173 (proxy → mock)');
    run('playground', ['--filter', '@tradview/playground', 'dev', '--host', '127.0.0.1', '--port', '5173']);
  }, 1500);
}