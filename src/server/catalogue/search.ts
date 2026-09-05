import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db as defaultDb } from '../../db/client';
import {
  mediaGroups,
  continuityTracks,
  installments,
  episodes,
  providerMappings,
  releaseStateEvidence,
} from '../../db/schema';
import { ProviderError } from '../providers/errors';
import { searchQuery } from '../providers/types';

export interface SearchOptions {
  query: string;
  type?: 'anime' | 'movie' | 'tv';
  limit?: number;
}

export interface UnifiedSearchResult {
  items: {
    provider: 'anilist' | 'tmdb';
    providerId: string;
    title: string;
    format: string;
    year?: number | null;
    posterUrl?: string | null;
    isAnime: boolean;
    uncertainAnime: boolean;
    importAllowed: boolean;
    existingMediaGroupId?: string | null;
  }[];
  partial: boolean;
  unavailableProviders: string[];
}

export async function searchCatalogue(
  options: SearchOptions,
  ctx: {
    db?: any;
    aniListClient?: any;
    tmdbClient?: any;
  } = {}
): Promise<UnifiedSearchResult> {
  const db = ctx.db || defaultDb;
  const validatedQuery = searchQuery(options.query, 'anilist');
  const items: UnifiedSearchResult['items'] = [];
  const unavailable: string[] = [];

  // 1. Concurrent queries to AniList and TMDB
  const promises: Promise<void>[] = [];

  if (ctx.aniListClient) {
    promises.push(
      ctx.aniListClient
        .search(validatedQuery)
        .then((res: any) => {
          for (const it of res.items || []) {
            items.push({
              provider: 'anilist',
              providerId: it.providerId,
              title: it.title,
              format: it.format || 'TV',
              year: it.year,
              posterUrl: it.posterUrl,
              isAnime: true,
              uncertainAnime: false,
              importAllowed: true,
            });
          }
        })
        .catch(() => {
          unavailable.push('anilist');
        })
    );
  }

  if (ctx.tmdbClient) {
    promises.push(
      ctx.tmdbClient
        .search('movie', validatedQuery)
        .then((res: any) => {
          for (const it of res.items || []) {
            items.push({
              provider: 'tmdb',
              providerId: it.providerId,
              title: it.title,
              format: 'Movie',
              year: it.year,
              posterUrl: it.posterUrl,
              isAnime: false,
              uncertainAnime: false,
              importAllowed: true,
            });
          }
        })
        .catch(() => {
          unavailable.push('tmdb');
        })
    );
  }

  await Promise.all(promises);

  // 2. Cross-reference existing provider mappings in Kureha
  for (const item of items) {
    const existing = await db
      .select({ mediaGroupId: providerMappings.mediaGroupId, installmentId: providerMappings.installmentId })
      .from(providerMappings)
      .where(and(eq(providerMappings.provider, item.provider), eq(providerMappings.providerId, item.providerId)))
      .limit(1);

    if (existing.length > 0) {
      if (existing[0].mediaGroupId) {
        item.existingMediaGroupId = existing[0].mediaGroupId;
      } else if (existing[0].installmentId) {
        const inst = await db
          .select({ mediaGroupId: continuityTracks.mediaGroupId })
          .from(installments)
          .innerJoin(continuityTracks, eq(installments.continuityTrackId, continuityTracks.id))
          .where(eq(installments.id, existing[0].installmentId))
          .limit(1);
        if (inst.length > 0) {
          item.existingMediaGroupId = inst[0].mediaGroupId;
        }
      }
    }
  }

  return {
    items,
    partial: unavailable.length > 0,
    unavailableProviders: unavailable,
  };
}

export async function getCanonicalMediaDetails(
  mediaGroupId: string,
  db: any = defaultDb
) {
  const group = await db
    .select()
    .from(mediaGroups)
    .where(eq(mediaGroups.id, mediaGroupId))
    .limit(1);

  if (!group || group.length === 0) {
    throw new ProviderError('INVALID_QUERY', 'anilist');
  }

  const tracks = await db
    .select()
    .from(continuityTracks)
    .where(eq(continuityTracks.mediaGroupId, mediaGroupId));

  const trackIds = tracks.map((t: any) => t.id);
  const insts = trackIds.length > 0
    ? await db
        .select()
        .from(installments)
        .where(sql`${installments.continuityTrackId} IN (${sql.join(trackIds.map((id: any) => sql`${id}`), sql`, `)})`)
        .orderBy(installments.sequenceNumber)
    : [];

  const instIds = insts.map((i: any) => i.id);
  const eps = instIds.length > 0
    ? await db
        .select()
        .from(episodes)
        .where(sql`${episodes.installmentId} IN (${sql.join(instIds.map((id: any) => sql`${id}`), sql`, `)})`)
        .orderBy(episodes.episodeNumber)
    : [];

  return {
    mediaGroup: group[0],
    continuityTracks: tracks,
    installments: insts,
    episodes: eps,
  };
}
