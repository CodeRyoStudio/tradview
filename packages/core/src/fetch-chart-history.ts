import type { Bar, DataProvider, HistoryQuery } from '@coderyo/data';
import { intervalMs } from '@coderyo/data';

/** REST with optional WS `requestWsHistory` fallback when capabilities allow. */
export async function fetchChartHistory(
  provider: DataProvider,
  query: HistoryQuery,
): Promise<{ bars: Bar[]; nextCursor?: string; hasMore?: boolean }> {
  const caps = await provider.getCapabilities?.();
  if (caps?.wsHistory && provider.requestWsHistory) {
    try {
      if (query.mode === 'range') {
        const bars = await provider.requestWsHistory({
          symbol: query.symbol,
          interval: query.interval,
          from: query.from,
          to: query.to,
        });
        return { bars, hasMore: false };
      }
      if (query.mode === 'loadMore') {
        const ms = intervalMs(query.interval);
        const from = query.endTime - ms * query.limit;
        const bars = await provider.requestWsHistory({
          symbol: query.symbol,
          interval: query.interval,
          from,
          to: query.endTime,
        });
        return { bars, hasMore: false };
      }
    } catch {
      /* fall through to REST */
    }
  }
  return provider.getHistory(query);
}