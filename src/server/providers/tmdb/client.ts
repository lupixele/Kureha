import { ProviderError } from '../errors';
import type { FetchTransport } from '../transport';
import { parseProvider, searchQuery, validateId, type UnifiedSearchResponse } from '../types';
import { tmdbMovieSchema, tmdbTvSchema, tmdbSearchSchema, tmdbSeasonSchema } from './schemas';
import { normalizeTmdb, normalizeTmdbSearch, normalizeTmdbSeason } from './normalize';

type TmdbKind = 'movie' | 'tv';
interface TmdbOptions {
  transport: FetchTransport;
  endpoints: { details(kind: TmdbKind, id: string): string; search(kind: TmdbKind): string; season(id: string, season: number): string };
  bearerToken: string;
  imageBaseUrl: string;
}
export function createTmdbClient(options: TmdbOptions) {
  function request(url: string) {
    if (!options.bearerToken.trim()) throw new ProviderError('UNAUTHORIZED', 'tmdb');
    return options.transport.request({ provider: 'tmdb', method: 'GET', url, headers: { Authorization: `Bearer ${options.bearerToken}` } });
  }
  return {
    async details(kind: TmdbKind, id: string) {
      validateId(id, 'tmdb');
      const raw = await request(options.endpoints.details(kind, id));
      const media = kind === 'movie' ? parseProvider(tmdbMovieSchema, raw, 'tmdb') : parseProvider(tmdbTvSchema, raw, 'tmdb');
      return normalizeTmdb(media, options.imageBaseUrl);
    },
    async search(kind: TmdbKind, input: string): Promise<UnifiedSearchResponse> {
      const query = searchQuery(input, 'tmdb');
      const url = new URL(options.endpoints.search(kind));
      url.searchParams.set('query', query);
      const response = parseProvider(tmdbSearchSchema, await request(url.toString()), 'tmdb');
      const result: UnifiedSearchResponse = { query, items: [], partial: false, unavailableProviders: [] };
      for (const raw of response.results) {
        const parsed = (kind === 'movie' ? tmdbMovieSchema : tmdbTvSchema).safeParse(raw);
        if (parsed.success) result.items.push(normalizeTmdbSearch(parsed.data, options.imageBaseUrl));
        else result.partial = true;
      }
      return result;
    },
    async season(id: string, season: number) {
      validateId(id, 'tmdb');
      if (!Number.isSafeInteger(season) || season < 0) throw new ProviderError('INVALID_QUERY', 'tmdb');
      const parsed = parseProvider(tmdbSeasonSchema, await request(options.endpoints.season(id, season)), 'tmdb');
      return normalizeTmdbSeason(parsed, options.imageBaseUrl);
    },
  };
}
