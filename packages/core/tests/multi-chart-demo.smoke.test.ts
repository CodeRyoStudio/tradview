import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const demoTs = join(repoRoot, 'apps/playground/src/multi-chart-demo.ts');
const demoHtml = join(repoRoot, 'apps/playground/multi-chart.html');

describe('multi-chart playground demo smoke (V2-MC3)', () => {
  it('demo module wires ChartWorkspace + workspace slots', () => {
    expect(existsSync(demoTs)).toBe(true);
    const src = readFileSync(demoTs, 'utf8');
    expect(src).toContain('ChartWorkspace');
    expect(src).toContain('createWorkspaceChartSlots');
    expect(src).toContain('createDemoChartOptions');
    expect(src).toContain("setLinkGroup");
    expect(src).toContain('crosshair:');
    expect(src).toContain('sync-crosshair');
    expect(src).toContain('chart-a');
    expect(src).toContain('chart-b');
  });

  it('multi-chart.html loads demo entry', () => {
    expect(existsSync(demoHtml)).toBe(true);
    const html = readFileSync(demoHtml, 'utf8');
    expect(html).toContain('multi-chart-demo.ts');
    expect(html).toContain('id="workspace"');
    expect(html).toContain('sync-crosshair');
  });
});