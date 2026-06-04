import { WebSocket } from 'ws';
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

function toMessageBuffer(data: WebSocket.RawData): Uint8Array {
  if (Buffer.isBuffer(data)) return new Uint8Array(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return Buffer.concat(data);
  return new Uint8Array(Buffer.from(String(data), 'utf8'));
}

export class TradViewWsClient {
  private ws: WebSocket | null = null;
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
    if (this.ws?.readyState === WebSocket.OPEN) {
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
    const socket = this.ws;
    this.ws = null;
    if (socket && socket.readyState === WebSocket.OPEN) {
      await new Promise<void>((resolve) => {
        socket.once('close', () => resolve());
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
    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) return;
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
      const ws = new WebSocket(url, [this.wsSubprotocol()], { headers });
      this.ws = ws;

      ws.on('open', async () => {
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
      });

      ws.on('message', (data) => {
        void this.handleMessage(data);
      });

      ws.on('close', () => {
        this.clearPing();
        if (!this.stopped && !this.authFailed) {
          void this.scheduleReconnect();
        } else if (this.authFailed) {
          this.setState('failed');
        } else {
          this.setState('disconnected');
        }
      });

      ws.on('error', () => {
        /* close handler drives reconnect */
      });
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
      this.ws?.close();
      return;
    }

    try {
      await this.opts.auth.refreshToken();
      this.ws?.close();
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

  private async parseIncomingMessage(data: WebSocket.RawData): Promise<Envelope | null> {
    if (this.encoding === 'protobuf') {
      try {
        return await decodeWsProtobufEnvelope(toMessageBuffer(data));
      } catch {
        return null;
      }
    }
    try {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      return JSON.parse(text) as Envelope;
    } catch {
      return null;
    }
  }

  private async handleMessage(data: WebSocket.RawData) {
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
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    if (this.encoding === 'protobuf') {
      void encodeWsProtobufEnvelope(msg).then((bytes) => {
        if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(bytes);
      });
      return;
    }
    this.ws.send(JSON.stringify(msg));
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