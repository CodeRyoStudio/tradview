export * from './events.js';

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
  origin?: string;
}

export function createDefaultBridge(opts: BridgeAdapterOptions = {}): BridgeAdapter {
  return new BridgeAdapter(opts);
}

export class BridgeAdapter {
  private readonly target: Window;
  private readonly origin: string;
  private listeners = new Set<(msg: BridgeInbound) => void>();

  constructor(opts: BridgeAdapterOptions) {
    this.target = opts.target ?? window.parent;
    this.origin = opts.origin ?? '*';
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (ev) => {
        if (opts.origin && opts.origin !== '*' && ev.origin !== opts.origin) return;
        const data = ev.data as BridgeInbound;
        if (data?.type?.startsWith('host.')) {
          for (const l of this.listeners) l(data);
        }
      });
    }
  }

  post(event: BridgeEvent): void {
    this.target.postMessage(event, this.origin);
  }

  onMessage(handler: (msg: BridgeInbound) => void): () => void {
    this.listeners.add(handler);
    return () => this.listeners.delete(handler);
  }
}