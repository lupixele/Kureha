import { z } from 'zod';

// Ani.zip API endpoint (example, adjust as needed)
// Note: Ani.zip is optional and may not have a public API; we assume a REST endpoint for demonstration.
const ANIZIP_API_URL = 'https://ani.zip/api';

// Define the Zod schema for the normalized Ani.zip data
const AnizipSchema = z.object({
  // Example fields: adjust based on actual Ani.zip data structure
  malId: z.number().int().positive().nullable(),
  anilistId: z.number().int().positive(),
  // Add other fields as they become available from Ani.zip
  // For now, we keep it minimal.
});

// Type inferred from the Zod schema
export type AnizipData = z.infer<typeof AnizipSchema>;

/**
 * Fetches enrichment data from Ani.zip by its AniList ID.
 * @param anilistId The AniList ID of the anime.
 * @returns The normalized and validated enrichment data.
 * @throws If the request fails or the data is invalid.
 */
export async function fetchAnizipData(anilistId: number): Promise<{ data: AnizipData; payloadHash: string }> {
  // Note: Ani.zip might not require an API key; if it does, use environment variable.
  const url = `${ANIZIP_API_URL}/anime/${anilistId}`;

  const response = await fetch(url);

  if (!response.ok) {
    // If Ani.zip is not available, we return null data and a hash of null? 
    // But the contract says it's optional and non-blocking.
    // We'll throw an error and let the caller handle it (e.g., fallback to null).
    throw new Error(`Ani.zip request failed: ${response.status} ${response.statusText}`);
  }

  const rawData = await response.json();

  // Validate and parse the data using Zod
  const parseResult = AnizipSchema.safeParse(rawData);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    throw new Error(`Failed to validate Ani.zip data: ${issues.map(i => i.message).join(', ')}`);
  }

  const data = parseResult.data;

  // Compute a deterministic hash of the normalized data (as JSON string)
  const payloadString = JSON.stringify(data, (_, value) =>
    typeof value === 'number' ? value : value === null ? null : value
  );
  let hash = 0;
  for (let i = 0; i < payloadString.length; i++) {
    const char = payloadString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  const payloadHash = Math.abs(hash).toString(36);

  return { data, payloadHash };
}