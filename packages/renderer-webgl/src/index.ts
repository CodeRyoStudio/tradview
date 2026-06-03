export const PACKAGE_NAME = '@tradview/renderer-webgl' as const;

export interface WebGlRendererOptions {
  enabled?: boolean;
}

/** v2 WebGL renderer stub — enable via feature flag only (PR-22). */
export function createWebGlRenderer(opts: WebGlRendererOptions = {}): {
  enabled: boolean;
  render: () => void;
  destroy: () => void;
} {
  const enabled = opts.enabled ?? false;
  return {
    enabled,
    render: () => {
      if (!enabled) return;
    },
    destroy: () => {},
  };
}