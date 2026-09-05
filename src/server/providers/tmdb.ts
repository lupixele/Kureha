import { z } from 'zod';

// TMDB API v3 endpoint (read-only, no key in client code; key expected in env)
const TMDB_API_URL = 'https://api.themoviedb.org/3';

// Define the Zod schema for the normalized TMDB movie/TV data
const TmdbMediaSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(), // for movie
  name: z.string().nullable(), // for TV
  original_title: z.string().nullable(),
  original_name: z.string().nullable(),
  overview: z.string().nullable(),
  release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), // YYYY-MM-DD
  first_air_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  last_air_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  vote_average: z.number().min(0).max(10).nullable(),
  vote_count: z.number().int().nonnegative().nullable(),
  popularity: z.number().nonnegative().nullable(),
  original_language: z.string().length(2),
  adult: z.boolean().nullable(),
  backdrop_path: z.string().nullable(),
  poster_path: z.string().nullable(),
  genre_ids: z.array(z.number().int()).default([]),
  // For TV: number of seasons, episodes per season, etc. are not in the basic endpoint.
  // We'll keep it simple for now; the contract may require more.
});

// Type inferred from the Zod schema
export type TmdbMedia = z.infer<typeof TmdbMediaSchema>;

/**
 * Fetches media data from TMDB by its TMDB ID.
 * @param id The TMDB ID of the media.
 * @param type Either 'movie' or 'tv'.
 * @returns The normalized and validated media data.
 * @throws If the request fails or the data is invalid.
 */
export async function fetchTmdbMedia(id: number, type: 'movie' | 'tv'): Promise<{ data: TmdbMedia; payloadHash: string }> {
  const endpoint = type === 'movie' ? 'movie' : 'tv';
  const url = `${TMDB_API_URL}/${endpoint}/${id}`;

  // Note: In a real implementation, the API key would be injected via environment variable.
  // For the purpose of this code, we assume the key is set in the environment variable TMDB_API_KEY.
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY environment variable is not set');
  }

  const response = await fetch(`${url}?api_key=${apiKey}&language=en-US`);

  if (!response.ok) {
    throw new Error(`TMDB request failed: ${response.status} ${response.statusText}`);
  }

  const rawData = await response.json();
  // Temporary debug: log the raw data
  console.log('TMDB rawData:', rawData);

  // Validate and parse the data using Zod
  const parseResult = TmdbMediaSchema.safeParse(rawData);
  if (!parseResult.success) {
    // In Zod v4, the error is in `parseResult.error.issues`
    const issues = parseResult.error.issues;
    throw new Error(`Failed to validate TMDB data: ${issues.map(i => i.message).join(', ')}`);
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