import { createHash } from 'node:crypto';

export function stableHash(value: unknown): string {
  const serialized = JSON.stringify(value, (_key, item: unknown) => {
    if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
      return Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return item;
  });
  return createHash('sha256').update(serialized ?? 'null').digest('hex');
}
