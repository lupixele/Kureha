import type { Provider } from './types';

export type ProviderPriority = 'interactive' | 'background';
export interface RateMetadata {
  limit?: number;
  remaining?: number;
  resetAt?: number;
  retryAfterMs?: number;
}
export type RateObserver = (provider: Provider, metadata: RateMetadata) => void;

export function retryAfter(header: string | null, now: number): number | undefined {
  if (header === null || header.trim() === '') return undefined;
  if (/^\d+(\.\d+)?$/.test(header.trim())) return Number(header) * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

export function readRateMetadata(headers: Headers, now: number): RateMetadata {
  const number = (name: string) => {
    const value = headers.get(name);
    return value !== null && /^\d+$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : undefined;
  };
  const reset = number('x-ratelimit-reset');
  return { limit: number('x-ratelimit-limit'), remaining: number('x-ratelimit-remaining'), resetAt: reset === undefined ? undefined : reset * 1000, retryAfterMs: retryAfter(headers.get('retry-after'), now) };
}
