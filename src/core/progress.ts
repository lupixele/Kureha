import { TrackedMedia, WatchedEpisode, Progress, EffectiveState } from './types';

export function deriveProgress(
  media: TrackedMedia,
  watchedEpisodes: WatchedEpisode[]
): Progress {
  if (media.releaseState === 'unreleased') {
    return 'unreleased';
  }

  const watchedCount = watchedEpisodes.length;

  if (media.mediaType === 'movie') {
    return watchedCount > 0 ? 'finished' : 'not_started';
  }

  // series or anime
  if (watchedCount === 0) {
    return 'not_started';
  }

  const availableEpisodes = media.totalEpisodes ?? 0;

  if (media.releaseState === 'ongoing') {
    if (watchedCount < availableEpisodes) {
      return 'in_progress';
    }
    return 'caught_up';
  }

  // ended
  if (watchedCount < availableEpisodes) {
    return 'in_progress';
  }
  return 'finished';
}

export function getEffectiveState(media: TrackedMedia, progress: Progress): EffectiveState {
  return {
    progress,
    intent: media.intent,
    isNotifiable: media.intent === 'active' && progress === 'caught_up'
  };
}
