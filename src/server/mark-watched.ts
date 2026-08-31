import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { authMiddleware } from '../auth/middleware';
import { db } from '../db/client';
import { trackedMedia, watchedEpisodes } from '../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { toCoreTrackedMedia, toDbTrackedMedia, toCoreWatchedEpisode, toDbWatchedEpisode } from '../db/adapter';
import { TrackedMedia, WatchedEpisode } from '../core/types';
import { markWatched } from '../core/tracking';
import { deriveProgress, getEffectiveState } from '../core/progress';
import { ReleaseState } from '../core/types';
import { z } from 'zod';

const markWatchedSchema = z.object({
  mediaId: z.string().min(1),
  mediaType: z.enum(['movie', 'series', 'anime']),
  totalEpisodes: z.number().int().nonnegative().nullable(),
  releaseState: z.enum(['unreleased', 'released', 'ongoing', 'ended']),
  seasonNumber: z.number().int().nonnegative(),
  episodeNumber: z.number().int().nonnegative(),
});

export async function executeMarkWatched(userId: string, data: z.infer<typeof markWatchedSchema>) {
  const { mediaId, mediaType, totalEpisodes, releaseState, seasonNumber, episodeNumber } = data;

  const now = Math.floor(Date.now() / 1000);

  const mediaInfo = {
    userId,
    mediaId,
    mediaType,
    totalEpisodes: totalEpisodes === null ? null : Number(totalEpisodes),
    releaseState,
  };

  // Execute everything in a single transaction
  try {
    const result = await db.transaction(async (tx) => {
      // Fetch existing tracked media and watched episode (for update)
      const [existingMediaRow] = await tx
        .select()
        .from(trackedMedia)
        .where(and(eq(trackedMedia.userId, userId), eq(trackedMedia.mediaId, mediaId)))
        .limit(1);

      const [existingEpisodeRow] = await tx
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

      const media = existingMediaRow ? toCoreTrackedMedia(existingMediaRow) : null;
      const existing = existingEpisodeRow ? toCoreWatchedEpisode(existingEpisodeRow) : null;

      const coreResult = markWatched({
        mediaInfo,
        media,
        existing,
        target: { seasonNumber, episodeNumber },
        currentTime: now,
      });

      // Upsert tracked_media on composite PK (userId, mediaId)
      const dbMedia = toDbTrackedMedia(coreResult.media);
      await tx
        .insert(trackedMedia)
        .values(dbMedia)
        .onConflictDoUpdate({
          target: [trackedMedia.userId, trackedMedia.mediaId],
          set: dbMedia,
        });

      // Upsert watched_episodes on composite PK with database-side increment for conflict
      if (coreResult.episode.rewatchCount === 1 && !existing) {
        // First watch - insert new row
        const dbEpisode = toDbWatchedEpisode(coreResult.episode);
        await tx.insert(watchedEpisodes).values(dbEpisode);
      } else {
        // Rewatch - increment rewatchCount atomically, preserve watchedAt
        await tx
          .insert(watchedEpisodes)
          .values({
            userId: coreResult.episode.userId,
            mediaId: coreResult.episode.mediaId,
            seasonNumber: coreResult.episode.seasonNumber,
            episodeNumber: coreResult.episode.episodeNumber,
            watchedAt: coreResult.episode.watchedAt,
            rewatchCount: coreResult.episode.rewatchCount,
          })
          .onConflictDoUpdate({
            target: [watchedEpisodes.userId, watchedEpisodes.mediaId, watchedEpisodes.seasonNumber, watchedEpisodes.episodeNumber],
            set: {
              rewatchCount: sql`${watchedEpisodes.rewatchCount} + 1`,
            },
          });
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

      const updatedMedia = toCoreTrackedMedia(coreResult.media);
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
}

export const markWatchedFn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(markWatchedSchema)
  .handler(async ({ context, data }) => {
    setResponseHeader('cache-control', 'no-store');
    setResponseHeader('vary', 'authorization');

    const userId = context.userId;
    if (!userId) {
      return { ok: false as const, error: 'Unauthorized' };
    }

    return executeMarkWatched(userId, data);
  });