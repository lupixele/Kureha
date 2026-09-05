import type { Provider } from './types';

export type ProviderErrorCode = 'INVALID_QUERY' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'PROVIDER_UNAVAILABLE' | 'PARTIAL_PROVIDER_RESULT' | 'PROVIDER_SCHEMA_CHANGED' | 'UNKNOWN_PROVIDER_ID';

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    public readonly provider: Provider,
    public readonly status?: number,
    public readonly retryable = false,
    public readonly retryAfterMs?: number,
  ) {
    super(code);
    this.name = 'ProviderError';
  }

  toJSON() {
    return { code: this.code, provider: this.provider, status: this.status, retryable: this.retryable, retryAfterMs: this.retryAfterMs };
  }
}

export function httpError(provider: Provider, status: number, retryAfterMs?: number): ProviderError {
  const retryable = status === 429 || [500, 502, 503, 504].includes(status);
  const code = status === 429 ? 'RATE_LIMITED' : status === 401 || status === 403 ? 'UNAUTHORIZED' : status === 404 ? 'UNKNOWN_PROVIDER_ID' : status === 400 ? 'INVALID_QUERY' : 'PROVIDER_UNAVAILABLE';
  return new ProviderError(code, provider, status, retryable, retryAfterMs);
}

export function safeProviderError(error: unknown, provider: Provider): ProviderError {
  return error instanceof ProviderError ? error : new ProviderError('PROVIDER_UNAVAILABLE', provider, undefined, true);
}
