/**
 * PR-19 CDN license / domain allowlist hook (commercial enforcement deferred).
 * Integrators may set `TradView.cdnLicense` before loading the UMD script.
 */
export interface CdnLicenseConfig {
  /** Allowed hostnames (e.g. `charts.example.com`). Empty = no domain check. */
  allowedDomains?: string[];
  /** When false, {@link assertCdnLicense} is a no-op. */
  enforce?: boolean;
}

declare global {
  interface Window {
    TradView?: { cdnLicense?: CdnLicenseConfig };
  }
}

export function assertCdnLicense(config?: CdnLicenseConfig): void {
  const cfg =
    config ??
    (typeof globalThis !== 'undefined'
      ? (globalThis as unknown as Window).TradView?.cdnLicense
      : undefined);
  if (!cfg?.enforce) return;
  const allowed = cfg.allowedDomains ?? [];
  if (allowed.length === 0) return;
  const host =
    typeof location !== 'undefined' && location.hostname ? location.hostname : '';
  if (!host || !allowed.includes(host)) {
    console.warn(
      `[tradview] CDN license: host "${host}" is not in allowedDomains (${allowed.join(', ')})`,
    );
  }
}