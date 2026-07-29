// user_id assumed to be a UUID string; auth provider not yet decided

export type ReleaseState = 'unreleased' | 'released' | 'ongoing' | 'ended';
export type Progress = 'unreleased' | 'not_started' | 'in_progress' | 'caught_up' | 'finished';
export type Intent = 'active' | 'paused' | 'watch_later' | 'dropped';
export type MetadataSource = 'tmdb' | 'tvdb';

export interface TrackedMedia {
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'series' | 'anime';
  metadataSource: MetadataSource;
  intent: Intent;
  totalEpisodes: number | null;
  releaseState: ReleaseState;
  intentChangedAt?: number | null;
  addedAt: number;
}

export interface WatchedEpisode {
  userId: string;
  mediaId: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: number;
  rewatchCount: number;
}

// For episode reference used in skipped/rewatch logic
export interface EpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
}

export interface EffectiveState {
  progress: Progress;
  intent: Intent;
  isNotifiable: boolean;
}
