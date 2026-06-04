import type { LayerController } from './layer-controller.js';

/** Minimal chart surface for layer time-scale sync (matches `IChart.applyTimeScaleSyncFromLayers`). */
export interface LayerTimeScaleSyncChart {
  applyTimeScaleSyncFromLayers(
    layers: Array<{ type: string; pageId?: string; syncTimeScaleGroupId?: string }>,
    pageId?: string,
  ): unknown;
}

export interface BindLayerTimeScaleSyncOptions {
  /** Called after each sync apply (e.g. `requestAnimationFrame(chart.resize)`). */
  onSync?: () => void;
}

/**
 * @public Wire `IChart.applyTimeScaleSyncFromLayers` to `LayerController` preset mutations.
 * Applies immediately and on `controller.subscribe` (page switch, sync group, layer edits).
 * Returns unsubscribe — call after `mountLayerCompositor` + `createChart`.
 */
export function bindLayerTimeScaleSync(
  chart: LayerTimeScaleSyncChart,
  controller: LayerController,
  options?: BindLayerTimeScaleSyncOptions,
): () => void {
  const apply = () => {
    chart.applyTimeScaleSyncFromLayers(
      controller.getPreset().layers,
      controller.activePageId,
    );
    options?.onSync?.();
  };
  apply();
  return controller.subscribe(apply);
}