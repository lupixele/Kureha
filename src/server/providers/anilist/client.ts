import { httpError, ProviderError } from '../errors';
import type { FetchTransport } from '../transport';
import { parseProvider, searchQuery, validateId, type UnifiedSearchResponse } from '../types';
import { aniListEnvelopeSchema, aniListMediaSchema } from './schemas';
import { normalizeAniList, normalizeAniListSearch } from './normalize';

const fields = `id title { romaji english native } format status episodes startDate { year month day } endDate { year month day } nextAiringEpisode { episode airingAt } coverImage { large } bannerImage relations { edges { relationType node { id type format isAdult } } }`;
export function createAniListClient(options: { transport: FetchTransport; endpoint: string }) {
  async function request(query: string, variables: Record<string, string | number>) {
    const raw = await options.transport.request({ provider: 'anilist', url: options.endpoint, method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query, variables }) });
    const response = parseProvider(aniListEnvelopeSchema, raw, 'anilist');
    if (response.errors?.length) throw httpError('anilist', response.errors[0].status ?? 400);
    return response.data;
  }
  return {
    async details(id: string) {
      validateId(id, 'anilist', true);
      const data = await request(`query ($id: Int!) { Media(id: $id, type: ANIME) { ${fields} } }`, { id: Number(id) });
      if (data?.Media === null) throw new ProviderError('UNKNOWN_PROVIDER_ID', 'anilist');
      return normalizeAniList(parseProvider(aniListMediaSchema, data?.Media, 'anilist'));
    },
    async search(input: string): Promise<UnifiedSearchResponse> {
      const query = searchQuery(input, 'anilist');
      const data = await request(`query ($search: String!) { Page { media(search: $search, type: ANIME) { ${fields} } } }`, { search: query });
      if (!data?.Page) throw new ProviderError('PROVIDER_SCHEMA_CHANGED', 'anilist');
      const result: UnifiedSearchResponse = { query, items: [], partial: false, unavailableProviders: [] };
      for (const raw of data.Page.media) {
        const parsed = aniListMediaSchema.safeParse(raw);
        if (parsed.success) result.items.push(normalizeAniListSearch(parsed.data));
        else result.partial = true;
      }
      return result;
    },
  };
}
