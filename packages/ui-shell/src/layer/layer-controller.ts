import { isChartPaneLayerType, paneIdFromWidgetKey } from './chart-pane-mount.js';
import { syncOverlayLayersToMain } from './overlay-mount.js';
import { clampFrame, cloneLayoutPreset } from './normalize.js';
import {
  getLayersBoundingBox,
  moveLayerFrames,
  resizeGroupFrames,
} from './group-utils.js';
import type { BindGroup, LayerFrame, LayoutPreset } from './types.js';

/** @public Mutable controller for LayoutPreset v2 (layers, groups, pane focus). */
export class LayerController {
  private preset: LayoutPreset;
  private readonly listeners = new Set<() => void>();
  private readonly focusListeners = new Set<() => void>();
  private interactionDepth = 0;
  private pageIdSeq = 0;
  activePageId: string;
  /** P2: active chart pane layer (click-to-focus). */
  focusedPaneLayerId: string | null = null;

  constructor(initial: LayoutPreset) {
    this.preset = cloneLayoutPreset(initial);
    this.activePageId = this.preset.pages[0]?.id ?? 'page-1';
  }

  getPreset(): LayoutPreset {
    return cloneLayoutPreset(this.preset);
  }

  /** True while pointer drag/resize/marquee is active — blocks setPreset. */
  isInteracting(): boolean {
    return this.interactionDepth > 0;
  }

  beginInteraction(): void {
    this.interactionDepth++;
  }

  endInteraction(): void {
    this.interactionDepth = Math.max(0, this.interactionDepth - 1);
  }

  setPreset(next: LayoutPreset): boolean {
    if (this.isInteracting()) return false;
    this.preset = cloneLayoutPreset(next);
    if (!this.preset.pages.some((p) => p.id === this.activePageId)) {
      this.activePageId = this.preset.pages[0]?.id ?? 'page-1';
    }
    this.emit();
    return true;
  }

  getLayersForActivePage(): LayoutPreset['layers'] {
    return this.preset.layers
      .filter((l) => l.pageId === this.activePageId)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  getFocusedPaneLayerId(): string | null {
    return this.focusedPaneLayerId;
  }

  getFocusedPaneId(): 'main' | 'volume' | 'indicator' | null {
    const layer = this.focusedPaneLayerId
      ? this.getLayer(this.focusedPaneLayerId)
      : undefined;
    return layer ? paneIdFromWidgetKey(layer.widgetKey) : null;
  }

  /** Raise z-index among chart panes only; does not rebuild compositor DOM. */
  focusChartPane(layerId: string): void {
    const layer = this.getLayer(layerId);
    if (!layer || layer.pageId !== this.activePageId || !isChartPaneLayerType(layer.type)) {
      return;
    }
    if (this.focusedPaneLayerId === layerId) return;
    this.focusedPaneLayerId = layerId;
    const chartLayers = this.getLayersForActivePage().filter((l) =>
      isChartPaneLayerType(l.type),
    );
    const maxZ = Math.max(...chartLayers.map((l) => l.zIndex), layer.zIndex);
    const FOCUS_Z_CAP = 500;
    if (layer.zIndex < maxZ) layer.zIndex = Math.min(maxZ + 1, FOCUS_Z_CAP);
    this.notifyFocus();
  }

  subscribeFocus(listener: () => void): () => void {
    this.focusListeners.add(listener);
    return () => this.focusListeners.delete(listener);
  }

  private notifyFocus(): void {
    for (const fn of this.focusListeners) fn();
  }

  private afterChartMainFrameChange(pageIds?: Iterable<string>): void {
    const ids = pageIds
      ? [...new Set(pageIds)]
      : [...new Set(this.preset.layers.map((l) => l.pageId))];
    for (const pageId of ids) {
      syncOverlayLayersToMain(this.preset.layers, pageId);
    }
  }

  setActivePage(pageId: string): boolean {
    if (!this.preset.pages.some((p) => p.id === pageId)) return false;
    if (this.activePageId === pageId) return true;
    this.activePageId = pageId;
    this.focusedPaneLayerId = null;
    this.emit();
    this.notifyFocus();
    return true;
  }

  addPage(title?: string): string {
    const suffix =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${++this.pageIdSeq}`;
    const id = `page-${suffix}`;
    const pageTitle = title?.trim() || `Page ${this.preset.pages.length + 1}`;
    this.preset.pages.push({ id, title: pageTitle });
    const templatePageId = this.activePageId;
    const templateLayers = this.preset.layers.filter((l) => l.pageId === templatePageId);
    const maxZ = Math.max(-1, ...this.preset.layers.map((l) => l.zIndex));
    let z = maxZ + 1;
    for (const tpl of templateLayers) {
      this.preset.layers.push({
        ...tpl,
        id: `${tpl.id}-${id}`,
        pageId: id,
        frame: { ...tpl.frame },
        zIndex: z++,
        groupId: undefined,
      });
    }
    this.activePageId = id;
    this.focusedPaneLayerId = null;
    this.emit();
    return id;
  }

  renamePage(pageId: string, title: string): boolean {
    const page = this.preset.pages.find((p) => p.id === pageId);
    if (!page) return false;
    const trimmed = title.trim();
    if (!trimmed) return false;
    page.title = trimmed;
    this.emit();
    return true;
  }

  removePage(pageId: string): boolean {
    if (this.preset.pages.length <= 1) return false;
    const idx = this.preset.pages.findIndex((p) => p.id === pageId);
    if (idx < 0) return false;
    this.preset.pages.splice(idx, 1);
    this.preset.layers = this.preset.layers.filter((l) => l.pageId !== pageId);
    for (const g of [...this.preset.groups]) {
      g.layerIds = g.layerIds.filter((lid) => this.getLayer(lid)?.pageId !== pageId);
      if (g.layerIds.length === 0) {
        this.preset.groups = this.preset.groups.filter((x) => x.id !== g.id);
      }
    }
    if (this.activePageId === pageId) {
      const nextPage = this.preset.pages[idx] ?? this.preset.pages[idx - 1];
      this.activePageId = nextPage?.id ?? this.preset.pages[0]!.id;
      this.focusedPaneLayerId = null;
    }
    this.emit();
    return true;
  }

  getLayer(layerId: string) {
    return this.preset.layers.find((l) => l.id === layerId);
  }

  /**
   * @public Set time-scale sync group for a chart pane layer (`''` clears → independent).
   */
  setLayerSyncGroup(layerId: string, groupId: string | null | undefined): boolean {
    const layer = this.getLayer(layerId);
    if (!layer || !isChartPaneLayerType(layer.type)) return false;
    const trimmed = groupId == null ? '' : String(groupId).trim();
    layer.syncTimeScaleGroupId = trimmed.length > 0 ? trimmed : undefined;
    this.emit();
    return true;
  }

  getGroup(groupId: string): BindGroup | undefined {
    return this.preset.groups.find((g) => g.id === groupId);
  }

  /** Layer ids that move/resize together (group members or singleton). */
  getTransformLayerIds(layerId: string): string[] {
    const layer = this.getLayer(layerId);
    if (!layer?.groupId) return [layerId];
    const group = this.getGroup(layer.groupId);
    if (!group || group.layerIds.length === 0) return [layerId];
    return group.layerIds.filter((id) => {
      const l = this.getLayer(id);
      return l && l.pageId === this.activePageId && !l.locked;
    });
  }

  getGroupMemberLayers(groupId: string): LayoutPreset['layers'] {
    const group = this.getGroup(groupId);
    if (!group) return [];
    return group.layerIds
      .map((id) => this.getLayer(id))
      .filter((l): l is NonNullable<typeof l> => !!l && l.pageId === this.activePageId);
  }

  setLayerFrame(layerId: string, frame: LayerFrame): void {
    const ids = this.getTransformLayerIds(layerId);
    if (ids.length === 1) {
      const layer = this.getLayer(layerId);
      if (!layer) return;
      layer.frame = clampFrame(frame);
      if (layer.type === 'overlay.drawing') {
        const main = this.preset.layers.find(
          (l) => l.type === 'chart.main' && l.pageId === layer.pageId,
        );
        if (main) main.frame = clampFrame(frame);
      }
      if (layer.type === 'chart.main' || layer.type === 'overlay.drawing') {
        this.afterChartMainFrameChange([layer.pageId]);
      }
      this.emit();
      return;
    }
    const members = ids.map((id) => this.getLayer(id)!).filter(Boolean);
    const oldBbox = getLayersBoundingBox(members);
    if (!oldBbox) return;
    const target = frame;
    const newFrames = resizeGroupFrames(members, oldBbox, target);
    members.forEach((m, i) => {
      m.frame = newFrames[i]!;
    });
    if (members.some((m) => m.type === 'chart.main' || m.type === 'overlay.drawing')) {
      this.afterChartMainFrameChange(members.map((m) => m.pageId));
    }
    this.emit();
  }

  private expandTransformIds(layerIds: string[]): string[] {
    const expanded = new Set<string>();
    for (const id of layerIds) {
      for (const tid of this.getTransformLayerIds(id)) expanded.add(tid);
    }
    return [...expanded];
  }

  moveLayers(layerIds: string[], dx: number, dy: number): void {
    const unique = this.expandTransformIds(layerIds);
    const layers = unique.map((id) => this.getLayer(id)).filter(Boolean) as LayoutPreset['layers'];
    if (layers.length === 0) return;
    const frames = moveLayerFrames(
      layers.map((l) => l.frame),
      dx,
      dy,
    );
    layers.forEach((l, i) => {
      l.frame = frames[i]!;
    });
    if (
      layers.some((l) => l.type === 'chart.main' || l.type === 'overlay.drawing')
    ) {
      this.afterChartMainFrameChange(layers.map((l) => l.pageId));
    }
    this.emit();
  }

  resizeLayersFromBbox(layerIds: string[], newBbox: LayerFrame): void {
    const unique = this.expandTransformIds(layerIds);
    const members = unique
      .map((id) => this.getLayer(id))
      .filter((l): l is NonNullable<typeof l> => !!l);
    if (members.length === 0) return;
    if (members.length === 1) {
      members[0]!.frame = clampFrame(newBbox);
      if (
        members[0]!.type === 'chart.main' ||
        members[0]!.type === 'overlay.drawing'
      ) {
        this.afterChartMainFrameChange([members[0]!.pageId]);
      }
      this.emit();
      return;
    }
    const oldBbox = getLayersBoundingBox(members);
    if (!oldBbox) return;
    const newFrames = resizeGroupFrames(members, oldBbox, newBbox);
    members.forEach((m, i) => {
      m.frame = newFrames[i]!;
    });
    if (members.some((m) => m.type === 'chart.main' || m.type === 'overlay.drawing')) {
      this.afterChartMainFrameChange(members.map((m) => m.pageId));
    }
    this.emit();
  }

  setLayerVisible(layerId: string, visible: boolean): void {
    const ids = this.syncGroupLayerIds(layerId);
    for (const id of ids) {
      const layer = this.getLayer(id);
      if (layer) layer.visible = visible;
    }
    this.emit();
  }

  setLayerLocked(layerId: string, locked: boolean): void {
    const ids = this.syncGroupLayerIds(layerId);
    for (const id of ids) {
      const layer = this.getLayer(id);
      if (layer) layer.locked = locked;
    }
    this.emit();
  }

  private syncGroupLayerIds(layerId: string): string[] {
    const layer = this.getLayer(layerId);
    if (!layer?.groupId) return [layerId];
    const group = this.getGroup(layer.groupId);
    if (!group?.layerIds.length) return [layerId];
    const onPage = group.layerIds.filter((id) => {
      const l = this.getLayer(id);
      return l && l.pageId === this.activePageId;
    });
    return onPage.length > 0 ? onPage : [layerId];
  }

  bumpZIndex(layerId: string, delta: 1 | -1): void {
    const ordered = this.getLayersForActivePage();
    const idx = ordered.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    const swap = idx + delta;
    if (swap < 0 || swap >= ordered.length) return;
    const a = ordered[idx]!;
    const b = ordered[swap]!;
    const tz = a.zIndex;
    a.zIndex = b.zIndex;
    b.zIndex = tz;
    this.preset.layers.sort((x, y) => x.zIndex - y.zIndex);
    this.preset.layers.forEach((l, i) => {
      l.zIndex = i;
    });
    this.emit();
  }

  reorderLayers(orderedIds: string[]): void {
    const pageLayers = this.preset.layers.filter((l) => l.pageId === this.activePageId);
    const byId = new Map(pageLayers.map((l) => [l.id, l]));
    let z = 0;
    for (const id of orderedIds) {
      const layer = byId.get(id);
      if (layer) layer.zIndex = z++;
    }
    for (const layer of pageLayers) {
      if (!orderedIds.includes(layer.id)) layer.zIndex = z++;
    }
    this.preset.layers.sort((a, b) => a.zIndex - b.zIndex);
    this.emit();
  }

  createBindGroup(layerIds: string[], name?: string): string | null {
    const unique = [...new Set(layerIds)].filter((id) => {
      const l = this.getLayer(id);
      return l && l.pageId === this.activePageId;
    });
    if (unique.length < 2) return null;

    for (const g of this.preset.groups) {
      for (const id of unique) {
        const idx = g.layerIds.indexOf(id);
        if (idx >= 0) g.layerIds.splice(idx, 1);
      }
      if (g.layerIds.length === 0) {
        this.preset.groups = this.preset.groups.filter((x) => x.id !== g.id);
      }
    }

    for (const id of unique) {
      const layer = this.getLayer(id);
      if (layer) delete layer.groupId;
    }

    const groupId = `group-${Date.now()}`;
    const group: BindGroup = { id: groupId, name, layerIds: unique };
    this.preset.groups.push(group);
    for (const id of unique) {
      const layer = this.getLayer(id);
      if (layer) layer.groupId = groupId;
    }
    this.emit();
    return groupId;
  }

  dissolveGroup(groupId: string): void {
    const group = this.getGroup(groupId);
    if (!group) return;
    for (const id of group.layerIds) {
      const layer = this.getLayer(id);
      if (layer?.groupId === groupId) delete layer.groupId;
    }
    this.preset.groups = this.preset.groups.filter((g) => g.id !== groupId);
    this.emit();
  }

  removeLayerFromGroup(layerId: string): void {
    const layer = this.getLayer(layerId);
    if (!layer?.groupId) return;
    const groupId = layer.groupId;
    delete layer.groupId;
    const group = this.getGroup(groupId);
    if (!group) return;
    group.layerIds = group.layerIds.filter((id) => id !== layerId);
    if (group.layerIds.length === 0) {
      this.preset.groups = this.preset.groups.filter((g) => g.id !== groupId);
    }
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }
}