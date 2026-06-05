# postgres-ws reference adapter (G2-7)

`createPostgresWsDataProvider` targets a small gateway in front of Postgres:

| Endpoint | Method | Query / body |
|----------|--------|----------------|
| `/bars` | GET | `symbol`, `interval`, plus `from`/`to` or `limit` |
| WebSocket | — | `{ "op": "subscribe", "symbol", "interval", "channels": ["bar"] }` |

Inbound WS messages: `{ "type": "bar", "bar": { "t", "o", "h", "l", "c", "v?" } }`.

## Production hardening (copy before shipping)

- **Unsubscribe**: Always call `provider.unsubscribe(subscriptionId)` when tearing down a chart or switching symbol; the adapter closes the socket and drops the id from its internal map.
- **Reconnect**: This reference does not auto-reconnect. Wrap `subscribe` with your own backoff + resubscribe, or use a gateway that replays missed bars after reconnect.
- **Fetch limits**: `maxRows` (default `50_000`) caps parsed history rows; `fetchTimeoutMs` (default `15_000`) aborts hung REST calls.
- **Errors**: Non-2xx REST responses throw; malformed WS payloads are ignored (integrators may want stricter logging).

```ts
import { createPostgresWsDataProvider } from '@tradview-example/postgres-ws-adapter';

const provider = createPostgresWsDataProvider({
  restBaseUrl: 'https://your-host/api',
  wsUrl: 'wss://your-host/ws',
  maxRows: 20_000,
  fetchTimeoutMs: 10_000,
});
```

## Tests

```bash
pnpm --filter @tradview-example/postgres-ws-adapter test
```

Covers `parseBarsJson` envelopes/limits, history abort timeout, and `unsubscribe` socket cleanup.