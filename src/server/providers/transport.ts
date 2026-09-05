import { httpError, ProviderError, safeProviderError } from './errors';
import { readRateMetadata, type RateObserver } from './rate-budget';
import type { Provider } from './types';

export interface ProviderRequest {
  provider: Provider;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}
export interface FetchTransport { request(request: ProviderRequest): Promise<unknown> }
export interface FetchTransportOptions {
  fetch: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  now?: () => number;
  timeoutMs?: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRateLimit?: RateObserver;
}

export function createFetchTransport(options: FetchTransportOptions): FetchTransport {
  const { fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), random = Math.random, now = Date.now,
    timeoutMs = 10_000, maxRetries = 2, baseDelayMs = 250, maxDelayMs = 10_000 } = options;
  return { async request(request) {
    for (let attempt = 0; ; attempt++) {
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new ProviderError('PROVIDER_UNAVAILABLE', request.provider, undefined, true));
          }, timeoutMs);
        });
        const operation = async () => {
          const response = await fetch(request.url, { method: request.method ?? 'GET', headers: request.headers, body: request.body, signal: controller.signal, redirect: 'error' });
          const metadata = readRateMetadata(response.headers, now());
          options.onRateLimit?.(request.provider, metadata);
          if (!response.ok) throw httpError(request.provider, response.status, metadata.retryAfterMs);
          try { return await response.json() as unknown; }
          catch (error) {
            if (error instanceof SyntaxError) throw new ProviderError('PROVIDER_SCHEMA_CHANGED', request.provider, response.status);
            throw new ProviderError('PROVIDER_UNAVAILABLE', request.provider, response.status, true);
          }
        };
        return await Promise.race([operation(), timeout]);
      } catch (caught) {
        const error = safeProviderError(caught, request.provider);
        if (!error.retryable || attempt >= maxRetries) throw error;
        clearTimeout(timer);
        await sleep(error.retryAfterMs ?? random() * Math.min(maxDelayMs, baseDelayMs * 2 ** attempt));
      } finally { clearTimeout(timer); }
    }
  } };
}
