import type { SymbolSearchHit } from './client/types.js';

/** Integrator-provided symbol metadata enrichment (PR-12). */
export interface SymbolInfo {
  symbol: string;
  description?: string;
  exchange?: string;
  priceScale?: number;
  minMove?: number;
}

export interface SymbolResolver {
  resolve(symbol: string): Promise<SymbolInfo | null>;
  search?(query: string): Promise<SymbolSearchHit[]>;
}

/** Pass-through resolver when integrator has no extra metadata. */
export function createPassthroughSymbolResolver(
  search?: (query: string) => Promise<SymbolSearchHit[]>,
): SymbolResolver {
  return {
    async resolve(symbol) {
      return { symbol };
    },
    search,
  };
}