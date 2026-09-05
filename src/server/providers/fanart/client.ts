import { ProviderError, safeProviderError } from '../errors';
import type { FetchTransport } from '../transport';
import { parseProvider, validateId, type NormalizedArtworkCandidate, type OptionalResult, type ProviderRef } from '../types';
import { fanartSchema } from './schemas';
import { normalizeFanart } from './normalize';

export type FanartMapping = ProviderRef & { sourceMappingId: string; positive: boolean };
export function createFanartClient(options: { transport: FetchTransport; endpoint: (kind: 'movie' | 'tv', id: string) => string; apiKey: string }) {
  return { async logos(mapping: FanartMapping | null): Promise<OptionalResult<NormalizedArtworkCandidate[]>> {
    if (!mapping?.positive || !mapping.sourceMappingId || !((mapping.provider === 'tmdb' && mapping.target === 'movie') || (mapping.provider === 'tvdb' && mapping.target === 'tv'))) return { ok: true, data: [] };
    try {
      validateId(mapping.providerId, 'fanart');
      if (!options.apiKey.trim()) throw new ProviderError('UNAUTHORIZED', 'fanart');
      const kind = mapping.target === 'movie' ? 'movie' : 'tv';
      const raw = await options.transport.request({ provider: 'fanart', method: 'GET', url: options.endpoint(kind, mapping.providerId), headers: { 'api-key': options.apiKey } });
      return { ok: true, data: normalizeFanart(parseProvider(fanartSchema, raw, 'fanart'), kind, mapping.sourceMappingId) };
    } catch (error) { return { ok: false, error: safeProviderError(error, 'fanart') }; }
  } };
}
