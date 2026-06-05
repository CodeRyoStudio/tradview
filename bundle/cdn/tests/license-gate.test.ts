import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertCdnLicense, type CdnLicenseConfig } from '../src/license-gate.js';

describe('assertCdnLicense', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  beforeEach(() => {
    warn.mockClear();
    delete (globalThis as { TradView?: { cdnLicense?: CdnLicenseConfig } }).TradView;
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('is a no-op when enforce is false or omitted', () => {
    assertCdnLicense({ allowedDomains: ['evil.example'], enforce: false });
    assertCdnLicense({});
    expect(warn).not.toHaveBeenCalled();
  });

  it('is a no-op when enforce is true but allowedDomains is empty', () => {
    assertCdnLicense({ enforce: true, allowedDomains: [] });
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns on domain mismatch when enforce is true (warn-only, no throw)', () => {
    vi.stubGlobal('location', { hostname: 'charts.example.com' });
    expect(() =>
      assertCdnLicense({ enforce: true, allowedDomains: ['allowed.example.com'] }),
    ).not.toThrow();
    vi.unstubAllGlobals();
  });

  it('does not warn when hostname is in allowedDomains', () => {
    vi.stubGlobal('location', { hostname: 'allowed.example.com' });
    assertCdnLicense({ enforce: true, allowedDomains: ['allowed.example.com'] });
    expect(warn).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('reads TradView.cdnLicense from global when config omitted', () => {
    (globalThis as { TradView?: { cdnLicense?: CdnLicenseConfig } }).TradView = {
      cdnLicense: { enforce: true, allowedDomains: [] },
    };
    assertCdnLicense();
    expect(warn).not.toHaveBeenCalled();
  });
});