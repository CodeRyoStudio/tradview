import { DataError } from '../errors.js';
import {
  decodeWsProtobufEnvelope,
  encodeWsProtobufEnvelope,
  WS_SUBPROTOCOL_JSON,
  WS_SUBPROTOCOL_PROTOBUF,
} from '../protocol/ws-protobuf-codec.js';
import type { Envelope } from '../types.js';
import type {
  AuthHooks,
  ConnectionState,
  RealtimeHandlers,
  SubscribeParams,
  Subscription,
  WsEncoding,
} from './types.js';
import { nextClientId } from './id.js';
import { computeBackoffDelay, sleep } from './reconnect.js';
import type { Bar } from '../types.js';
import type { Interval } from '../interval.js';

export interface WsClientOptions {
  wsUrl: string;
  auth?: AuthHooks;
  protocolVersion?: string;
  /** WS wire encoding (default `json`). */
  encoding?: WsEncoding;
  subscribeAckTimeoutMs?: number;
  subscribeMaxRetries?: number;
  reconnect?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
  };
  pingIntervalMs?: number;
}

interface PendingSubscribe {
  params: SubscribeParams;
  handlers: RealtimeHandlers;
  clientRef: string;
  resolve: (sub: Subscription) => void;
  reject: (err: Error) => void;
  retries: number;
}

interface ActiveSubscription extends Subscription {
  handlers: RealtimeHandlers;
}

const WS_OPEN = 1;

type WsLike = {
  readonly readyState: number;
  send(data: string | Uint8Array | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: Event) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
};

function toMessageBuffer(data: unknown): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) {
    const view = data as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  if (typeof data === 'string') return new TextEncoder().encode(data);
  const Buf = (globalThis as typeof globalThis & { Buffer?: { isBuffer: (v: unknown) => boolean; from: (v: string, enc: string) => Uint8Array; concat: (parts: Uint8Array[]) => Uint8Array } }).Buffer;
  if (Buf?.isBuffer(data)) return new Uint8Array(data as Uint8Array);
  if (Array.isArray(data) && Buf) return new Uint8Array(Buf.concat(data as Uint8Array[]));
  return new TextEncoder().encode(String(data));
}

function messageDataToUtf8(data: unknown): string {
  if (typeof data === 'string') return data;
  return new TextDecoder().decode(toMessageBuffer(data));
}

type WsRuntime = 'node' | 'browser';

type WsConnection = {
  runtime: WsRuntime;
  socket: WsLike;
};

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && typeof process.versions?.node === 'string';
}

async function openWsConnection(
  url: string,
  protocols: string[],
  headers: Record<string, string>,
): Promise<WsConnection> {
  if (isNodeRuntime()) {
    const { WebSocket: NodeWebSocket } = await import('ws');
    return {
      runtime: 'node',
      socket: new NodeWebSocket(url, protocols, { headers }) as unknown as WsLike,
    };
  }
  if (typeof globalThis.WebSocket === 'function') {
    return {
      runtime: 'browser',
      socket: new globalThis.WebSocket(url, protocols) as unknown as WsLike,
    };
  }
  throw new DataError({
    code: 'CONFIG_ERROR',
    message: 'WebSocket is not available in this environment',
    recoverable: false,
    transport: 'ws',
  });
}

function bindSocketHandlers(
  conn: WsConnection,
  handlers: {
    onOpen: () => void | Promise<void>;
    onMessage: (data: unknown) => void;
    onClose: () => void;
    onError: () => void;
  },
): void {
  if (conn.runtime === 'node') {
    const nodeWs = conn.socket as import('ws').WebSocket;
    nodeWs.on('open', () => void handlers.onOpen());
    nodeWs.on('message', (data) => handlers.onMessage(data));
    nodeWs.on('close', handlers.onClose);
    nodeWs.on('error', handlers.onError);
    return;
  }

  const ws = conn.socket;
  ws.onopen = () => void handlers.onOpen();
  ws.onmessage = (ev) => handlers.onMessage(ev.data);
  ws.onclose = handlers.onClose;
  ws.onerror = handlers.onError;
  if (ws.readyState === WS_OPEN) void handlers.onOpen();
}

export class TradViewWsClient {
  private conn: WsConnection | null = null;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempt = 0;
  private stopped = false;
  private authFailed = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private encoding: WsEncoding;
  private readonly pendingByClientRef = new Map<string, PendingSubscribe>();
  private readonly activeSubs = new Map<string, ActiveSubscription>();
  private readonly pendingRequests = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(private readonly opts: WsClientOptions) {
    this.encoding = opts.encoding ?? 'json';
  }

  get connectionState(): ConnectionState {
    return this.state;
  }

  get wsEncoding(): WsEncoding {
    return this.encoding;
  }

  setEncoding(encoding: WsEncoding): void {
    if (this.encoding === encoding) return;
    this.encoding = encoding;
    if (this.conn?.socket.readyState === WS_OPEN) {
      void this.disconnect().then(() => this.connect());
    }
  }

  async connect(): Promise<void> {
    this.stopped = false;
    this.authFailed = false;
    await this.openSocket();
  }

  async disconnect(): Promise<void> {
    this.stopped = true;
    this.clearPing();
    const conn = this.conn;
    this.conn = null;
    const socket = conn?.socket;
    if (conn?.runtime === 'node' && socket) {
      const nodeWs = socket as import('ws').WebSocket;
      if (nodeWs.readyState === WS_OPEN) {
        await new Promise<void>((resolve) => {
          nodeWs.once('close', () => resolve());
          nodeWs.close();
          setTimeout(resolve, 500);
        });
      } else {
        nodeWs.close();
      }
    } else if (socket && socket.readyState === WS_OPEN) {
      await new Promise<void>((resolve) => {
        const prevClose = socket.onclose;
        socket.onclose = () => {
          prevClose?.();
          resolve();
        };
        socket.close();
        setTimeout(resolve, 500);
      });
    } else if (socket) {
      socket.close();
    }
    this.setState('disconnected');
    this.opts.auth?.onDisconnect?.();
  }

  async subscribe(params: SubscribeParams, handlers: RealtimeHandlers): Promise<Subscription> {
    await this.ensureConnected();

    const clientRef = nextClientId('sub');
    const streamMode = params.streamMode ?? 'bar';
    const channels = params.channels ?? ['bar'];

    return new Promise<Subscription>((resolve, reject) => {
      this.pendingByClientRef.set(clientRef, {
        params,
        handlers,
        clientRef,
        resolve,
        reject,
        retries: 0,
      });
      this.sendSubscribe(clientRef, params.symbol, params.interval, channels, streamMode);
      this.armSubscribeTimeout(clientRef);
    });
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.activeSubs.get(subscriptionId);
    if (!sub) return;

    const id = nextClientId();
    await this.request('unsubscribe', { subscriptionId }, id);
    this.activeSubs.delete(subscriptionId);
  }

  async requestHistory(params: {
    symbol: string;
    interval: Interval;
    from: number;
    to: number;
    limit?: number;
  }): Promise<Bar[]> {
    const id = nextClientId('hist');
    const payload = await this.request<{ bars: Bar[]; hasMore: boolean }>(
      'history.request',
      params,
      id,
    );
    return payload.bars;
  }

  private async ensureConnected(): Promise<void> {
    if (this.state === 'connected' && this.conn?.socket.readyState === WS_OPEN) return;
    if (this.stopped) throw new DataError({ code: 'CONFIG_ERROR', message: 'WS disconnected', recoverable: false, transport: 'ws' });
    await this.connect();
  }

  private wsSubprotocol(): string {
    return this.encoding === 'protobuf' ? WS_SUBPROTOCOL_PROTOBUF : WS_SUBPROTOCOL_JSON;
  }

  private async openSocket(): Promise<void> {
    this.setState(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    const headers = (await this.opts.auth?.getHeaders?.()) ?? {};
    const qp = this.opts.auth?.getQueryParams?.() ?? {};
    let url = this.opts.wsUrl;
    if (Object.keys(qp).length > 0) {
      const u = new URL(url);
      for (const [k, v] of Object.entries(qp)) u.searchParams.set(k, v);
      url = u.toString();
    }

    await new Promise<void>((resolve, reject) => {
      void openWsConnection(url, [this.wsSubprotocol()], headers)
        .then((opened) => {
          this.conn = opened;
          bindSocketHandlers(opened, {
            onOpen: async () => {
              try {
                await this.opts.auth?.onConnect?.('ws');
                await this.sendAuthIfNeeded();
                this.reconnectAttempt = 0;
                this.setState('connected');
                this.startPing();
                await this.resubscribeAll();
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            },
            onMessage: (data) => {
              void this.handleMessage(data);
            },
            onClose: () => {
              this.clearPing();
              if (!this.stopped && !this.authFailed) {
                void this.scheduleReconnect();
              } else if (this.authFailed) {
                this.setState('failed');
              } else {
                this.setState('disconnected');
              }
            },
            onError: () => {
              /* close handler drives reconnect */
            },
          });
        })
        .catch(reject);
    });
  }

  private async sendAuthIfNeeded(): Promise<void> {
    const headers = await this.opts.auth?.getHeaders?.();
    const token = headers?.Authorization ?? headers?.authorization;
    if (!token) return;

    const id = nextClientId('auth');
    await this.request('auth', { token, clientId: 'tradview-client' }, id, 5000);
  }

  private sendSubscribe(
    clientRef: string,
    symbol: string,
    interval: Interval,
    channels: string[],
    streamMode: string,
  ) {
    this.send({
      v: this.opts.protocolVersion ?? '1.0',
      id: clientRef,
      type: 'subscribe',
      ts: Date.now(),
      payload: { symbol, interval, channels, streamMode },
    });
  }

  private armSubscribeTimeout(clientRef: string) {
    const timeout = this.opts.subscribeAckTimeoutMs ?? 10_000;
    setTimeout(() => {
      const pending = this.pendingByClientRef.get(clientRef);
      if (!pending) return;

      const maxRetries = this.opts.subscribeMaxRetries ?? 2;
      if (pending.retries < maxRetries) {
        pending.retries += 1;
        const { params } = pending;
        const channels = params.channels ?? ['bar'];
        this.sendSubscribe(clientRef, params.symbol, params.interval, channels, params.streamMode ?? 'bar');
        this.armSubscribeTimeout(clientRef);
        return;
      }

      this.pendingByClientRef.delete(clientRef);
      const err = new DataError({
        code: 'SUBSCRIBE_TIMEOUT',
        message: 'subscribe.ok not received in time',
        recoverable: true,
        refId: clientRef,
        transport: 'ws',
      });
      pending.handlers.onError?.(err);
      pending.reject(err);
    }, timeout);
  }

  private async resubscribeAll(): Promise<void> {
    const toRestore = [...this.activeSubs.values()];
    this.activeSubs.clear();
    for (const sub of toRestore) {
      const clientRef = nextClientId('sub');
      this.pendingByClientRef.set(clientRef, {
        params: {
          symbol: sub.symbol,
          interval: sub.interval,
          channels: sub.channels,
          streamMode: sub.streamMode,
        },
        handlers: sub.handlers,
        clientRef,
        resolve: () => {},
        reject: () => {},
        retries: 0,
      });
      this.sendSubscribe(clientRef, sub.symbol, sub.interval, sub.channels, sub.streamMode);
    }
  }

  private async scheduleReconnect(): Promise<void> {
    if (this.stopped || this.authFailed) return;

    const maxAttempts = this.opts.reconnect?.maxAttempts ?? Infinity;
    if (this.reconnectAttempt >= maxAttempts) {
      this.setState('failed');
      return;
    }

    const delay = computeBackoffDelay(this.reconnectAttempt, {
      initialDelayMs: this.opts.reconnect?.initialDelayMs ?? 500,
      maxDelayMs: this.opts.reconnect?.maxDelayMs ?? 30_000,
    });
    this.reconnectAttempt += 1;
    this.setState('reconnecting');
    await sleep(delay);
    if (!this.stopped && !this.authFailed) {
      try {
        await this.openSocket();
      } catch {
        void this.scheduleReconnect();
      }
    }
  }

  private async handleAuthFailure(refId?: string): Promise<void> {
    if (!this.opts.auth?.refreshToken) {
      this.authFailed = true;
      this.stopped = true;
      this.setState('failed');
      const err = new DataError({
        code: 'AUTH_FAILED',
        message: 'Authentication failed',
        recoverable: false,
        refId,
        transport: 'ws',
      });
      this.broadcastError(err);
      this.conn?.socket.close();
      return;
    }

    try {
      await this.opts.auth.refreshToken();
      this.conn?.socket.close();
      this.reconnectAttempt = 0;
      await this.openSocket();
    } catch {
      this.authFailed = true;
      this.stopped = true;
      this.setState('failed');
      this.broadcastError(
        new DataError({
          code: 'AUTH_FAILED',
          message: 'refreshToken failed',
          recoverable: false,
          refId,
          transport: 'ws',
        }),
      );
    }
  }

  private async parseIncomingMessage(data: unknown): Promise<Envelope | null> {
    if (this.encoding === 'protobuf') {
      try {
        return await decodeWsProtobufEnvelope(toMessageBuffer(data));
      } catch {
        return null;
      }
    }
    try {
      const text = messageDataToUtf8(data);
      return JSON.parse(text) as Envelope;
    } catch {
      return null;
    }
  }

  private async handleMessage(data: unknown) {
    const msg = await this.parseIncomingMessage(data);
    if (!msg) return;

    if (msg.type === 'pong') return;

    if (msg.type === 'error') {
      const payload = msg.payload as { code?: string; message?: string };
      if (payload.code === 'AUTH_FAILED') {
        void this.handleAuthFailure(msg.id);
        return;
      }
      const err = new DataError({
        code: (payload.code as DataError['code']) ?? 'INTERNAL_ERROR',
        message: payload.message ?? 'WS error',
        recoverable: payload.code === 'RATE_LIMITED',
        refId: msg.id,
        transport: 'ws',
      });
      this.broadcastError(err);
      return;
    }

    if (msg.id && this.pendingRequests.has(msg.id)) {
      const pending = this.pendingRequests.get(msg.id)!;
      this.pendingRequests.delete(msg.id);
      if (msg.type === 'error') {
        pending.reject(new Error((msg.payload as { message?: string }).message ?? 'error'));
      } else {
        pending.resolve(msg.payload);
      }
      return;
    }

    if (msg.type === 'subscribe.ok' && msg.id) {
      const pending = this.pendingByClientRef.get(msg.id);
      if (!pending) return;

      const payload = msg.payload as { subscriptionId: string; symbol: string; interval: Interval };
      const sub: ActiveSubscription = {
        id: payload.subscriptionId,
        clientRef: pending.clientRef,
        symbol: payload.symbol,
        interval: payload.interval,
        channels: pending.params.channels ?? ['bar'],
        streamMode: pending.params.streamMode ?? 'bar',
        handlers: pending.handlers,
      };
      this.activeSubs.set(sub.id, sub);
      this.pendingByClientRef.delete(msg.id);
      pending.resolve(sub);
      return;
    }

    if (msg.type === 'bar') {
      const payload = msg.payload as {
        subscriptionId: string;
        bar: Bar;
        partial?: boolean;
      };
      const sub = this.activeSubs.get(payload.subscriptionId);
      sub?.handlers.onBar?.(payload.bar, {
        partial: payload.partial ?? false,
        subscriptionId: payload.subscriptionId,
      });
      return;
    }

    if (msg.type === 'tick') {
      const payload = msg.payload as {
        subscriptionId: string;
        tick: { t: number; price: number; size: number };
      };
      const sub = this.activeSubs.get(payload.subscriptionId);
      sub?.handlers.onTick?.(payload.tick, { subscriptionId: payload.subscriptionId });
    }
  }

  private async request<T>(type: string, payload: unknown, id: string, timeoutMs = 10_000): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new DataError({
            code: 'SUBSCRIBE_TIMEOUT',
            message: `${type} timeout`,
            recoverable: true,
            refId: id,
            transport: 'ws',
          }),
        );
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve(v as T);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        },
      });

      this.send({
        v: this.opts.protocolVersion ?? '1.0',
        id,
        type,
        ts: Date.now(),
        payload,
      });
    });
  }

  private send(msg: Envelope) {
    const socket = this.conn?.socket;
    if (socket?.readyState !== WS_OPEN) return;
    if (this.encoding === 'protobuf') {
      void encodeWsProtobufEnvelope(msg).then((bytes) => {
        if (this.conn?.socket.readyState === WS_OPEN) this.conn.socket.send(bytes);
      });
      return;
    }
    socket.send(JSON.stringify(msg));
  }

  private startPing() {
    this.clearPing();
    const interval = this.opts.pingIntervalMs ?? 25_000;
    this.pingTimer = setInterval(() => {
      this.send({ v: '1.0', type: 'ping', ts: Date.now(), payload: {} });
    }, interval);
  }

  private clearPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private setState(state: ConnectionState) {
    this.state = state;
    for (const sub of this.activeSubs.values()) {
      sub.handlers.onConnectionChange?.(state);
    }
  }

  private broadcastError(err: DataError) {
    for (const sub of this.activeSubs.values()) {
      sub.handlers.onError?.(err);
    }
  }
}