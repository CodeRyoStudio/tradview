const STORAGE_VERSION = 1;

export interface DrawingRecord {
  id: string;
  type: string;
  symbol: string;
  interval: string;
  points: Array<{ t: number; price: number }>;
  meta?: Record<string, unknown>;
}

export interface DrawingStore {
  version: number;
  drawings: DrawingRecord[];
}

export function storageKey(chartId: string, symbol: string, interval: string): string {
  return `tradview:drawings:v${STORAGE_VERSION}:${chartId}:${symbol}:${interval}`;
}

export function loadDrawings(key: string): DrawingStore {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { version: STORAGE_VERSION, drawings: [] };
    const parsed = JSON.parse(raw) as DrawingStore;
    if (parsed.version !== STORAGE_VERSION) return { version: STORAGE_VERSION, drawings: [] };
    return parsed;
  } catch {
    return { version: STORAGE_VERSION, drawings: [] };
  }
}

export function saveDrawings(key: string, store: DrawingStore): void {
  localStorage.setItem(key, JSON.stringify(store));
}