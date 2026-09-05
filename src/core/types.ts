// user_id is a UUID string from Google OAuth via Supabase Auth

export type ReleaseState = 'unreleased' | 'released' | 'ongoing' | 'ended';
export type Progress = 'unreleased' | 'not_started' | 'in_progress' | 'caught_up' | 'finished';
export type Intent = 'active' | 'paused' | 'watch_later' | 'dropped';
export type MetadataSource = 'tmdb' | 'tvdb';

export type TrackingErrorCode =
  | 'UNAUTHORIZED'
  | 'PROFILE_SETUP_REQUIRED'
  | 'UNKNOWN_CATALOGUE_ID'
  | 'MEDIA_KIND_MISMATCH'
  | 'RELEASE_UNCONFIRMED'
  | 'INVALID_SCOPE'
  | 'INVALID_REMOVAL'
  | 'NOT_WATCHED'
  | 'OPERATION_ID_CONFLICT'
  | 'CONFIRMATION_REQUIRED'
  | 'INTERNAL_ERROR';

export type TrackingAction =
  | 'mark_episode'
  | 'unmark_episode'
  | 'mark_movie'
  | 'unmark_movie'
  | 'add_to_library'
  | 'remove_from_library'
  | 'set_intent'
  | 'delete_tracking';

export interface TrackingSummary {
  progressState: Progress;
  watchedCount: number;
  frontierEpisodeId: string | null;
}

export interface MutationSummary {
  operationId: string;
  mediaGroupId: string;
  action: TrackingAction;
  scope?: string;
  removal?: string;
  affectedCount: number;
  decrementedCount?: number;
  deletedCount?: number;
  summary?: TrackingSummary;
}

export type MutationResult =
  | { ok: true, data: MutationSummary, replayed?: boolean }
  | { ok: false, error: { code: TrackingErrorCode, message: string } };

// Legacy properties below for tests/existing paths
export interface TrackedMedia {
  userId: string;
  mediaId: string;
  mediaType: 'movie' | 'series' | 'anime';
  metadataSource: MetadataSource;
  intent: Intent;
  totalEpisodes: number | null;
  releaseState: ReleaseState;
  intentChangedAt: number | null;
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