import { describe, it, expect } from 'vitest';
import { deriveProgress, getEffectiveState } from '../src/core/progress';
import { markWatched, unmarkWatched, setIntent, getSkippedEpisodes, rewatchSeason } from '../src/core/tracking';
import { TrackedMedia, WatchedEpisode, EpisodeRef, Intent, Progress, ReleaseState } from '../src/core/types';

describe('Tracking Core Logic (Phase 1 Fixtures)', () => {
  const USER_ID = 'test-user-1';

  // Helpers to create base objects
  const createMedia = (
    mediaId: string, 
    mediaType: 'movie' | 'series' | 'anime', 
    totalEpisodes: number | null, 
    releaseState: ReleaseState,
    intent: Intent = 'active'
  ): TrackedMedia => ({
    userId: USER_ID,
    mediaId,
    mediaType,
    metadataSource: 'tmdb',
    intent,
    totalEpisodes,
    releaseState,
    addedAt: 1000,
    intentChangedAt: null
  });

  const createEpisode = (mediaId: string, seasonNumber: number, episodeNumber: number, rewatchCount: number = 1, watchedAt: number = 1000): WatchedEpisode => ({
    userId: USER_ID,
    mediaId,
    seasonNumber,
    episodeNumber,
    watchedAt,
    rewatchCount
  });

  it('Scenario 1: New movie added, not watched -> deriveProgress = not_started', () => {
    const media = createMedia('mov1', 'movie', null, 'released');
    const progress = deriveProgress(media, []);
    expect(progress).toBe('not_started');
  });

  it('Scenario 2: Movie marked watched -> deriveProgress = finished', () => {
    const media = createMedia('mov1', 'movie', null, 'released');
    const ep = createEpisode('mov1', 0, 0);
    const progress = deriveProgress(media, [ep]);
    expect(progress).toBe('finished');
  });

  it('Scenario 3: Ongoing series, all currently-available episodes watched -> caught_up', () => {
    // 3 episodes out so far
    const media = createMedia('series1', 'series', 3, 'ongoing');
    const eps = [
      createEpisode('series1', 1, 1),
      createEpisode('series1', 1, 2),
      createEpisode('series1', 1, 3)
    ];
    const progress = deriveProgress(media, eps);
    expect(progress).toBe('caught_up');
  });

  it('Scenario 4: Same series, provider adds a new episode -> next deriveProgress call -> in_progress', () => {
    // We update totalEpisodes to 4, simulating provider adding an episode
    const media = createMedia('series1', 'series', 4, 'ongoing');
    const eps = [
      createEpisode('series1', 1, 1),
      createEpisode('series1', 1, 2),
      createEpisode('series1', 1, 3)
    ];
    const progress = deriveProgress(media, eps);
    expect(progress).toBe('in_progress');
  });

  it('Scenario 5: Ended series, all episodes watched -> finished', () => {
    const media = createMedia('series1', 'series', 3, 'ended');
    const eps = [
      createEpisode('series1', 1, 1),
      createEpisode('series1', 1, 2),
      createEpisode('series1', 1, 3)
    ];
    const progress = deriveProgress(media, eps);
    expect(progress).toBe('finished');
  });

  it('Scenario 6: Paused show with existing watched episodes -> deriveProgress unaffected by intent; isNotifiable = false', () => {
    const media = createMedia('series1', 'series', 3, 'ongoing', 'paused');
    const eps = [
      createEpisode('series1', 1, 1),
      createEpisode('series1', 1, 2),
      createEpisode('series1', 1, 3)
    ];
    const progress = deriveProgress(media, eps);
    expect(progress).toBe('caught_up'); // Unaffected by paused intent

    const effectiveState = getEffectiveState(media, progress);
    expect(effectiveState.isNotifiable).toBe(false);
  });

  it('Scenario 7: Watch Later, nothing watched yet -> deriveProgress = not_started, isNotifiable = false', () => {
    const media = createMedia('series1', 'series', 12, 'ongoing', 'watch_later');
    const progress = deriveProgress(media, []);
    expect(progress).toBe('not_started');

    const effectiveState = getEffectiveState(media, progress);
    expect(effectiveState.isNotifiable).toBe(false);
  });

  it('Scenario 8a: rewatching an already-watched episode increments rewatch_count', () => {
    const media = createMedia('series1', 'series', 12, 'ongoing');
    const ep = createEpisode('series1', 1, 1, 1, 1000);
    
    const result = markWatched({
      mediaInfo: { userId: USER_ID, mediaId: 'series1', mediaType: 'series', totalEpisodes: 12, releaseState: 'ongoing' },
      media,
      existing: ep,
      target: { seasonNumber: 1, episodeNumber: 1 },
      currentTime: 2000
    });
    expect(result.episode.rewatchCount).toBe(2);
  });

  it('Scenario 8b: rewatching an already-watched episode does not change watched_at', () => {
    const media = createMedia('series1', 'series', 12, 'ongoing');
    const ep = createEpisode('series1', 1, 1, 1, 1000);
    
    const result = markWatched({
      mediaInfo: { userId: USER_ID, mediaId: 'series1', mediaType: 'series', totalEpisodes: 12, releaseState: 'ongoing' },
      media,
      existing: ep,
      target: { seasonNumber: 1, episodeNumber: 1 },
      currentTime: 2000
    });
    expect(result.episode.watchedAt).toBe(1000); // Should still be initial watch time
  });

  it('Scenario 8c: unmarking decrements rewatch_count if >1, deletes the row if =1', () => {
    const epCount2 = createEpisode('series1', 1, 1, 2);
    const unmarkedEpCount2 = unmarkWatched(epCount2);
    expect(unmarkedEpCount2).not.toBeNull();
    expect(unmarkedEpCount2?.rewatchCount).toBe(1);

    const epCount1 = createEpisode('series1', 1, 1, 1);
    const unmarkedEpCount1 = unmarkWatched(epCount1);
    expect(unmarkedEpCount1).toBeNull(); // deleted
  });

  it('Scenario 9: Watching directly overrides paused/watch_later intent -> intent auto-flips to active', () => {
    const media = createMedia('series1', 'series', 12, 'ongoing', 'watch_later');
    
    const result = markWatched({
      mediaInfo: { userId: USER_ID, mediaId: 'series1', mediaType: 'series', totalEpisodes: 12, releaseState: 'ongoing' },
      media,
      existing: null,
      target: { seasonNumber: 1, episodeNumber: 1 },
      currentTime: 2000
    });
    expect(result.media.intent).toBe('active');
    expect(result.media.intentChangedAt).toBe(2000);
  });

  it('Scenario 10: Skipped episode detection -> watched S01E01-03, mark S01E05 watched -> returns S01E04 only', () => {
    const knownEps: EpisodeRef[] = [
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 1, episodeNumber: 2 },
      { seasonNumber: 1, episodeNumber: 3 },
      { seasonNumber: 1, episodeNumber: 4 },
      { seasonNumber: 1, episodeNumber: 5 },
      { seasonNumber: 1, episodeNumber: 6 }
    ];
    
    const watched: WatchedEpisode[] = [
      createEpisode('series1', 1, 1),
      createEpisode('series1', 1, 2),
      createEpisode('series1', 1, 3)
    ];

    const target: EpisodeRef = { seasonNumber: 1, episodeNumber: 5 };
    const skipped = getSkippedEpisodes(knownEps, watched, target);
    
    expect(skipped).toHaveLength(1);
    expect(skipped[0].seasonNumber).toBe(1);
    expect(skipped[0].episodeNumber).toBe(4);
  });

  it('Scenario 11: Season rewatch, partial prior coverage -> watched E01-03, call rewatchSeason on 4 eps -> E01-03 count=2, E04 count=1', () => {
    const media = createMedia('series1', 'series', 12, 'ongoing');
    const seasonEps: EpisodeRef[] = [
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 1, episodeNumber: 2 },
      { seasonNumber: 1, episodeNumber: 3 },
      { seasonNumber: 1, episodeNumber: 4 }
    ];
    
    const watched: WatchedEpisode[] = [
      createEpisode('series1', 1, 1, 1, 1000),
      createEpisode('series1', 1, 2, 1, 1000),
      createEpisode('series1', 1, 3, 1, 1000)
    ];

    const rewatched = rewatchSeason(media, seasonEps, watched, 5000);
    
    expect(rewatched).toHaveLength(4);
    
    const ep1 = rewatched.find(e => e.episodeNumber === 1);
    expect(ep1?.rewatchCount).toBe(2);
    expect(ep1?.watchedAt).toBe(1000); // Unchanged

    const ep2 = rewatched.find(e => e.episodeNumber === 2);
    expect(ep2?.rewatchCount).toBe(2);
    
    const ep3 = rewatched.find(e => e.episodeNumber === 3);
    expect(ep3?.rewatchCount).toBe(2);

    const ep4 = rewatched.find(e => e.episodeNumber === 4);
    expect(ep4?.rewatchCount).toBe(1); // Created fresh
    expect(ep4?.watchedAt).toBe(5000); // Fresh watch time
  });

  it('Scenario 12: Unreleased title -> deriveProgress = unreleased regardless of any watch data present', () => {
    const media = createMedia('series1', 'series', 12, 'unreleased');
    // Simulating weird state where there is watch data for an unreleased title
    const eps = [createEpisode('series1', 1, 1)];
    const progress = deriveProgress(media, eps);
    expect(progress).toBe('unreleased');
  });

  it('Scenario 13: dropped -> active -> silent field update, no side effects on watch data', () => {
    const media = createMedia('series1', 'series', 12, 'ongoing', 'dropped');
    const updatedMedia = setIntent(media, 'active', 3000);
    
    expect(updatedMedia.intent).toBe('active');
    expect(updatedMedia.intentChangedAt).toBe(3000);
  });

  it('Scenario 14: Auto-add-to-library: marking watched on null media creates new TrackedMedia row with active intent', () => {
    const result = markWatched({
      mediaInfo: { userId: USER_ID, mediaId: 'new-series', mediaType: 'series', totalEpisodes: 24, releaseState: 'ongoing' },
      media: null,
      existing: null,
      target: { seasonNumber: 1, episodeNumber: 1 },
      currentTime: 1500
    });
    
    expect(result.media.intent).toBe('active');
    expect(result.media.userId).toBe(USER_ID);
    expect(result.media.mediaId).toBe('new-series');
    expect(result.media.addedAt).toBe(1500);
    expect(result.media.intentChangedAt).toBeNull();
    
    expect(result.episode.rewatchCount).toBe(1);
    expect(result.episode.watchedAt).toBe(1500);
  });

  it('Scenario 15: getSkippedEpisodes with unrecognized watched episode ignores it', () => {
    const knownEps: EpisodeRef[] = [
      { seasonNumber: 1, episodeNumber: 1 },
      { seasonNumber: 1, episodeNumber: 2 },
      { seasonNumber: 1, episodeNumber: 3 }
    ];
    
    // We pass an episode not in knownEps (e.g., S01E05)
    const watched: WatchedEpisode[] = [
      createEpisode('series1', 1, 1),
      createEpisode('series1', 1, 5) // Not recognized
    ];

    const target: EpisodeRef = { seasonNumber: 1, episodeNumber: 3 };
    const skipped = getSkippedEpisodes(knownEps, watched, target);
    
    // The max watched index from knownEps should be 0 (for S01E01). S01E05 is ignored.
    // So target is S01E03, skipped should be S01E02.
    expect(skipped).toHaveLength(1);
    expect(skipped[0].seasonNumber).toBe(1);
    expect(skipped[0].episodeNumber).toBe(2);
  });
});
