import { describe, it, expect } from 'vitest';
import { toCoreTrackedMedia, toDbTrackedMedia, toCoreWatchedEpisode, toDbWatchedEpisode } from '../src/db/adapter';
import { TrackedMedia, WatchedEpisode } from '../src/core/types';
import { TrackedMediaRow, WatchedEpisodeRow } from '../src/db/schema';

describe('DB Adapters', () => {
  it('toCoreTrackedMedia correctly handles null values', () => {
    const row = {
      userId: 'user-1',
      mediaId: 'media-1',
      mediaType: 'series' as const,
      metadataSource: 'tmdb' as const,
      intent: 'active' as const,
      addedAt: 1000,
      intentChangedAt: null,
      totalEpisodes: null,
      releaseState: 'ongoing' as const,
    };

    const core = toCoreTrackedMedia(row);
    expect(core.intentChangedAt).toBeNull();
    expect(core.totalEpisodes).toBeNull();
  });

  it('toDbTrackedMedia maps optional/null properties explicitly to null', () => {
    const core: TrackedMedia = {
      userId: 'user-1',
      mediaId: 'media-1',
      mediaType: 'series',
      metadataSource: 'tmdb',
      intent: 'active',
      addedAt: 1000,
      intentChangedAt: null,
      totalEpisodes: null,
      releaseState: 'ongoing',
    };

    const dbRow = toDbTrackedMedia(core);
    expect(dbRow.intentChangedAt).toBeNull();
    expect(dbRow.totalEpisodes).toBeNull();
  });

  it('toCoreWatchedEpisode maps correctly', () => {
    const row = {
      userId: 'user-1',
      mediaId: 'media-1',
      seasonNumber: 1,
      episodeNumber: 1,
      watchedAt: 2000,
      rewatchCount: 2,
    };

    const core = toCoreWatchedEpisode(row);
    expect(core.rewatchCount).toBe(2);
    expect(core.watchedAt).toBe(2000);
  });

  it('toDbWatchedEpisode maps correctly', () => {
    const core: WatchedEpisode = {
      userId: 'user-1',
      mediaId: 'media-1',
      seasonNumber: 1,
      episodeNumber: 1,
      watchedAt: 2000,
      rewatchCount: 2,
    };

    const dbRow = toDbWatchedEpisode(core);
    expect(dbRow.rewatchCount).toBe(2);
    expect(dbRow.watchedAt).toBe(2000);
  });
});
