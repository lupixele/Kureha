import { stableHash } from '../hash';
import { artworkCandidate, calendarDate, type NormalizedDetails, type NormalizedEpisodeSeed, type NormalizedInstallment, type UnifiedSearchItem } from '../types';
import type { TmdbMovie, TmdbTv, TmdbSeason } from './schemas';

const statuses: Record<string, NormalizedInstallment['status']> = { Rumored: 'not_yet_released', Planned: 'not_yet_released', 'In Production': 'not_yet_released', 'Post Production': 'not_yet_released', Released: 'finished', Canceled: 'cancelled', 'Returning Series': 'releasing', Ended: 'finished', Pilot: 'not_yet_released' };
export function tmdbImage(path: string | null | undefined, base: string): string | null {
  return path ? `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}` : null;
}
export function normalizeTmdb(media: TmdbMovie | TmdbTv, imageBaseUrl: string): NormalizedDetails {
  const movie = 'title' in media;
  const status = media.status && Object.hasOwn(statuses, media.status) ? statuses[media.status] : 'unknown';
  const result: NormalizedDetails = {
    installment: { source: 'tmdb', providerId: media.id, title: movie ? media.title : media.name, format: movie ? 'MOVIE' : 'TV', status, startDate: calendarDate(movie ? media.release_date : media.first_air_date), endDate: !movie && status === 'finished' ? calendarDate(media.last_air_date) : null, totalEpisodes: movie ? null : media.number_of_episodes ?? null, nextAiringEpisode: null, nextAiringTime: null, payloadHash: stableHash(media) },
    relations: [], artwork: [], drift: status === 'unknown' ? [{ provider: 'tmdb', field: 'status' }] : [],
  };
  for (const [path, kind] of [[media.poster_path, 'cover'], [media.backdrop_path, 'backdrop']] as const) {
    const url = tmdbImage(path, imageBaseUrl);
    if (path && url) result.artwork.push(artworkCandidate('tmdb', path, kind, url, stableHash({ path, kind })));
  }
  return result;
}
export function normalizeTmdbSearch(media: TmdbMovie | TmdbTv, imageBaseUrl: string): UnifiedSearchItem {
  const movie = 'title' in media;
  const date = calendarDate(movie ? media.release_date : media.first_air_date);
  return { source: 'tmdb', providerId: media.id, mediaKind: movie ? 'movie' : 'uncertain_anime', title: movie ? media.title : media.name, alternateTitle: (movie ? media.original_title : media.original_name) ?? null, releaseYear: date ? Number(date.slice(0, 4)) : null, format: movie ? 'MOVIE' : 'TV', coverUrl: tmdbImage(media.poster_path, imageBaseUrl), existingMediaGroupId: null, importAllowed: movie, importBlockReason: movie ? null : 'uncertain_anime' };
}
export function normalizeTmdbSeason(season: TmdbSeason, imageBaseUrl: string): NormalizedEpisodeSeed[] {
  return season.episodes.map(episode => ({ providerEpisodeId: episode.id, episodeNumber: episode.episode_number, title: episode.name ?? null, airDate: calendarDate(episode.air_date), airTimeUtc: null, runtimeMinutes: episode.runtime ?? null, imageUrl: tmdbImage(episode.still_path, imageBaseUrl), isExtra: season.season_number === 0 }));
}
