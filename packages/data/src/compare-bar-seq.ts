const UINT64_RE = /^\d+$/;

/**
 * Compare bar sequence strings for idempotent merge (DESIGN §7.1).
 * Decimal integer strings use bigint; opaque strings use lexicographic order.
 */
export function compareBarSeq(a: string, b: string): -1 | 0 | 1 {
  if (a === b) return 0;

  const aIsUint = UINT64_RE.test(a);
  const bIsUint = UINT64_RE.test(b);

  if (aIsUint && bIsUint) {
    const diff = BigInt(a) - BigInt(b);
    if (diff < 0n) return -1;
    if (diff > 0n) return 1;
    return 0;
  }

  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}