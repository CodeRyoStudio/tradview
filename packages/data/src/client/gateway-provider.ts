import { TradViewRestClient } from './rest-client.js';
import { TradViewWsClient } from './ws-client.js';
import type {
  DataProvider,
  GatewayDataProviderOptions,
  RealtimeHandlers,
  SubscribeParams,
  Subscription,
  SymbolSearchHit,
  WsHistoryParams,
} from './types.js';
import type { HistoryQuery } from '../types.js';

export function createGatewayDataProvider(opts: GatewayDataProviderOptions): DataProvider {
  const rest = new TradViewRestClient({
    baseUrl: opts.restBaseUrl,
    auth: opts.auth,
    protocolVersion: opts.protocolVersion,
  });

  const ws = new TradViewWsClient({
    wsUrl: opts.wsUrl,
    auth: opts.auth,
    protocolVersion: opts.protocolVersion,
    encoding: opts.encoding,
    subscribeAckTimeoutMs: opts.subscribeAckTimeoutMs,
    subscribeMaxRetries: opts.subscribeMaxRetries,
    reconnect: opts.reconnect,
  });

  const provider: DataProvider = {
    setWsEncoding(encoding) {
      ws.setEncoding(encoding);
    },
    async getCapabilities() {
      return rest.getCapabilities();
    },

    /** Forwards all modes to REST; chart bootstrap uses `loadMore` with `endTime = now`. */
    async getHistory(query: HistoryQuery) {
      const caps = await provider.getCapabilities!();
      if (caps.wsHistory && provider.requestWsHistory) {
        if (query.mode === 'range') {
          const bars = await provider.requestWsHistory({
            symbol: query.symbol,
            interval: query.interval,
            from: query.from,
            to: query.to,
          });
          return { bars, hasMore: false };
        }
      }
      const res = await rest.getHistory(query);
      return { bars: res.bars, nextCursor: res.nextCursor, hasMore: res.hasMore };
    },

    async subscribe(params: SubscribeParams, handlers: RealtimeHandlers): Promise<Subscription> {
      const wrapped: RealtimeHandlers = {
        ...handlers,
        onConnectionChange: (state) => {
          handlers.onConnectionChange?.(state);
        },
      };
      return ws.subscribe(params, wrapped);
    },

    async unsubscribe(subscriptionId: string) {
      await ws.unsubscribe(subscriptionId);
    },

    async searchSymbols(query: string): Promise<SymbolSearchHit[]> {
      const results = await rest.searchSymbols(query);
      return results.map((r) => ({
        symbol: r.symbol,
        name: r.description ?? r.symbol,
        exchange: r.exchange,
      }));
    },

    async requestWsHistory(params: WsHistoryParams) {
      await ws.connect();
      return ws.requestHistory(params);
    },

    async connect() {
      await ws.connect();
    },

    async disconnect() {
      await ws.disconnect();
    },
  };

  return provider;
}