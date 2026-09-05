import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAniListAnime, type AniListAnime } from '../../src/server/providers/anilist';
import { fetchTmdbMedia, type TmdbMedia } from '../../src/server/providers/tmdb';
import { fetchAnizipData, type AnizipData } from '../../src/server/providers/anizip';
import { fetchFanartTvTransparentLogo } from '../../src/server/providers/fanart';

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AniList provider', () => {
  it('should fetch and validate AniList anime data', async () => {
    const mockData = {
      id: 1,
      title: { romaji: 'Test Anime', english: 'Test Anime', native: 'テストアニメ' },
      description: 'This is a test anime.',
      startDate: { year: 2020, month: 1, day: 1 },
      endDate: { year: 2020, month: 12, day: 31 },
      season: 'WINTER',
      seasonYear: 2020,
      format: 'TV',
      status: 'FINISHED',
      episodes: 12,
      duration: 24,
      chapters: null,
      volumes: null,
      source: 'Manga',
      averageScore: 85,
      meanScore: 80,
      popularity: 100,
      trailer: { id: 'abc123', site: 'YOUTUBE', thumbnail: 'https://example.com/thumb.jpg' },
      coverImage: { large: 'https://example.com/cover-large.jpg', medium: 'https://example.com/cover-medium.jpg' },
      bannerImage: 'https://example.com/banner.jpg',
      genres: ['Action', 'Adventure'],
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { Media: mockData } }),
    });

    const { data, payloadHash } = await fetchAniListAnime(1);

    expect(data).toEqual(mockData);
    expect(typeof payloadHash).toBe('string');
    expect(payloadHash.length).toBeGreaterThan(0);
  });

  it('should throw an error on invalid AniList data', async () => {
    const mockData = {
      // Missing required fields
      id: 1,
      title: { romaji: 'Test Anime' }, // missing english and native
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: { Media: mockData } }),
    });

    await expect(fetchAniListAnime(1)).rejects.toThrow('Failed to validate AniList data');
  });

  it('should throw an error on AniList GraphQL error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ errors: [{ message: 'Not found' }] }),
    });

    await expect(fetchAniListAnime(1)).rejects.toThrow('AniList GraphQL error');
  });

  it('should throw an error on network failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchAniListAnime(1)).rejects.toThrow('AniList request failed: 500 Internal Server Error');
  });
});

describe('TMDB provider', () => {
  it('should fetch and validate TMDB movie data', async () => {
    const mockData = {
      id: 1,
      title: 'Test Movie',
      original_title: 'Test Movie',
      overview: 'This is a test movie.',
      release_date: '2020-01-01',
      vote_average: 8.5,
      vote_count: 100,
      popularity: 50.5,
      original_language: 'en',
      adult: false,
      backdrop_path: '/backdrop.jpg',
      poster_path: '/poster.jpg',
      genre_ids: [28, 12],
      // TV-specific fields, set to null for movie
      name: null,
      original_name: null,
      first_air_date: null,
      last_air_date: null,
    };

    // Mock environment variable for TMDB API key
    vi.stubEnv('TMDB_API_KEY', 'test-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { data, payloadHash } = await fetchTmdbMedia(1, 'movie');

    expect(data).toEqual(mockData);
    expect(typeof payloadHash).toBe('string');
    expect(payloadHash.length).toBeGreaterThan(0);
  });

  it('should throw an error if TMDB_API_KEY is not set', async () => {
    // Unset the environment variable
    vi.stubEnv('TMDB_API_KEY', undefined);

    await expect(fetchTmdbMedia(1, 'movie')).rejects.toThrow('TMDB_API_KEY environment variable is not set');
  });

  it('should throw an error on invalid TMDB data', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key');

    const mockData = {
      // Missing required fields
      id: 1,
      title: 'Test Movie',
      // missing original_title, overview, release_date, etc.
      // Set the nullable fields to null to avoid undefined
      original_title: null,
      overview: null,
      release_date: null,
      vote_average: null,
      vote_count: null,
      popularity: null,
      original_language: null,
      adult: null,
      backdrop_path: null,
      poster_path: null,
      genre_ids: null,
      name: null,
      original_name: null,
      first_air_date: null,
      last_air_date: null,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await expect(fetchTmdbMedia(1, 'movie')).rejects.toThrow('Failed to validate TMDB data');
  });

  it('should throw an error on network failure', async () => {
    vi.stubEnv('TMDB_API_KEY', 'test-key');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchTmdbMedia(1, 'movie')).rejects.toThrow('TMDB request failed: 500 Internal Server Error');
  });
});

describe('Ani.zip provider', () => {
  it('should fetch and validate Ani.zip data', async () => {
    const mockData = {
      malId: 123,
      anilistId: 456,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { data, payloadHash } = await fetchAnizipData(456);

    expect(data).toEqual(mockData);
    expect(typeof payloadHash).toBe('string');
    expect(payloadHash.length).toBeGreaterThan(0);
  });

  it('should throw an error on invalid Ani.zip data', async () => {
    const mockData = {
      // missing required anilistId
      malId: 123,
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await expect(fetchAnizipData(456)).rejects.toThrow('Failed to validate Ani.zip data');
  });

  it('should throw an error on network failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchAnizipData(456)).rejects.toThrow('Ani.zip request failed: 500 Internal Server Error');
  });
});

describe('Fanart.tv provider', () => {
  it('should fetch and validate Fanart.tv transparent logo', async () => {
    const mockData = {
      anime: {
        transparentlogo: [
          { id: '1', url: 'https://fanart.tv/fanart/anime/1/logo.png', lang: 'en', likes: '100' },
          { id: '2', url: 'https://fanart.tv/fanart/anime/1/logo2.png', lang: 'ja', likes: '50' },
        ],
      },
    };

    // Mock environment variable for Fanart.tv API key
    vi.stubEnv('FANART_API_KEY', 'test-key');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const { url, payloadHash } = await fetchFanartTvTransparentLogo(1, 'anime');

    // Expect the first logo (English) to be returned
    expect(url).toBe('https://fanart.tv/fanart/anime/1/logo.png');
    expect(typeof payloadHash).toBe('string');
    expect(payloadHash.length).toBeGreaterThan(0);
  });

  it('should throw an error if FANART_API_KEY is not set', async () => {
    vi.stubEnv('FANART_API_KEY', undefined);

    await expect(fetchFanartTvTransparentLogo(1, 'anime')).rejects.toThrow('FANART_API_KEY environment variable is not set');
  });

  it('should throw an error on invalid Fanart.tv data', async () => {
    vi.stubEnv('FANART_API_KEY', 'test-key');

    const mockData = {
      // Missing the 'anime' key or 'transparentlogo' inside
      movies: {},
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    await expect(fetchFanartTvTransparentLogo(1, 'anime')).rejects.toThrow(/Fanart.tv response does not contain data for type 'anime'/);
  });

  it('should throw an error on network failure', async () => {
    vi.stubEnv('FANART_API_KEY', 'test-key');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    });

    await expect(fetchFanartTvTransparentLogo(1, 'anime')).rejects.toThrow('Fanart.tv request failed: 500 Internal Server Error');
  });
});