import { z } from 'zod';
import { ProviderError } from './errors';

export type Provider = CanonicalProvider | EnrichmentProvider;
export type OptionalResult<T> = { ok: true; data: T } | { ok: false; error: ProviderError };
export type SchemaDrift = { provider: Provider; field: 'status' | 'relationType' };
export type NormalizedDetails = { installment: NormalizedInstallment; relations: NormalizedRelation[]; artwork: NormalizedArtworkCandidate[]; drift: SchemaDrift[] };

export const providerIdSchema = z.union([z.string().regex(/^[1-9]\d*$/), z.number().int().positive().max(Number.MAX_SAFE_INTEGER).transform(String)]);
export function validateId(id: string, provider: Provider, numeric = false): string {
  if (!/^[1-9]\d*$/.test(id) || (numeric && !Number.isSafeInteger(Number(id)))) throw new ProviderError('UNKNOWN_PROVIDER_ID', provider);
  return id;
}
export function searchQuery(query: string, provider: Provider): string {
  const value = query.trim();
  if ([...value].length < 1 || [...value].length > 100) throw new ProviderError('INVALID_QUERY', provider);
  return value.normalize('NFC');
}
export function parseProvider<T>(schema: z.ZodType<T>, value: unknown, provider: Provider): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new ProviderError('PROVIDER_SCHEMA_CHANGED', provider);
  return result.data;
}
export function calendarDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}
export function artworkCandidate(provider: ArtworkProvider, assetId: string, kind: ArtworkKind, url: string, payloadHash: string): NormalizedArtworkCandidate {
  return { provider, providerAssetId: assetId, kind, urlOrPath: url, language: null, voteScore: null, width: null, height: null, sourceMappingId: null, payloadHash };
}

export type CanonicalProvider = 'anilist' | 'tmdb';
export type EnrichmentProvider = 'anizip' | 'fanart';
export type SearchMediaKind = 'anime' | 'movie' | 'series' | 'uncertain_anime';

export type ProviderRef = {
  provider: CanonicalProvider | 'tvdb' | 'mal' | 'anidb';
  providerId: string;
  target: 'anime' | 'movie' | 'tv' | 'episode';
};

export type UnifiedSearchItem = {
  source: 'anilist' | 'tmdb';
  providerId: string;
  mediaKind: SearchMediaKind;
  title: string;
  alternateTitle: string | null;
  releaseYear: number | null;
  format: string | null;
  coverUrl: string | null;
  existingMediaGroupId: string | null;
  importAllowed: boolean;
  importBlockReason: 'uncertain_anime' | null;
};

export type UnifiedSearchResponse = {
  query: string;
  items: UnifiedSearchItem[];
  partial: boolean;
  unavailableProviders: Array<'anilist' | 'tmdb'>;
};

export type NormalizedInstallment = {
  source: 'anilist' | 'tmdb';
  providerId: string;
  title: string;
  format: string;
  status: 'not_yet_released' | 'releasing' | 'finished' | 'cancelled' | 'hiatus' | 'unknown';
  startDate: string | null;
  endDate: string | null;
  totalEpisodes: number | null;
  nextAiringEpisode: number | null;
  nextAiringTime: string | null;
  payloadHash: string;
};

export type NormalizedRelation = {
  sourceProviderId: string;
  targetProviderId: string;
  relationType:
    | 'PREQUEL' | 'SEQUEL' | 'PARENT' | 'SIDE_STORY'
    | 'CHARACTER' | 'SUMMARY' | 'ALTERNATIVE' | 'SPIN_OFF'
    | 'ADAPTATION' | 'SOURCE' | 'COMPILATION' | 'CONTAINS'
    | 'SAME_UNIVERSE' | 'OTHER';
  targetFormat: string | null;
  targetIsAdult: boolean;
};

export type NormalizedEpisodeSeed = {
  providerEpisodeId: string | null;
  episodeNumber: number;
  title: string | null;
  airDate: string | null;
  airTimeUtc: string | null;
  runtimeMinutes: number | null;
  imageUrl: string | null;
  isExtra: boolean;
};

export type ArtworkKind = 'title_logo' | 'cover' | 'backdrop';
export type ArtworkProvider = 'anilist' | 'tmdb' | 'fanart';

export type NormalizedArtworkCandidate = {
  provider: ArtworkProvider;
  providerAssetId: string;
  kind: ArtworkKind;
  urlOrPath: string;
  language: string | null;
  voteScore: number | null;
  width: number | null;
  height: number | null;
  sourceMappingId: string | null;
  payloadHash: string;
};

