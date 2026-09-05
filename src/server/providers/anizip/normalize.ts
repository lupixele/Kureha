import { calendarDate } from '../types';
import type { AnizipData } from './schemas';

export function normalizeAnizip(data: AnizipData): AnizipData {
  return { refs: data.refs, episodes: data.episodes.map(episode => ({ ...episode, airDate: calendarDate(episode.airDate) })) };
}
