import type { Interval } from './interval.js';

export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type HistoryMode = 'range' | 'cursor' | 'loadMore';

export type RealtimeChannel = 'bar' | 'tick';

export type RealtimeStreamMode = 'bar' | 'tick' | 'bar+tick';

export interface DataProviderCapabilities {
  historyModes: HistoryMode[];
  wsHistory?: boolean;
  symbolSearch?: boolean;
  realtimeModes: RealtimeStreamMode[];
  encoding?: Array<'json' | 'protobuf'>;
}

export type HistoryQuery =
  | { mode: 'range'; symbol: string; interval: Interval; from: number; to: number }
  | { mode: 'cursor'; symbol: string; interval: Interval; limit: number; cursor?: string }
  | {
      mode: 'loadMore';
      symbol: string;
      interval: Interval;
      endTime: number;
      limit: number;
    };

export interface HistoryResponse {
  symbol: string;
  interval: Interval;
  bars: Bar[];
  nextCursor?: string;
  hasMore: boolean;
}

export interface RestErrorBody {
  error: {
    code: string;
    message: string;
    retryAfterMs?: number;
  };
}

export interface Envelope<T = unknown> {
  v: string;
  id?: string;
  type: string;
  ts?: number;
  payload: T;
}

export interface SubscribePayload {
  symbol: string;
  interval: Interval;
  channels: RealtimeChannel[];
  streamMode?: RealtimeStreamMode;
}

export interface SubscribeOkPayload {
  subscriptionId: string;
  symbol: string;
  interval: Interval;
}

export interface BarPushPayload {
  subscriptionId: string;
  bar: Bar;
  partial?: boolean;
  barSeq?: string;
}

export interface TickPushPayload {
  subscriptionId: string;
  tick: { t: number; price: number; size: number };
}

export interface HistoryRequestPayload {
  symbol: string;
  interval: Interval;
  from: number;
  to: number;
  limit?: number;
}

export interface HistoryResponsePayload {
  bars: Bar[];
  hasMore: boolean;
}

export interface SymbolSearchResult {
  symbol: string;
  description?: string;
  exchange?: string;
}