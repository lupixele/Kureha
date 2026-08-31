import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { authMiddleware } from '../auth/middleware';
import { db } from '../db/client';
import { trackedMedia, watchedEpisodes } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { toCoreTrackedMedia, toDbTrackedMedia, toCoreWatchedEpisode, toDbWatchedEpisode } from '../db/adapter';
import { TrackedMedia, WatchedEpisode } from '../core/types';
import { unmarkWatched } from '../core/tracking';
import { deriveProgress, getEffectiveState } from '../core/progress';
import { z } from 'zod';

const unmarkWatchedSchema = z.object({
  mediaId: z.string().min(1),
  seasonNumber: z.number().int().nonnegative(),
  episodeNumber: z.number().int().nonnegative(),
});

export const unmarkWatchedFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(unmarkWatchedSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader('cache-control', 'no-store');
    setResponseHeader('vary', 'authorization');

    const userId = context.userId;
    if (!userId) {
      return { ok: false as const, error: 'Unauthorized' };
    }

    const { mediaId, seasonNumber, episodeNumber } = data;

    try {
      // Execute in a single transaction
      const result = await db.transaction(async (tx) => {
        // Fetch existing tracked media
        const [mediaRow] = await tx
          .select()
          .from(trackedMedia)
          .where(and(eq(trackedMedia.userId, userId), eq(trackedMedia.mediaId, mediaId)))
          .limit(1);

        if (!mediaRow) {
          throw new Error('MEDIA_NOT_FOUND');
        }

        // Fetch existing watched episode
        const [episodeRow] = await tx
          .select()
          .from(watchedEpisodes)
          .where(
            and(
              eq(watchedEpisodes.userId, userId),
              eq(watchedEpisodes.mediaId, mediaId),
              eq(watchedEpisodes.seasonNumber, seasonNumber),
              eq(watchedEpisodes.episodeNumber, episodeNumber)
            )
          )
          .limit(1);

        if (!episodeRow) {
          throw new Error('EPISODE_NOT_FOUND');
        }

        const media = toCoreTrackedMedia(mediaRow);
        const existing = toCoreWatchedEpisode(episodeRow);

        const coreResult = unmarkWatched(existing);

        if (coreResult === null) {
          // Delete the watched episode
          await tx
            .delete(watchedEpisodes)
            .where(
              and(
                eq(watchedEpisodes.userId, userId),
                eq(watchedEpisodes.mediaId, mediaId),
                eq(watchedEpisodes.seasonNumber, seasonNumber),
                eq(watchedEpisodes.episodeNumber, episodeNumber)
              )
            );
        } else {
          // Update the watched episode with the new rewatchCount
          const dbEpisode = toDbWatchedEpisode(coreResult);
          await tx
            .update(watchedEpisodes)
            .set(dbEpisode)
            .where(
              and(
                eq(watchedEpisodes.userId, userId),
                eq(watchedEpisodes.mediaId, mediaId),
                eq(watchedEpisodes.seasonNumber, seasonNumber),
                eq(watchedEpisodes.episodeNumber, episodeNumber)
              )
            );
        }

        // Fetch updated episode set for this media within transaction
        const updatedEpisodesRows = await tx
          .select()
          .from(watchedEpisodes)
          .where(
            and(
              eq(watchedEpisodes.userId, userId),
              eq(watchedEpisodes.mediaId, mediaId)
            )
          );

        const updatedMedia = toCoreTrackedMedia(mediaRow);
        const updatedWatchedEpisodes = updatedEpisodesRows.map(toCoreWatchedEpisode);
        const progress = deriveProgress(updatedMedia, updatedWatchedEpisodes);
        const effectiveState = getEffectiveState(updatedMedia, progress);

        return {
          media: updatedMedia,
          watchedEpisodes: updatedWatchedEpisodes,
          progress,
          effectiveState,
        };
      });

      return { ok: true as const, data: result };
    } catch (e: any) {
      return { ok: false as const, error: e.message };
    }
  });