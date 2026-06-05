/** Stub for CDN WebGL bundle — lite/LWC path is not shipped in `tradview-webgl.min.js`. */
export type ChartPaneId = 'main' | 'volume' | 'indicator';
export type ChartVisibleRange = { fromMs: number; toMs: number };
export type CrosshairPayload = {
  time: number;
  price: number | null;
  ohlcv: { o: number; h: number; l: number; c: number; v?: number } | null;
};
export type PinePlotLine = { id: string; values: (number | null)[]; color?: string };

export interface BarLike {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export class PaneOrchestrator {
  constructor() {
    throw new Error(
      'renderer-lite is not included in tradview-webgl.min.js; use features.renderer: "webgl"',
    );
  }
}

/** No-op stub so `setSmoothPriceUpdate` works on webgl CDN without LWC animator. */
export class BarSmoothAnimator {
  constructor(
    _durationMs: number,
    _onFrame: (bar: BarLike) => void,
  ) {}

  setDuration(_ms: number): void {}

  animateTo(_target: BarLike, _from?: BarLike): void {}

  cancel(): void {}
}

export function compensatePrependOnRegistry(): void {
  throw new Error('compensatePrependOnRegistry requires renderer-lite');
}

export const computePrependSliceDeltaForViewport = (): number => 0;
export const detectIndicatorBarMutation = (): 'full' => 'full';