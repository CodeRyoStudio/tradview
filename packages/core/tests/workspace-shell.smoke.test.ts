import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/playground');

describe('workspace-shell Bridge smoke (V2-MC3 / review #11)', () => {
  it('workspace-shell wires ChartWorkspace + origin-scoped bridge', () => {
    const src = readFileSync(join(root, 'src/workspace-shell.ts'), 'utf8');
    expect(src).toContain('ChartWorkspace');
    expect(src).toContain('createDefaultBridge');
    expect(src).toContain('allowInboundOrigins');
    expect(src).toContain('bridge,');
    expect(src).toContain('chart.workspaceReady');
  });

  it('workspace.html is a Vite entry', () => {
    const vite = readFileSync(join(root, 'vite.config.ts'), 'utf8');
    expect(vite).toContain('workspace.html');
  });
});