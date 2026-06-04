import type { ResolvedLayoutFeatures } from '../layout-features.js';
import type { LayerController } from './layer-controller.js';
import type { LayerNode } from './types.js';

type ShellFeatureKey = keyof Pick<
  ResolvedLayoutFeatures,
  | 'showTopBar'
  | 'showLeftToolbar'
  | 'showBottomToolbar'
  | 'showStatusBar'
  | 'showPropertiesPanel'
  | 'showCrosshairLegend'
>;

const SHELL_FEATURE_KEYS: ShellFeatureKey[] = [
  'showTopBar',
  'showLeftToolbar',
  'showBottomToolbar',
  'showStatusBar',
  'showPropertiesPanel',
  'showCrosshairLegend',
];

function shellLayerMatchesFeature(layer: LayerNode, feature: ShellFeatureKey): boolean {
  switch (feature) {
    case 'showTopBar':
      return layer.type === 'shell.topBar' || layer.widgetKey === 'topBar';
    case 'showLeftToolbar':
      return layer.type === 'shell.leftToolbar' || layer.widgetKey === 'leftToolbar';
    case 'showBottomToolbar':
      return layer.type === 'shell.bottomToolbar' || layer.widgetKey === 'bottomToolbar';
    case 'showStatusBar':
      return layer.type === 'shell.statusBar' || layer.widgetKey === 'statusBar';
    case 'showPropertiesPanel':
      return layer.type === 'shell.propertiesPanel' || layer.widgetKey === 'propertiesPanel';
    case 'showCrosshairLegend':
      return (
        layer.type === 'overlay.crosshairLegend' || layer.widgetKey === 'crosshairLegend'
      );
    default:
      return false;
  }
}

/** Map `LayoutFeatures` toggles to compositor layer.visible on the active page. */
export function syncCompositorShellVisibilityFromFeatures(
  controller: LayerController,
  features: ResolvedLayoutFeatures,
): void {
  const pageLayers = controller.getLayersForActivePage();
  for (const feature of SHELL_FEATURE_KEYS) {
    const visible = features[feature];
    for (const layer of pageLayers) {
      if (shellLayerMatchesFeature(layer, feature)) {
        controller.setLayerVisible(layer.id, visible);
      }
    }
  }
}