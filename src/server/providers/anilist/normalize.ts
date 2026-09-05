import { stableHash } from '../hash';
import { artworkCandidate, calendarDate, type NormalizedDetails, type NormalizedInstallment, type NormalizedRelation, type UnifiedSearchItem } from '../types';
import type { AniListMedia } from './schemas';

const statuses: Record<string, NormalizedInstallment['status']> = { NOT_YET_RELEASED: 'not_yet_released', RELEASING: 'releasing', FINISHED: 'finished', CANCELLED: 'cancelled', HIATUS: 'hiatus' };
const relations: NormalizedRelation['relationType'][] = ['PREQUEL', 'SEQUEL', 'PARENT', 'SIDE_STORY', 'CHARACTER', 'SUMMARY', 'ALTERNATIVE', 'SPIN_OFF', 'ADAPTATION', 'SOURCE', 'COMPILATION', 'CONTAINS', 'SAME_UNIVERSE', 'OTHER'];
function date(value: AniListMedia['startDate']): string | null {
  if (!value?.year || !value.month || !value.day) return null;
  return calendarDate(`${String(value.year).padStart(4, '0')}-${String(value.month).padStart(2, '0')}-${String(value.day).padStart(2, '0')}`);
}
function title(media: AniListMedia): string { return media.title.romaji || media.title.english || media.title.native || ''; }

export function normalizeAniList(media: AniListMedia): NormalizedDetails {
  const status = media.status && Object.hasOwn(statuses, media.status) ? statuses[media.status] : 'unknown';
  const result: NormalizedDetails = {
    installment: { source: 'anilist', providerId: media.id, title: title(media), format: media.format ?? 'unknown', status, startDate: date(media.startDate), endDate: date(media.endDate), totalEpisodes: media.episodes ?? null, nextAiringEpisode: media.nextAiringEpisode?.episode ?? null, nextAiringTime: media.nextAiringEpisode ? new Date(media.nextAiringEpisode.airingAt * 1000).toISOString() : null, payloadHash: stableHash(media) },
    relations: [], artwork: [], drift: status === 'unknown' ? [{ provider: 'anilist', field: 'status' }] : [],
  };
  for (const edge of media.relations?.edges ?? []) {
    if (edge.node.type !== 'ANIME' || edge.relationType === 'CHARACTER') continue;
    const relationType = relations.find(type => type === edge.relationType) ?? 'OTHER';
    if (!relations.some(type => type === edge.relationType)) result.drift.push({ provider: 'anilist', field: 'relationType' });
    result.relations.push({ sourceProviderId: media.id, targetProviderId: edge.node.id, relationType, targetFormat: edge.node.format ?? null, targetIsAdult: edge.node.isAdult });
  }
  if (media.coverImage?.large) result.artwork.push(artworkCandidate('anilist', media.coverImage.large, 'cover', media.coverImage.large, stableHash(media.coverImage)));
  if (media.bannerImage) result.artwork.push(artworkCandidate('anilist', media.bannerImage, 'backdrop', media.bannerImage, stableHash(media.bannerImage)));
  return result;
}

export function normalizeAniListSearch(media: AniListMedia): UnifiedSearchItem {
  return { source: 'anilist', providerId: media.id, mediaKind: 'anime', title: title(media), alternateTitle: media.title.english ?? null, releaseYear: media.startDate?.year ?? null, format: media.format ?? null, coverUrl: media.coverImage?.large ?? null, existingMediaGroupId: null, importAllowed: true, importBlockReason: null };
}
