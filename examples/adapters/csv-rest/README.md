# csv-rest adapter (V2-C)

Reference **self-hosted** `DataProvider` that loads OHLCV from a CSV HTTP endpoint.

## Endpoint

Default path: `{restBaseUrl}/history/{symbol}/{interval}.csv`

CSV columns: `t,o,h,l,c,v` (header row optional).

## Usage

```typescript
import { createCsvRestDataProvider } from './src/csv-rest-provider.js';
import { createChart } from '@coderyo/core';

const provider = createCsvRestDataProvider({
  restBaseUrl: 'https://your-host.example/api/csv',
});

createChart('#chart', { dataProvider: provider, symbol: 'LOCAL:ASSET', interval: '1d' });
```

Realtime is intentionally stubbed; attach polling or your own WS in production.