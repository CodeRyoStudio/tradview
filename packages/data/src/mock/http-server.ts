import http from 'node:http';
import type { ServerResponse } from 'node:http';
import { MOCK_GATEWAY_CAPABILITIES } from '../capabilities.js';
import { InvalidIntervalError } from '../interval.js';
import type { RestErrorBody } from '../types.js';
import { parseHistoryQuery, resolveHistoryBars } from './bar-generator.js';

export interface MockHttpServerOptions {
  port: number;
  host?: string;
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'X-TradView-Protocol-Version': '1.0',
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function sendError(res: ServerResponse, status: number, code: string, message: string, retryAfterMs?: number) {
  const body: RestErrorBody = { error: { code, message, retryAfterMs } };
  sendJson(res, status, body);
}

export function createMockHttpServer(opts: MockHttpServerOptions): http.Server {
  const host = opts.host ?? '127.0.0.1';

  return http.createServer(async (req, res) => {
    try {
      if (!req.url) {
        sendError(res, 400, 'INVALID_RANGE', 'Missing URL');
        return;
      }

      const url = new URL(req.url, `http://${host}:${opts.port}`);

      if (req.method === 'GET' && url.pathname === '/api/v1/capabilities') {
        sendJson(res, 200, MOCK_GATEWAY_CAPABILITIES);
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/bars') {
        try {
          const query = parseHistoryQuery(url);
          const result = resolveHistoryBars(query);
          sendJson(res, 200, {
            symbol: query.symbol,
            interval: query.interval,
            bars: result.bars,
            nextCursor: result.nextCursor,
            hasMore: result.hasMore,
          });
        } catch (e) {
          if (e instanceof InvalidIntervalError) {
            sendError(res, 400, 'INVALID_INTERVAL', e.message);
            return;
          }
          if (e instanceof Error && e.message === 'INVALID_RANGE') {
            sendError(res, 400, 'INVALID_RANGE', 'from must be less than to');
            return;
          }
          if (e instanceof Error && e.message === 'MISSING_PARAMS') {
            sendError(res, 400, 'INVALID_RANGE', 'symbol and interval required');
            return;
          }
          throw e;
        }
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/symbols/search') {
        const q = url.searchParams.get('q') ?? '';
        sendJson(res, 200, {
          results: [
            { symbol: 'BINANCE:BTCUSDT', description: 'Bitcoin / Tether', exchange: 'BINANCE' },
            { symbol: 'BINANCE:ETHUSDT', description: 'Ethereum / Tether', exchange: 'BINANCE' },
          ].filter((s) => s.symbol.toLowerCase().includes(q.toLowerCase())),
        });
        return;
      }

      sendError(res, 404, 'NOT_FOUND', `Unknown path: ${url.pathname}`);
    } catch (err) {
      sendError(res, 500, 'INTERNAL_ERROR', err instanceof Error ? err.message : 'Unknown error');
    }
  });
}

export async function listenMockHttp(server: http.Server, port: number, host = '127.0.0.1') {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
}