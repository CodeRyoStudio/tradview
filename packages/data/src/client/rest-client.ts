import { DataError } from '../errors.js';
import { DEFAULT_DATA_PROVIDER_CAPABILITIES } from '../capabilities.js';
import type { AuthHooks } from './types.js';
import type {
  DataProviderCapabilities,
  HistoryQuery,
  HistoryResponse,
  RestErrorBody,
} from '../types.js';

export interface RestClientOptions {
  baseUrl: string;
  auth?: AuthHooks;
  protocolVersion?: string;
}

/** Resolve REST path; empty baseUrl → same-origin (Vite proxy) in browser. */
export function resolveApiUrl(baseUrl: string, pathname: string): URL {
  const base = baseUrl.replace(/\/$/, '');
  if (base) {
    return new URL(pathname.startsWith('/') ? `${base}${pathname}` : `${base}/${pathname}`);
  }
  const g = globalThis as typeof globalThis & { location?: { origin?: string } };
  const origin =
    typeof g.location?.origin === 'string' ? g.location.origin : 'http://127.0.0.1:4010';
  return new URL(pathname, origin);
}

export class TradViewRestClient {
  private capabilitiesCache: DataProviderCapabilities | null = null;

  constructor(private readonly opts: RestClientOptions) {}

  async getCapabilities(): Promise<DataProviderCapabilities> {
    if (this.capabilitiesCache) return this.capabilitiesCache;

    const res = await this.fetch(resolveApiUrl(this.opts.baseUrl, '/api/v1/capabilities'));

    if (!res.ok) {
      return DEFAULT_DATA_PROVIDER_CAPABILITIES;
    }

    this.capabilitiesCache = (await res.json()) as DataProviderCapabilities;
    return this.capabilitiesCache;
  }

  async getHistory(query: HistoryQuery): Promise<HistoryResponse> {
    const url = resolveApiUrl(this.opts.baseUrl, '/api/v1/bars');
    url.searchParams.set('symbol', query.symbol);
    url.searchParams.set('interval', query.interval);

    if (query.mode === 'range') {
      url.searchParams.set('from', String(query.from));
      url.searchParams.set('to', String(query.to));
    } else if (query.mode === 'loadMore') {
      url.searchParams.set('endTime', String(query.endTime));
      url.searchParams.set('limit', String(query.limit));
    } else {
      url.searchParams.set('limit', String(query.limit));
      if (query.cursor) url.searchParams.set('cursor', query.cursor);
    }

    const res = await this.fetch(url);
    if (!res.ok) {
      throw await this.toDataError(res, 'rest');
    }

    return (await res.json()) as HistoryResponse;
  }

  async searchSymbols(query: string): Promise<{ symbol: string; description?: string; exchange?: string }[]> {
    const url = resolveApiUrl(this.opts.baseUrl, '/api/v1/symbols/search');
    url.searchParams.set('q', query);
    const res = await this.fetch(url);
    if (!res.ok) return [];
    const body = (await res.json()) as { results: { symbol: string; description?: string; exchange?: string }[] };
    return body.results ?? [];
  }

  private async fetch(url: string | URL, init?: RequestInit): Promise<Response> {
    const headers = await this.buildHeaders();
    const qp = this.opts.auth?.getQueryParams?.();
    let target: URL =
      typeof url === 'string'
        ? url.startsWith('http')
          ? new URL(url)
          : resolveApiUrl(this.opts.baseUrl, url)
        : url;

    if (qp && Object.keys(qp).length > 0) {
      for (const [k, v] of Object.entries(qp)) target.searchParams.set(k, v);
    }

    await this.opts.auth?.onConnect?.('rest');
    return fetch(target, {
      ...init,
      headers: { ...headers, ...init?.headers },
    });
  }

  private async buildHeaders(): Promise<Record<string, string>> {
    const base: Record<string, string> = {
      Accept: 'application/json',
      'X-TradView-Protocol-Version': this.opts.protocolVersion ?? '1.0',
    };
    const extra = (await this.opts.auth?.getHeaders?.()) ?? {};
    return { ...base, ...extra };
  }

  private async toDataError(res: Response, transport: 'rest' | 'ws'): Promise<DataError> {
    let code = 'INTERNAL_ERROR';
    let message = res.statusText;
    let retryAfterMs: number | undefined;

    try {
      const body = (await res.json()) as RestErrorBody;
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      retryAfterMs = body.error?.retryAfterMs;
    } catch {
      /* empty */
    }

    if (res.status === 401) code = 'AUTH_FAILED';

    return new DataError({
      code: code as DataError['code'],
      message,
      recoverable: code === 'RATE_LIMITED' || code === 'AUTH_FAILED',
      retryAfterMs,
      transport,
    });
  }
}