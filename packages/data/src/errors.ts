export type DataErrorCode =
  | 'RATE_LIMITED'
  | 'INVALID_RANGE'
  | 'INVALID_SYMBOL'
  | 'INVALID_INTERVAL'
  | 'AUTH_FAILED'
  | 'SUBSCRIBE_TIMEOUT'
  | 'UNKNOWN_SYMBOL'
  | 'CONFIG_ERROR'
  | 'INTERNAL_ERROR';

export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly recoverable: boolean;
  readonly retryAfterMs?: number;
  readonly refId?: string;
  readonly transport?: 'rest' | 'ws';

  constructor(opts: {
    code: DataErrorCode;
    message: string;
    recoverable: boolean;
    retryAfterMs?: number;
    refId?: string;
    transport?: 'rest' | 'ws';
  }) {
    super(opts.message);
    this.name = 'DataError';
    this.code = opts.code;
    this.recoverable = opts.recoverable;
    this.retryAfterMs = opts.retryAfterMs;
    this.refId = opts.refId;
    this.transport = opts.transport;
  }
}