import { stableHash } from '../hash';
import { artworkCandidate, type NormalizedArtworkCandidate } from '../types';
import type { FanartData } from './schemas';

export function normalizeFanart(data: FanartData, kind: 'movie' | 'tv', sourceMappingId: string): NormalizedArtworkCandidate[] {
  const hd = kind === 'movie' ? data.hdmovielogo : data.hdtvlogo;
  const fallback = kind === 'movie' ? data.movielogo : data.clearlogo;
  return (hd?.length ? hd : fallback ?? []).map(logo => ({ ...artworkCandidate('fanart', logo.id, 'title_logo', logo.url, stableHash(logo)), language: logo.lang === '00' || logo.lang === '' ? null : logo.lang, voteScore: logo.likes, sourceMappingId }));
}
