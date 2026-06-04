import { describe, expect, it } from 'vitest';
import { LayerController } from '../src/layer/layer-controller.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';

describe('LayerController locked group transform', () => {
  it('getTransformLayerIds excludes locked group members', () => {
    const preset = cloneLayoutPreset(VENDOR_DEFAULT_PRESET);
    const main = preset.layers.find((l) => l.widgetKey === 'chartMain')!;
    const volume = preset.layers.find((l) => l.widgetKey === 'chartVolume')!;
    main.groupId = 'g1';
    volume.groupId = 'g1';
    main.locked = true;
    volume.locked = false;
    preset.groups = [{ id: 'g1', layerIds: [main.id, volume.id] }];

    const ctrl = new LayerController(preset);
    const ids = ctrl.getTransformLayerIds(volume.id);
    expect(ids).toEqual([volume.id]);
    expect(ids).not.toContain(main.id);
  });
});