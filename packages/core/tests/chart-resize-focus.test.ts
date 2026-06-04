import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcPath = join(dirname(fileURLToPath(import.meta.url)), '../src/chart-controller.ts');
const chartControllerSrc = readFileSync(srcPath, 'utf8');
const srcLines = chartControllerSrc.split('\n');

function lineContaining(substr: string): string | undefined {
  return srcLines.find((l) => l.includes(substr));
}

function resizeMethodLines(): string[] {
  const start = srcLines.findIndex((l) =>
    l.includes('resize(size?: { width?: number; height?: number }): this'),
  );
  expect(start).toBeGreaterThanOrEqual(0);
  const end = srcLines.findIndex((l, i) => i > start && l.trim() === '}');
  return srcLines.slice(start, end + 1);
}

describe('ChartController resize focus (P2 layered panes)', () => {
  it('resize() method body does not call setResizeFocusPanes(null)', () => {
    const body = resizeMethodLines().join('\n');
    expect(body).not.toContain('setResizeFocusPanes(null)');
    expect(body).toContain('orchestrator.resize()');
  });

  it('ResizeObserver callback clears focus via setResizeFocusPanes only (single resize)', () => {
    const line = lineContaining('resizeObserver = new ResizeObserver');
    expect(line).toBeDefined();
    const start = srcLines.indexOf(line!);
    const block = srcLines.slice(start, start + 8).join('\n');
    expect(block).toContain('setResizeFocusPanes(null)');
    expect(block).not.toContain('orchestrator.resize()');
  });

  it('onPaneResize clears focus via setResizeFocusPanes only (single resize)', () => {
    const line = lineContaining('private readonly onPaneResize');
    expect(line).toBeDefined();
    const start = srcLines.indexOf(line!);
    const block = srcLines.slice(start, start + 8).join('\n');
    expect(block).toContain('setResizeFocusPanes(null)');
    expect(block).not.toContain('orchestrator.resize()');
  });

  it('refreshRender uses resizeAllPanes without clearing focus', () => {
    const line = lineContaining('this.orchestrator.setBars(bars, gaps)');
    expect(line).toBeDefined();
    const idx = srcLines.indexOf(line!);
    const block = srcLines.slice(idx, idx + 6).join('\n');
    expect(block).toContain('resizeAllPanes()');
    expect(block).not.toContain('setResizeFocusPanes(null)');
    expect(block).not.toMatch(/this\.resize\(\)/);
  });

  it('PaneOrchestrator is constructed with listenPaneResizeEvents: false', () => {
    expect(lineContaining('listenPaneResizeEvents: false')).toBeDefined();
  });
});