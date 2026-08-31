import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { trackedMedia, watchedEpisodes } from '../src/db/schema';

describe('Database Schema (Drizzle Postgres)', () => {
  it('should define tracked_media table correctly', () => {
    expect(getTableName(trackedMedia)).toBe('tracked_media');
    expect(trackedMedia.userId.name).toBe('user_id');
    expect(trackedMedia.mediaId.name).toBe('media_id');
    expect(trackedMedia.mediaType.name).toBe('media_type');
    expect(trackedMedia.metadataSource.name).toBe('metadata_source');
    expect(trackedMedia.metadataSource.default).toBe('tmdb');
    expect(trackedMedia.intent.name).toBe('intent');
    expect(trackedMedia.intent.default).toBe('active');
    expect(trackedMedia.addedAt.name).toBe('added_at');
    expect(trackedMedia.releaseState.name).toBe('release_state');
  });

  it('should define watched_episodes table correctly', () => {
    expect(getTableName(watchedEpisodes)).toBe('watched_episodes');
    expect(watchedEpisodes.userId.name).toBe('user_id');
    expect(watchedEpisodes.mediaId.name).toBe('media_id');
    expect(watchedEpisodes.seasonNumber.name).toBe('season_number');
    expect(watchedEpisodes.seasonNumber.default).toBe(0);
    expect(watchedEpisodes.episodeNumber.name).toBe('episode_number');
    expect(watchedEpisodes.watchedAt.name).toBe('watched_at');
    expect(watchedEpisodes.rewatchCount.name).toBe('rewatch_count');
    expect(watchedEpisodes.rewatchCount.default).toBe(1);
  });
});
