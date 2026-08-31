import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { authMiddleware } from '../auth/middleware';
import { db } from '../db/client';
import { trackedMedia, watchedEpisodes } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { toCoreTrackedMedia, toCoreWatchedEpisode } from '../db/adapter';
import { TrackedMedia, WatchedEpisode, Progress, EffectiveState } from '../core/types';
import { deriveProgress, getEffectiveState } from '../core/progress';

export const getLibrary = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    setResponseHeader('cache-control', 'no-store');
    setResponseHeader('vary', 'authorization');

    const userId = context.userId;
    if (!userId) {
      return { ok: false as const, error: 'Unauthorized' };
    }

    try {
      // Fetch all tracked media for the user
      const mediaRows = await db
        .select()
        .from(trackedMedia)
        .where(eq(trackedMedia.userId, userId));

      // Fetch all watched episodes for the user in a single query
      const allEpisodesRows = await db
        .select()
        .from(watchedEpisodes)
        .where(eq(watchedEpisodes.userId, userId));

      // Group episodes by mediaId
      const episodesByMediaId = new Map<string, WatchedEpisodeRow[]>();
      for (const epRow of allEpisodesRows) {
        const existing = episodesByMediaId.get(epRow.mediaId) ?? [];
        existing.push(epRow);
        episodesByMediaId.set(epRow.mediaId, existing);
      }

      // Map each media with its episodes
      const mediaWithEpisodes = mediaRows.map((mediaRow) => {
        const episodesRows = episodesByMediaId.get(mediaRow.mediaId) ?? [];
        const media = toCoreTrackedMedia(mediaRow);
        const watchedEpisodesCore = episodesRows.map(toCoreWatchedEpisode);
        const progress = deriveProgress(media, watchedEpisodesCore);
        const effectiveState = getEffectiveState(media, progress);

        return {
          media,
          watchedEpisodes: watchedEpisodesCore,
          progress,
          effectiveState,
        };
      });

      return { ok: true as const, data: mediaWithEpisodes };
    } catch (error) {
      console.error('Error in getLibrary:', error);
      return { ok: false as const, error: 'Internal Server Error' };
    }
  });

type WatchedEpisodeRow = {
  userId: string;
  mediaId: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: number;
  rewatchCount: number;
};