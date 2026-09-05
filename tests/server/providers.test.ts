import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createAniListClient } from '../../src/server/providers/anilist/client';
import { createTmdbClient } from '../../src/server/providers/tmdb/client';
import { createAnizipClient } from '../../src/server/providers/anizip/client';
import { createFanartClient } from '../../src/server/providers/fanart/client';
import { stableHash } from '../../src/server/providers/hash';
import { normalizeAniList } from '../../src/server/providers/anilist/normalize';
import { aniListMediaSchema } from '../../src/server/providers/anilist/schemas';
import { normalizeFanart } from '../../src/server/providers/fanart/normalize';
import { fanartSchema } from '../../src/server/providers/fanart/schemas';
import type { FetchTransport } from '../../src/server/providers/transport';

const media = {
  id: 12, title: { romaji: 'Title', english: null, native: null },
  format: 'TV', status: 'RELEASING', episodes: 12,
  startDate: { year: 2026, month: 2, day: null }, endDate: null,
  nextAiringEpisode: { episode: 4, airingAt: 1800000000 },
  coverImage: { large: 'https://images.invalid/cover' }, bannerImage: null,
  relations: { edges: [{ relationType: 'SEQUEL', node: { id: 13, type: 'ANIME', format: 'TV', isAdult: false } }] },
};
function transport(payload: unknown) {
  const request = vi.fn<FetchTransport['request']>().mockResolvedValue(payload);
  return { request };
}

describe('contract section 6 normalization', () => {
  it('uses stable recursively sorted SHA-256, preserving array order', () => {
    expect(stableHash({ b: 2, a: 1 })).toBe('43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777');
    expect(stableHash({ x: { b: 2, a: 1 } })).toBe(stableHash({ x: { a: 1, b: 2 } }));
    expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
  });
  it('returns exact installment/relation DTOs and keeps partial dates unknown', () => {
    const result = normalizeAniList(aniListMediaSchema.parse(media));
    expect(result.installment).toEqual({ source: 'anilist', providerId: '12', title: 'Title', format: 'TV', status: 'releasing', startDate: null, endDate: null, totalEpisodes: 12, nextAiringEpisode: 4, nextAiringTime: '2027-01-15T08:00:00.000Z', payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
    expect(result.relations).toEqual([{ sourceProviderId: '12', targetProviderId: '13', relationType: 'SEQUEL', targetFormat: 'TV', targetIsAdult: false }]);
    expect(result.artwork[0]).toEqual({ provider: 'anilist', providerAssetId: 'https://images.invalid/cover', kind: 'cover', urlOrPath: 'https://images.invalid/cover', language: null, voteScore: null, width: null, height: null, sourceMappingId: null, payloadHash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });
  it('reports unknown enums without reflecting upstream values', () => {
    const result = normalizeAniList(aniListMediaSchema.parse({ ...media, status: 'NEW_SECRET_VALUE', relations: { edges: [{ relationType: 'NEW_RELATION', node: { id: 9, type: 'ANIME', format: 'TV', isAdult: false } }] } }));
    expect(result.installment.status).toBe('unknown');
    expect(result.relations[0].relationType).toBe('OTHER');
    expect(result.drift).toEqual([{ provider: 'anilist', field: 'status' }, { provider: 'anilist', field: 'relationType' }]);
    expect(JSON.stringify(result)).not.toContain('SECRET');
  });
  it('ignores non-anime and character relations and validates calendar dates', () => {
    const result = normalizeAniList(aniListMediaSchema.parse({ ...media, startDate: { year: 2026, month: 2, day: 30 }, relations: { edges: [{ relationType: 'ADAPTATION', node: { id: 9, type: 'MANGA', format: 'MANGA', isAdult: false } }, { relationType: 'CHARACTER', node: { id: 10, type: 'ANIME', format: 'TV', isAdult: false } }] } }));
    expect(result.installment.startDate).toBeNull();
    expect(result.relations).toEqual([]);
  });
});

describe('AniList requests and response boundaries', () => {
  it('POSTs variables and requests relations/schedule', async () => {
    const io = transport({ data: { Media: media } });
    const client = createAniListClient({ transport: io, endpoint: 'https://anilist.invalid/graphql' });
    expect((await client.details('12')).installment.providerId).toBe('12');
    const req = io.request.mock.calls[0][0];
    expect(req).toMatchObject({ provider: 'anilist', method: 'POST', url: 'https://anilist.invalid/graphql' });
    const body = z.object({ query: z.string(), variables: z.object({ id: z.number() }) }).parse(JSON.parse(req.body ?? '{}'));
    expect(body.variables.id).toBe(12);
    expect(body.query).toContain('type: ANIME');
    expect(body.query).toContain('nextAiringEpisode');
    expect(body.query).toContain('relationType');
  });
  it.each(['0', '-1', '1.2', '1e2', '12/3', '9007199254740993'])('rejects invalid GraphQL IDs %s before transport', async id => {
    const io = transport({});
    await expect(createAniListClient({ transport: io, endpoint: 'https://a.invalid' }).details(id)).rejects.toMatchObject({ code: 'UNKNOWN_PROVIDER_ID' });
    expect(io.request).not.toHaveBeenCalled();
  });
  it('returns exact search DTOs and isolates malformed siblings', async () => {
    const io = transport({ data: { Page: { media: [media, { id: 'broken' }] } } });
    const result = await createAniListClient({ transport: io, endpoint: 'https://a.invalid' }).search('  title  ');
    expect(result.items).toEqual([{ source: 'anilist', providerId: '12', mediaKind: 'anime', title: 'Title', alternateTitle: null, releaseYear: 2026, format: 'TV', coverUrl: 'https://images.invalid/cover', existingMediaGroupId: null, importAllowed: true, importBlockReason: null }]);
    expect(result.partial).toBe(true);
  });
  it('rejects GraphQL errors and missing media with sanitized typed errors', async () => {
    const io = transport({ errors: [{ message: 'secret raw body', status: 401 }] });
    const client = createAniListClient({ transport: io, endpoint: 'https://a.invalid' });
    await expect(client.details('12')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    io.request.mockResolvedValue({ data: { Media: null } });
    await expect(client.details('12')).rejects.toMatchObject({ code: 'UNKNOWN_PROVIDER_ID' });
    io.request.mockResolvedValue({ data: { Media: { id: 12 } } });
    await expect(client.details('12')).rejects.toMatchObject({ code: 'PROVIDER_SCHEMA_CHANGED' });
  });
  it('validates Unicode search length before transport', async () => {
    const io = transport({ data: { Page: { media: [] } } });
    const client = createAniListClient({ transport: io, endpoint: 'https://a.invalid' });
    await client.search('字'.repeat(100));
    await expect(client.search('字'.repeat(101))).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    await expect(client.search('   ')).rejects.toMatchObject({ code: 'INVALID_QUERY' });
    expect(io.request).toHaveBeenCalledTimes(1);
  });
});

describe('TMDB REST boundaries', () => {
  const endpoints = { details: (kind: 'movie' | 'tv', id: string) => `https://tmdb.invalid/${kind}/${id}`, search: (kind: 'movie' | 'tv') => `https://tmdb.invalid/search/${kind}`, season: (id: string, season: number) => `https://tmdb.invalid/tv/${id}/season/${season}` };
  it('handles movie and TV shapes separately with injected bearer auth', async () => {
    const io = transport({ id: 1, title: 'Movie', release_date: '', status: 'Released', poster_path: '/p.jpg' });
    const client = createTmdbClient({ transport: io, endpoints, bearerToken: 'fixture-only', imageBaseUrl: 'https://images.invalid/original/' });
    expect((await client.details('movie', '1')).installment).toMatchObject({ title: 'Movie', startDate: null, status: 'finished' });
    io.request.mockResolvedValue({ id: 2, name: 'Show', first_air_date: '2026-01-02', status: 'Returning Series', number_of_episodes: 8 });
    expect((await client.details('tv', '2')).installment).toMatchObject({ title: 'Show', totalEpisodes: 8, status: 'releasing' });
    expect(io.request.mock.calls[0][0]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer fixture-only' } });
    expect(io.request.mock.calls[0][0].url).not.toContain('fixture-only');
  });
  it('encodes query parameters and blocks unresolved TV identity', async () => {
    const io = transport({ results: [{ id: 2, name: 'Show', first_air_date: '' }] });
    const client = createTmdbClient({ transport: io, endpoints, bearerToken: 'fixture-only', imageBaseUrl: 'https://images.invalid/' });
    const result = await client.search('tv', ' A&B ? ');
    expect(new URL(io.request.mock.calls[0][0].url).searchParams.get('query')).toBe('A&B ?');
    expect(result.items[0]).toMatchObject({ mediaKind: 'uncertain_anime', importAllowed: false, importBlockReason: 'uncertain_anime' });
  });
  it('normalizes exact season episode seeds including season zero extras', async () => {
    const io = transport({ id: 4, season_number: 0, episodes: [{ id: 5, episode_number: 1, name: 'Special', air_date: '2026-02-01', runtime: 25, still_path: '/still.jpg' }] });
    const client = createTmdbClient({ transport: io, endpoints, bearerToken: 'fixture-only', imageBaseUrl: 'https://images.invalid/' });
    expect(await client.season('2', 0)).toEqual([{ providerEpisodeId: '5', episodeNumber: 1, title: 'Special', airDate: '2026-02-01', airTimeUtc: null, runtimeMinutes: 25, imageUrl: 'https://images.invalid/still.jpg', isExtra: true }]);
  });
});

describe('optional enrichment and explicit undocumented boundaries', () => {
  it('requires Ani.zip endpoint and validated decoder and preserves exact cross IDs', async () => {
    const boundary = z.object({ links: z.array(z.object({ id: z.string() })) }).transform(value => ({ refs: value.links.map(link => ({ provider: 'tvdb' as const, providerId: link.id, target: 'tv' as const })), episodes: [] }));
    const io = transport({ links: [{ id: '9007199254740993' }] });
    const client = createAnizipClient({ transport: io, endpoint: id => `https://configured.invalid/mapping?aid=${id}`, boundary });
    expect(await client.enrich('12')).toMatchObject({ ok: true, data: { refs: [{ provider: 'tvdb', providerId: '9007199254740993', target: 'tv' }], episodes: [] } });
    io.request.mockResolvedValue({ links: [{ id: 'bad' }] });
    expect(await client.enrich('12')).toMatchObject({ ok: false, error: { code: 'PROVIDER_SCHEMA_CHANGED' } });
  });
  it('swallows optional failure only through an observable typed result', async () => {
    const io = transport({});
    io.request.mockRejectedValue(new Error('raw secret response'));
    const result = await createAnizipClient({ transport: io, endpoint: () => 'https://configured.invalid', boundary: z.unknown() }).enrich('12');
    expect(result).toMatchObject({ ok: false, error: { code: 'PROVIDER_UNAVAILABLE' } });
    expect(JSON.stringify(result)).not.toContain('raw secret');
  });
  it('skips Fanart without positive mappings and requests mapped IDs', async () => {
    const io = transport({ hdtvlogo: [{ id: '3', url: 'https://images.invalid/logo.png', lang: '00', likes: '12' }], tvposter: [{ invalid: true }] });
    const endpoint = vi.fn((kind: 'movie' | 'tv', id: string) => `https://fanart.invalid/${kind}/${id}`);
    const client = createFanartClient({ transport: io, endpoint, apiKey: 'fixture-only' });
    expect(await client.logos(null)).toEqual({ ok: true, data: [] });
    expect(io.request).not.toHaveBeenCalled();
    const result = await client.logos({ provider: 'tvdb', providerId: '44', target: 'tv', sourceMappingId: 'mapping-1', positive: true });
    expect(endpoint).toHaveBeenCalledWith('tv', '44');
    expect(result).toMatchObject({ ok: true, data: [{ kind: 'title_logo', language: null, voteScore: 12, sourceMappingId: 'mapping-1' }] });
  });
  it('accepts only documented logo fields, prefers HD, falls back when empty', () => {
    const logo = { id: '1', url: 'https://images.invalid/logo.png', lang: 'en', likes: '3' };
    const parsed = fanartSchema.parse({ hdmovielogo: [logo], movielogo: [{ ...logo, id: '2' }], movieposter: [logo], moviebackground: [logo], hdmovieclearart: [logo] });
    expect(normalizeFanart(parsed, 'movie', 'mapping').map(item => item.providerAssetId)).toEqual(['1']);
    expect(normalizeFanart(fanartSchema.parse({ hdtvlogo: [], clearlogo: [logo] }), 'tv', 'mapping')).toHaveLength(1);
    expect(normalizeFanart(fanartSchema.parse({ movieposter: [logo] }), 'movie', 'mapping')).toEqual([]);
  });
});
