export * from './keyboard.js';

/** Interaction handlers (pan/zoom/crosshair) — wired via LWC in PR-08+ */
export interface InteractionOptions {
  enableCrosshair?: boolean;
  enablePanZoom?: boolean;
}

export function createInteraction(_opts: InteractionOptions = {}): { destroy: () => void } {
  return { destroy: () => {} };
}