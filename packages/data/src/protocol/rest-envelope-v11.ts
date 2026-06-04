import type {
  Bar,
  DataProviderCapabilities,
  HistoryQuery,
  HistoryResponse,
  RestErrorBody,
} from '../types.js';

/** REST / header protocol version for v1.1 (DESIGN-v2 §4.4, DESIGN §8.2). */
export const REST_PROTOCOL_VERSION_V11 = '1.1' as const;

export type RestProtocolVersion = typeof REST_PROTOCOL_VERSION_V11;

/** Known REST v1.1 envelope `type` values (extensible via string). */
export const REST_ENVELOPE_TYPES_V11 = {
  historyRequest: 'history.request',
  historyResponse: 'history.response',
  capabilities: 'capabilities',
} as const;

export type RestEnvelopeTypeV11 =
  | (typeof REST_ENVELOPE_TYPES_V11)[keyof typeof REST_ENVELOPE_TYPES_V11]
  | (string & {});

/** Error body inside REST v1.1 envelope when `ok: false` (DESIGN-v2 §4.4). */
export interface RestEnvelopeErrorV11 {
  code: string;
  message: string;
  retryAfterMs?: number;
}

/**
 * REST v1.1 response/request envelope (DESIGN-v2 §4.4).
 * Distinct from WS JSON `Envelope` (`v`, `type`, `payload`) in types.ts.
 */
export interface RestEnvelopeV11<TData = unknown> {
  version: RestProtocolVersion;
  type: RestEnvelopeTypeV11;
  id: string;
  /** Omitted on requests; required on responses per `parseRestEnvelopeV11(..., { requireOk: true })`. */
  ok?: boolean;
  data?: TData;
  error?: RestEnvelopeErrorV11;
}

/** `data` for `type: history.response` (minimal golden + full gateway shape). */
export interface RestHistoryResponseDataV11 {
  bars: Bar[];
  symbol?: string;
  interval?: string;
  nextCursor?: string;
  hasMore?: boolean;
}

export type RestHistoryResponseEnvelopeV11 = RestEnvelopeV11<RestHistoryResponseDataV11>;

/** `data` for `type: history.request` (range mode; extend in adapter for cursor/loadMore). */
export interface RestHistoryRequestDataV11 {
  symbol: string;
  interval: string;
  from: number;
  to: number;
  limit?: number;
}

export type RestHistoryRequestEnvelopeV11 = RestEnvelopeV11<RestHistoryRequestDataV11>;

export type RestCapabilitiesEnvelopeV11 = RestEnvelopeV11<DataProviderCapabilities>;

export interface ParseRestEnvelopeV11Result<T = unknown> {
  ok: true;
  envelope: RestEnvelopeV11<T>;
}

export interface ParseRestEnvelopeV11Error {
  ok: false;
  issues: string[];
}

export type ParseRestEnvelopeV11Outcome<T = unknown> =
  | ParseRestEnvelopeV11Result<T>
  | ParseRestEnvelopeV11Error;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/** Returns a validation issue string, or `null` when `value` is a valid `Bar`. */
export function parseBarIssue(value: unknown, path: string): string | null {
  if (!isRecord(value)) {
    return `${path}: must be an object`;
  }
  const { t, o, h, l, c, v } = value;
  if (
    typeof t !== 'number' ||
    typeof o !== 'number' ||
    typeof h !== 'number' ||
    typeof l !== 'number' ||
    typeof c !== 'number'
  ) {
    return `${path}: t,o,h,l,c must be numbers`;
  }
  if (v !== undefined && typeof v !== 'number') {
    return `${path}: v must be a number when present`;
  }
  return null;
}

function parseRestEnvelopeErrorV11(value: unknown): RestEnvelopeErrorV11 | null {
  if (!isRecord(value)) return null;
  const { code, message, retryAfterMs } = value;
  if (!isNonEmptyString(code) || !isNonEmptyString(message)) return null;
  if (retryAfterMs !== undefined && typeof retryAfterMs !== 'number') return null;
  return {
    code,
    message,
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  };
}

/**
 * Parse unknown JSON into `RestEnvelopeV11` without throwing.
 * Does not validate `data` shape beyond envelope shell unless `expectOkResponse` is set.
 */
export function parseRestEnvelopeV11<T = unknown>(
  value: unknown,
  opts?: { requireOk?: boolean; requireId?: boolean },
): ParseRestEnvelopeV11Outcome<T> {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, issues: ['root must be an object'] };
  }

  if (value.version !== REST_PROTOCOL_VERSION_V11) {
    issues.push(`version must be "${REST_PROTOCOL_VERSION_V11}"`);
  }
  if (!isNonEmptyString(value.type)) {
    issues.push('type must be a non-empty string');
  }
  if (opts?.requireId !== false && !isNonEmptyString(value.id)) {
    issues.push('id must be a non-empty string');
  }

  if (value.ok !== undefined && typeof value.ok !== 'boolean') {
    issues.push('ok must be boolean when present');
  }

  if (opts?.requireOk === true && value.ok !== true && value.ok !== false) {
    issues.push('ok is required for REST v1.1 responses');
  }

  if (value.data !== undefined && !isRecord(value.data) && !Array.isArray(value.data)) {
    issues.push('data must be an object when present');
  }

  if (value.error !== undefined) {
    const err = parseRestEnvelopeErrorV11(value.error);
    if (!err) issues.push('error must be { code, message, retryAfterMs? }');
  }

  if (value.ok === true && value.error !== undefined) {
    issues.push('error must not be set when ok is true');
  }
  if (value.ok === false && value.data !== undefined) {
    issues.push('data must not be set when ok is false');
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const envelope: RestEnvelopeV11<T> = {
    version: REST_PROTOCOL_VERSION_V11,
    type: value.type as RestEnvelopeTypeV11,
    id: (value.id as string) ?? '',
    ...(typeof value.ok === 'boolean' ? { ok: value.ok } : {}),
    ...(value.data !== undefined ? { data: value.data as T } : {}),
    ...(value.error !== undefined
      ? { error: parseRestEnvelopeErrorV11(value.error) as RestEnvelopeErrorV11 }
      : {}),
  };

  return { ok: true, envelope };
}

/**
 * Validate REST v1.1 envelope shell (alias for `parseRestEnvelopeV11` with `requireOk: true`).
 */
export function validateRestEnvelopeV11<T = unknown>(
  value: unknown,
  opts?: { requireId?: boolean },
): ParseRestEnvelopeV11Outcome<T> {
  return parseRestEnvelopeV11<T>(value, { requireOk: true, requireId: opts?.requireId });
}

/** Type guard for REST v1.1 envelope shell. */
export function isRestEnvelopeV11(value: unknown): value is RestEnvelopeV11 {
  return parseRestEnvelopeV11(value).ok;
}

/** Validate and narrow a success `history.response` envelope. */
export function parseRestHistoryResponseEnvelopeV11(
  value: unknown,
): ParseRestEnvelopeV11Outcome<RestHistoryResponseDataV11> {
  const parsed = parseRestEnvelopeV11<RestHistoryResponseDataV11>(value, {
    requireOk: true,
  });
  if (!parsed.ok) return parsed;

  const { envelope } = parsed;
  const issues: string[] = [];

  if (envelope.type !== REST_ENVELOPE_TYPES_V11.historyResponse) {
    issues.push(`type must be "${REST_ENVELOPE_TYPES_V11.historyResponse}"`);
  }
  if (envelope.ok !== true) {
    issues.push('ok must be true for history success response');
  }
  if (!envelope.data || !Array.isArray(envelope.data.bars)) {
    issues.push('data.bars must be an array');
  } else {
    for (let i = 0; i < envelope.data.bars.length; i++) {
      const barIssue = parseBarIssue(envelope.data.bars[i], `data.bars[${i}]`);
      if (barIssue) issues.push(barIssue);
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return parsed;
}

/** Validate error `history.response` (or any) envelope with `ok: false`. */
export function parseRestErrorEnvelopeV11(
  value: unknown,
): ParseRestEnvelopeV11Outcome<never> {
  const parsed = parseRestEnvelopeV11(value, { requireOk: true });
  if (!parsed.ok) return parsed;

  if (parsed.envelope.ok !== false) {
    return { ok: false, issues: ['ok must be false'] };
  }
  if (!parsed.envelope.error) {
    return { ok: false, issues: ['error is required when ok is false'] };
  }
  return { ok: true, envelope: parsed.envelope as RestEnvelopeV11<never> };
}

/** Validate REST v1.1 `history.request` envelope (no `ok` field). */
export function parseRestHistoryRequestEnvelopeV11(
  value: unknown,
): ParseRestEnvelopeV11Outcome<RestHistoryRequestDataV11> {
  const parsed = parseRestEnvelopeV11<RestHistoryRequestDataV11>(value);
  if (!parsed.ok) return parsed;

  const { envelope } = parsed;
  const issues: string[] = [];

  if (envelope.type !== REST_ENVELOPE_TYPES_V11.historyRequest) {
    issues.push(`type must be "${REST_ENVELOPE_TYPES_V11.historyRequest}"`);
  }
  if (envelope.ok !== undefined) {
    issues.push('ok must be omitted on history.request');
  }
  if (!envelope.data || !isRecord(envelope.data)) {
    issues.push('data is required');
  } else {
    const { symbol, interval, from, to, limit } = envelope.data;
    if (!isNonEmptyString(symbol)) issues.push('data.symbol must be a non-empty string');
    if (!isNonEmptyString(interval)) issues.push('data.interval must be a non-empty string');
    if (typeof from !== 'number' || typeof to !== 'number') {
      issues.push('data.from and data.to must be numbers');
    }
    if (limit !== undefined && typeof limit !== 'number') {
      issues.push('data.limit must be a number when present');
    }
  }

  if (issues.length > 0) return { ok: false, issues };
  return parsed;
}

/** Map REST v1.1 error envelope to flat v1.0 `RestErrorBody` shape for existing clients. */
export function restEnvelopeErrorToRestErrorBody(
  error: RestEnvelopeErrorV11,
): RestErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.retryAfterMs !== undefined ? { retryAfterMs: error.retryAfterMs } : {}),
    },
  };
}

/** Build REST v1.1 `history.request` envelope (requests omit `ok`). */
export function buildRestHistoryRequestEnvelopeV11(
  id: string,
  data: RestHistoryRequestDataV11 | Extract<HistoryQuery, { mode: 'range' }>,
): RestHistoryRequestEnvelopeV11 {
  const payload: RestHistoryRequestDataV11 =
    'mode' in data
      ? {
          symbol: data.symbol,
          interval: data.interval,
          from: data.from,
          to: data.to,
        }
      : data;

  return {
    version: REST_PROTOCOL_VERSION_V11,
    type: REST_ENVELOPE_TYPES_V11.historyRequest,
    id,
    data: payload,
  };
}

/** Build a success REST v1.1 history response envelope from gateway data. */
export function buildRestHistoryResponseEnvelopeV11(
  id: string,
  data: RestHistoryResponseDataV11 | HistoryResponse,
): RestHistoryResponseEnvelopeV11 {
  const payload: RestHistoryResponseDataV11 =
    'bars' in data && Array.isArray(data.bars)
      ? {
          bars: data.bars,
          ...('symbol' in data ? { symbol: data.symbol } : {}),
          ...('interval' in data ? { interval: data.interval } : {}),
          ...('nextCursor' in data ? { nextCursor: data.nextCursor } : {}),
          ...('hasMore' in data ? { hasMore: data.hasMore } : {}),
        }
      : data;

  return {
    version: REST_PROTOCOL_VERSION_V11,
    type: REST_ENVELOPE_TYPES_V11.historyResponse,
    id,
    ok: true,
    data: payload,
  };
}

/** Build a REST v1.1 error envelope. */
export function buildRestErrorEnvelopeV11(
  type: RestEnvelopeTypeV11,
  id: string,
  error: RestEnvelopeErrorV11,
): RestEnvelopeV11<never> {
  return {
    version: REST_PROTOCOL_VERSION_V11,
    type,
    id,
    ok: false,
    error,
  };
}