import { TrackedMedia, WatchedEpisode, Intent, EpisodeRef } from './types';

// Helper to simulate "now" in a pure way. In a real app this might be injected.
const now = () => Math.floor(Date.now() / 1000);

export function markWatched(input: {
  mediaInfo: { userId: string, mediaId: string, mediaType: 'movie' | 'series' | 'anime', totalEpisodes: number | null, releaseState: import('./types').ReleaseState },
  media: TrackedMedia | null,
  existing: WatchedEpisode | null,
  target: { seasonNumber: number; episodeNumber: number },
  currentTime?: number
}): { media: TrackedMedia; episode: WatchedEpisode } {
  const currentTime = input.currentTime ?? now();
  let resolvedMedia: TrackedMedia;
  
  if (input.media) {
    resolvedMedia = { ...input.media };
    if (resolvedMedia.intent === 'paused' || resolvedMedia.intent === 'watch_later') {
      resolvedMedia.intent = 'active';
      resolvedMedia.intentChangedAt = currentTime;
    }
  } else {
    // Auto-create from mediaInfo
    resolvedMedia = {
      userId: input.mediaInfo.userId,
      mediaId: input.mediaInfo.mediaId,
      mediaType: input.mediaInfo.mediaType,
      metadataSource: 'tmdb',
      intent: 'active',
      totalEpisodes: input.mediaInfo.totalEpisodes,
      releaseState: input.mediaInfo.releaseState,
      addedAt: currentTime,
      intentChangedAt: null
    };
  }

  let episode: WatchedEpisode;
  if (input.existing) {
    episode = {
      ...input.existing,
      rewatchCount: input.existing.rewatchCount + 1
    };
  } else {
    episode = {
      userId: resolvedMedia.userId,
      mediaId: resolvedMedia.mediaId,
      seasonNumber: input.target.seasonNumber,
      episodeNumber: input.target.episodeNumber,
      watchedAt: currentTime,
      rewatchCount: 1
    };
  }

  return { media: resolvedMedia, episode };
}

export function unmarkWatched(existing: WatchedEpisode): WatchedEpisode | null {
  if (existing.rewatchCount > 1) {
    return {
      ...existing,
      rewatchCount: existing.rewatchCount - 1
    };
  }
  return null; // Signals deletion
}

export function setIntent(media: TrackedMedia, newIntent: Intent, currentTime: number = now()): TrackedMedia {
  if (media.intent === newIntent) return media;
  return {
    ...media,
    intent: newIntent,
    intentChangedAt: currentTime
  };
}

export function getSkippedEpisodes(
  allKnownEpisodes: EpisodeRef[],
  watchedEpisodes: WatchedEpisode[],
  target: EpisodeRef
): EpisodeRef[] {
  // Sort known episodes just to be safe
  const sortedKnown = [...allKnownEpisodes].sort((a, b) => 
    a.seasonNumber !== b.seasonNumber ? a.seasonNumber - b.seasonNumber : a.episodeNumber - b.episodeNumber
  );

  // Find the target index
  const targetIndex = sortedKnown.findIndex(e => e.seasonNumber === target.seasonNumber && e.episodeNumber === target.episodeNumber);
  if (targetIndex === -1) return []; // target not in known list

  // Find the maximum watched episode index
  let maxWatchedIndex = -1;
  for (const watched of watchedEpisodes) {
    const idx = sortedKnown.findIndex(e => e.seasonNumber === watched.seasonNumber && e.episodeNumber === watched.episodeNumber);
    if (idx > maxWatchedIndex) {
      maxWatchedIndex = idx;
    }
  }

  // If nothing watched, maxWatchedIndex is -1.
  // We want episodes between maxWatchedIndex and targetIndex (exclusive of target, or inclusive?)
  // Spec: "Returns episodes between the last-watched point and `target` with no watched row."
  // Wait, if target is S01E05, and max watched is S01E03, skipped is S01E04.
  const skipped: EpisodeRef[] = [];
  const startIndex = Math.max(0, maxWatchedIndex + 1);

  for (let i = startIndex; i < targetIndex; i++) {
    const ep = sortedKnown[i];
    const isWatched = watchedEpisodes.some(w => w.seasonNumber === ep.seasonNumber && w.episodeNumber === ep.episodeNumber);
    if (!isWatched) {
      skipped.push(ep);
    }
  }

  return skipped;
}

export function rewatchSeason(
  media: TrackedMedia,
  seasonEpisodes: EpisodeRef[],
  existingWatched: WatchedEpisode[],
  currentTime: number = now()
): WatchedEpisode[] {
  return seasonEpisodes.map(ep => {
    const existing = existingWatched.find(w => w.seasonNumber === ep.seasonNumber && w.episodeNumber === ep.episodeNumber);
    if (existing) {
      return {
        ...existing,
        rewatchCount: existing.rewatchCount + 1
        // watchedAt unchanged
      };
    } else {
      return {
        userId: media.userId,
        mediaId: media.mediaId,
        seasonNumber: ep.seasonNumber,
        episodeNumber: ep.episodeNumber,
        watchedAt: currentTime,
        rewatchCount: 1
      };
    }
  });
}
