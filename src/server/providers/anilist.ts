import { z } from 'zod';

// AniList GraphQL endpoint
const ANILIST_API_URL = 'https://graphql.anilist.co';

// Define the Zod schema for the normalized AniList anime data
const AniListAnimeSchema = z.object({
  id: z.number().int().positive(),
  title: z.object({
    romaji: z.string(),
    english: z.string().nullable(),
    native: z.string(),
  }),
  description: z.string().nullable(),
  startDate: z.object({
    year: z.number().int().min(1900).max(2100).nullable(),
    month: z.number().int().min(1).max(12).nullable(),
    day: z.number().int().min(1).max(31).nullable(),
  }),
  endDate: z.object({
    year: z.number().int().min(1900).max(2100).nullable(),
    month: z.number().int().min(1).max(12).nullable(),
    day: z.number().int().min(1).max(31).nullable(),
  }),
  season: z.enum(['WINTER', 'SPRING', 'SUMMER', 'FALL']).nullable(),
  seasonYear: z.number().int().min(1900).max(2100).nullable(),
  format: z.string(), // e.g., TV, MOVIE, OVA, etc.
  status: z.string(), // e.g., RELEASING, FINISHED, NOT_YET_RELEASED, etc.
  episodes: z.number().int().nonnegative().nullable(),
  duration: z.number().int().nonnegative().nullable(), // in minutes
  chapters: z.number().int().nonnegative().nullable(),
  volumes: z.number().int().nonnegative().nullable(),
  source: z.string().nullable(),
  averageScore: z.number().int().min(0).max(100).nullable(),
  meanScore: z.number().int().min(0).max(100).nullable(),
  popularity: z.number().int().nonnegative().nullable(),
  trailer: z.object({
    id: z.string().nullable(),
    site: z.enum(['YOUTUBE', 'MYANIMELIST']).nullable(),
    thumbnail: z.string().url().nullable(),
  }).nullable(),
  coverImage: z.object({
    large: z.string().url(),
    medium: z.string().url(),
  }).nullable(),
  bannerImage: z.string().url().nullable(),
  genres: z.array(z.string()).default([]),
});

// Type inferred from the Zod schema
export type AniListAnime = z.infer<typeof AniListAnimeSchema>;

/**
 * Fetches anime data from AniList by its AniList ID.
 * @param id The AniList ID of the anime.
 * @returns The normalized and validated anime data.
 * @throws If the request fails or the data is invalid.
 */
export async function fetchAniListAnime(id: number): Promise<{ data: AniListAnime; payloadHash: string }> {
  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        id
        title {
          romaji
          english
          native
        }
        description
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
        season
        seasonYear
        format
        status
        episodes
        duration
        chapters
        volumes
        source
        averageScore
        meanScore
        popularity
        trailer {
          id
          site
          thumbnail
        }
        coverImage {
          large
          medium
        }
        bannerImage
        genres
      }
    }
  `;

  const response = await fetch(ANILIST_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({ query, variables: { id } }),
  });

  if (!response.ok) {
    throw new Error(`AniList request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    // GraphQL error format: we assume the error shape for now; in practice, you might want to type this better.
    throw new Error(`AniList GraphQL error: ${(json.errors as any[]).map(e => e.message).join(', ')}`);
  }

  const rawData = json.data.Media;

  // Validate and parse the data using Zod
  const parseResult = AniListAnimeSchema.safeParse(rawData);
  if (!parseResult.success) {
    // In Zod v4, the error is in `parseResult.error.issues`
    const issues = parseResult.error.issues;
    throw new Error(`Failed to validate AniList data: ${issues.map((i: any) => i.message).join(', ')}`);
  }

  const data = parseResult.data;

  // Compute a deterministic hash of the normalized data (as JSON string)
  // We use a simple hash for demonstration; in production, consider using crypto.subtle or a library.
  const payloadString = JSON.stringify(data, (_, value) =>
    typeof value === 'number' ? value : value === null ? null : value
  );
  // Simple hash function (for demo purposes only; replace with a proper cryptographic hash in real code)
  let hash = 0;
  for (let i = 0; i < payloadString.length; i++) {
    const char = payloadString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const payloadHash = Math.abs(hash).toString(36);

  return { data, payloadHash };
}