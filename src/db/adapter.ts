import { TrackedMedia, WatchedEpisode, Progress, EffectiveState, Intent, MetadataSource, ReleaseState } from '../core/types';
import { TrackedMediaRow, NewTrackedMediaRow, WatchedEpisodeRow, NewWatchedEpisodeRow } from './schema';

// Adapter functions to convert between Drizzle rows and core types

export function toCoreTrackedMedia(row: TrackedMediaRow): TrackedMedia {
  return {
    userId: row.userId,
    mediaId: row.mediaId,
    mediaType: row.mediaType,
    metadataSource: row.metadataSource,
    intent: row.intent,
    totalEpisodes: row.totalEpisodes ?? null,
    releaseState: row.releaseState,
    intentChangedAt: row.intentChangedAt ?? null,
    addedAt: row.addedAt,
  };
}

export function toDbTrackedMedia(core: TrackedMedia): NewTrackedMediaRow {
  return {
    userId: core.userId,
    mediaId: core.mediaId,
    mediaType: core.mediaType,
    metadataSource: core.metadataSource,
    intent: core.intent,
    addedAt: core.addedAt,
    intentChangedAt: core.intentChangedAt ?? null,
    totalEpisodes: core.totalEpisodes ?? null,
    releaseState: core.releaseState,
  };
}

export function toCoreWatchedEpisode(row: WatchedEpisodeRow): WatchedEpisode {
  return {
    userId: row.userId,
    mediaId: row.mediaId,
    seasonNumber: row.seasonNumber,
    episodeNumber: row.episodeNumber,
    watchedAt: row.watchedAt,
    rewatchCount: row.rewatchCount,
  };
}

export function toDbWatchedEpisode(core: WatchedEpisode): NewWatchedEpisodeRow {
  return {
    userId: core.userId,
    mediaId: core.mediaId,
    seasonNumber: core.seasonNumber,
    episodeNumber: core.episodeNumber,
    watchedAt: core.watchedAt,
    rewatchCount: core.rewatchCount,
  };
}