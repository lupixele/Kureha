import { foreignKey, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import type { Intent, MetadataSource, ReleaseState, TrackedMedia } from '../core/types';

export const trackedMedia = pgTable(
  'tracked_media',
  {
    userId: text('user_id').notNull(),
    mediaId: text('media_id').notNull(),
    mediaType: text('media_type').notNull().$type<TrackedMedia['mediaType']>(),
    metadataSource: text('metadata_source').notNull().default('tmdb').$type<MetadataSource>(),
    intent: text('intent').notNull().default('active').$type<Intent>(),
    addedAt: integer('added_at').notNull(),
    intentChangedAt: integer('intent_changed_at'),
    totalEpisodes: integer('total_episodes'),
    releaseState: text('release_state').notNull().$type<ReleaseState>(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.mediaId] }),
  ],
);

export const watchedEpisodes = pgTable(
  'watched_episodes',
  {
    userId: text('user_id').notNull(),
    mediaId: text('media_id').notNull(),
    seasonNumber: integer('season_number').notNull().default(0),
    episodeNumber: integer('episode_number').notNull(),
    watchedAt: integer('watched_at').notNull(),
    rewatchCount: integer('rewatch_count').notNull().default(1),
  },
  (table) => [
    primaryKey({
      columns: [table.userId, table.mediaId, table.seasonNumber, table.episodeNumber],
    }),
    foreignKey({
      columns: [table.userId, table.mediaId],
      foreignColumns: [trackedMedia.userId, trackedMedia.mediaId],
    }),
  ],
);

export type TrackedMediaRow = typeof trackedMedia.$inferSelect;
export type NewTrackedMediaRow = typeof trackedMedia.$inferInsert;
export type WatchedEpisodeRow = typeof watchedEpisodes.$inferSelect;
export type NewWatchedEpisodeRow = typeof watchedEpisodes.$inferInsert;
