export * from './events.js';
export * from './schema3-types.js';
export * from './schema3-wire.js';

export type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';

export interface BridgeEvent {
  type: string;
  payload?: unknown;
}

export interface BridgeInbound {
  type: string;
  payload?: unknown;
}

export interface BridgeAdapterOptions {
  target?: Window;
  /** `postMessage` targetOrigin (default: current `location.origin` in browser). */
  origin?: string;
  /**
   * Inbound `message` origins allowed (default: `[origin]` when origin is set).
   * Dev-only escape hatch: `allowAnyInboundOrigin: true` (logs once).
   */
  allowInboundOrigins?: string[];
  allowAnyInboundOrigin?: boolean;
}

function resolveDefaultOrigin(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
    return location.origin;
  }
  return 'null';
}

export function createDefaultBridge(opts: BridgeAdapterOptions = {}): BridgeAdapter {
  return new BridgeAdapter(opts);
}

export class BridgeAdapter {
  private readonly target: Window;
  private readonly postOrigin: string;
  private readonly inboundOrigins: Set<string> | null;
  private listeners = new Set<(msg: BridgeInbound) => void>();

  constructor(opts: BridgeAdapterOptions) {
    this.target = opts.target ?? window.parent;
    this.postOrigin = resolveDefaultOrigin(opts.origin);

    if (opts.allowAnyInboundOrigin) {
      this.inboundOrigins = null;
      if (typeof console !== 'undefined') {
        console.warn(
          '[@coderyo/bridge] allowAnyInboundOrigin=true — dev only; do not use in production embeds',
        );
      }
    } else {
      const list = opts.allowInboundOrigins ?? [this.postOrigin];
      this.inboundOrigins = new Set(list.filter((o) => o && o !== '*'));
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('message', (ev) => {
        if (this.inboundOrigins && !this.inboundOrigins.has(ev.origin)) return;
        const data = ev.data as BridgeInbound;
        if (data?.type?.startsWith('host.')) {
          for (const l of this.listeners) l(data);
        }
      });
    }
  }

  post(event: BridgeEvent): void {
    this.target.postMessage(event, this.postOrigin);
  }

  onMessage(handler: (msg: BridgeInbound) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
}