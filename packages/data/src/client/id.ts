let counter = 0;

export function nextClientId(prefix = 'c'): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}`;
}