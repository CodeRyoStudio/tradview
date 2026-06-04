import { describe, expect, it } from 'vitest';
import {
  getLayersBoundingBox,
  moveLayerFrames,
  resizeGroupFrames,
} from '../src/layer/group-utils.js';
import { clampFrame } from '../src/layer/normalize.js';
import { LayerController } from '../src/layer/layer-controller.js';
import { cloneLayoutPreset } from '../src/layer/normalize.js';
import { VENDOR_DEFAULT_PRESET } from '../src/layer/default-presets.js';
import type { LayerFrame } from '../src/layer/types.js';

describe('group-utils', () => {
  it('computes union bounding box', () => {
    const bbox = getLayersBoundingBox([
      { frame: { x: 0, y: 0, w: 0.2, h: 0.1 } },
      { frame: { x: 0.1, y: 0.05, w: 0.3, h: 0.2 } },
    ]);
    expect(bbox).toEqual({ x: 0, y: 0, w: 0.4, h: 0.25 });
  });

  it('moveLayerFrames clamps to page bounds', () => {
    const [f] = moveLayerFrames([{ x: 0.95, y: 0.95, w: 0.05, h: 0.05 }], 0.1, 0.1);
    expect(f!.x).toBeLessThanOrEqual(0.95);
    expect(f!.y).toBeLessThanOrEqual(0.95);
  });

  it('resizeGroupFrames scales members proportionally', () => {
    const members = [
      { frame: { x: 0, y: 0, w: 0.1, h: 0.1 } },
      { frame: { x: 0.1, y: 0, w: 0.1, h: 0.1 } },
    ];
    const oldBbox = getLayersBoundingBox(members)!;
    const newBbox: LayerFrame = { x: 0, y: 0, w: 0.4, h: 0.2 };
    const resized = resizeGroupFrames(members, oldBbox, newBbox);
    expect(resized[0]!.w).toBeCloseTo(0.2, 5);
    expect(resized[1]!.x).toBeCloseTo(0.2, 5);
  });

  it('clampFrame enforces minimum size 2%', () => {
    const f = clampFrame({ x: 0, y: 0, w: 0.001, h: 0.001 });
    expect(f.w).toBe(0.02);
    expect(f.h).toBe(0.02);
  });
});

describe('LayerController groups', () => {
  it('creates bind group and syncs visibility', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const layers = ctrl.getLayersForActivePage();
    const a = layers[0]!;
    const b = layers[1]!;
    const gid = ctrl.createBindGroup([a.id, b.id], 'toolbar');
    expect(gid).toBeTruthy();
    expect(ctrl.getLayer(a.id)?.groupId).toBe(gid);
    ctrl.setLayerVisible(a.id, false);
    expect(ctrl.getLayer(b.id)?.visible).toBe(false);
  });

  it('moves grouped layers together', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const left = ctrl.getLayersForActivePage().find((l) => l.widgetKey === 'leftToolbar')!;
    const props = ctrl.getLayersForActivePage().find((l) => l.widgetKey === 'propertiesPanel')!;
    ctrl.createBindGroup([left.id, props.id]);
    const ly0 = left.frame.y;
    const py0 = props.frame.y;
    ctrl.moveLayers([left.id], 0, 0.02);
    expect(ctrl.getLayer(left.id)!.frame.y).toBeCloseTo(ly0 + 0.02, 5);
    expect(ctrl.getLayer(props.id)!.frame.y).toBeCloseTo(py0 + 0.02, 5);
  });

  it('locks grouped layers together', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const [a, b] = ctrl.getLayersForActivePage();
    ctrl.createBindGroup([a!.id, b!.id]);
    ctrl.setLayerLocked(a!.id, true);
    expect(ctrl.getLayer(b!.id)?.locked).toBe(true);
  });

  it('resizeLayersFromBbox clamps single member', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const left = ctrl.getLayersForActivePage().find((l) => l.widgetKey === 'leftToolbar')!;
    ctrl.resizeLayersFromBbox([left.id], { x: 0, y: 0, w: 0.001, h: 0.001 });
    expect(ctrl.getLayer(left.id)!.frame.w).toBe(0.02);
    expect(ctrl.getLayer(left.id)!.frame.h).toBe(0.02);
  });

  it('removeLayerFromGroup keeps other members', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const left = ctrl.getLayersForActivePage().find((l) => l.widgetKey === 'leftToolbar')!;
    const props = ctrl.getLayersForActivePage().find((l) => l.widgetKey === 'propertiesPanel')!;
    const gid = ctrl.createBindGroup([left.id, props.id])!;
    ctrl.removeLayerFromGroup(left.id);
    expect(ctrl.getLayer(left.id)?.groupId).toBeUndefined();
    expect(ctrl.getLayer(props.id)?.groupId).toBe(gid);
  });

  it('dissolves group and clears groupId', () => {
    const ctrl = new LayerController(cloneLayoutPreset(VENDOR_DEFAULT_PRESET));
    const [a, b] = ctrl.getLayersForActivePage();
    const gid = ctrl.createBindGroup([a!.id, b!.id])!;
    ctrl.dissolveGroup(gid);
    expect(ctrl.getLayer(a!.id)?.groupId).toBeUndefined();
    expect(ctrl.getPreset().groups.find((g) => g.id === gid)).toBeUndefined();
  });
});