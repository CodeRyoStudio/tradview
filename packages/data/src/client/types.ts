import type { Interval } from '../interval.js';
import type { DataError } from '../errors.js';
import type {
  Bar,
  DataProviderCapabilities,
  HistoryQuery,
  RealtimeChannel,
  RealtimeStreamMode,
} from '../types.js';

export type ConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface AuthHooks {
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  getQueryParams?: () => Record<string, string>;
  onConnect?: (transport: 'rest' | 'ws') => void | Promise<void>;
  onDisconnect?: () => void;
  refreshToken?: () => Promise<void>;
}

export interface Subscription {
  id: string;
  clientRef: string;
  symbol: string;
  interval: Interval;
  channels: RealtimeChannel[];
  streamMode: RealtimeStreamMode;
}

export interface SubscribeParams {
  symbol: string;
  interval: Interval;
  channels?: RealtimeChannel[];
  streamMode?: RealtimeStreamMode;
}

export interface Tick {
  t: number;
  price: number;
  size: number;
}

export interface RealtimeHandlers {
  onBar?: (bar: Bar, meta: { partial: boolean; subscriptionId: string }) => void;
  onTick?: (tick: Tick, meta: { subscriptionId: string }) => void;
  onError?: (err: DataError) => void;
  onConnectionChange?: (state: ConnectionState) => void;
}

export interface SymbolSearchHit {
  symbol: string;
  name: string;
  exchange?: string;
}

export interface WsHistoryParams {
  symbol: string;
  interval: Interval;
  from: number;
  to: number;
  limit?: number;
}

export type WsEncoding = 'json' | 'protobuf';

export interface DataProvider {
  getCapabilities?(): Promise<DataProviderCapabilities>;
  /** Switch WS wire encoding before `connect()` (gateway provider). */
  setWsEncoding?(encoding: WsEncoding): void;
  getHistory(
    query: HistoryQuery,
  ): Promise<{ bars: Bar[]; nextCursor?: string; hasMore?: boolean }>;
  subscribe(params: SubscribeParams, handlers: RealtimeHandlers): Promise<Subscription>;
  unsubscribe(subscriptionId: string): Promise<void>;
  searchSymbols?(query: string): Promise<SymbolSearchHit[]>;
  requestWsHistory?(params: WsHistoryParams): Promise<Bar[]>;
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface GatewayDataProviderOptions {
  restBaseUrl: string;
  wsUrl: string;
  auth?: AuthHooks;
  subscribeAckTimeoutMs?: number;
  subscribeMaxRetries?: number;
  reconnect?: {
    initialDelayMs?: number;
    maxDelayMs?: number;
    maxAttempts?: number;
  };
  protocolVersion?: string;
  /** WS wire encoding (default `json`). Requires server `capabilities.encoding`. */
  encoding?: WsEncoding;
}