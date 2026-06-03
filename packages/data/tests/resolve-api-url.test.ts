import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from '../src/client/rest-client.js';

describe('resolveApiUrl', () => {
  it('joins explicit base with path', () => {
    const u = resolveApiUrl('http://127.0.0.1:4010', '/api/v1/bars');
    expect(u.href).toBe('http://127.0.0.1:4010/api/v1/bars');
  });

  it('uses fallback origin when base is empty', () => {
    const u = resolveApiUrl('', '/api/v1/bars');
    expect(u.pathname).toBe('/api/v1/bars');
    expect(u.origin).toMatch(/^https?:\/\//);
  });
});