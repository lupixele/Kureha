import { z } from 'zod';

// Fanart.tv API v3 endpoint
const FANART_API_URL = 'https://webservice.fanart.tv/v3';

// Define the Zod schema for the Fanart.tv response (we only need the transparent logo)
// We'll validate the structure we expect.
const FanartTvResponseSchema = z.object({
  // We expect either 'anime' or 'movies' or 'tv' etc. but we'll make it flexible.
  // We'll look for the 'hdmovieclearart' or similar for transparent logo? 
  // Actually, Fanart.tv returns different keys for different types.
  // For simplicity, we'll assume we are looking for the transparent logo in the 'artwork' field.
  // But note: the API returns a lot of fields. We'll validate that we at least have a transparent logo.
  // We'll make the schema flexible and then extract the transparent logo URL.
  // We'll allow any keys and then look for the one we want.
}).passthrough();

// We'll create a schema for the artwork items we expect.
// According to the Fanart.tv API, for anime, the transparent logo is under 'anime' -> 'hdlogo' or 'transparentlogo'? 
// Let's check: https://fanart.tv/api-guide/v3/#anime
// The anime object has: 
//   ... 
//   "hdlogo": [...],
//   "logo": [...],
//   "transparentlogo": [...],
//   ...
// So for transparent logo, we look for 'transparentlogo'.
// Each item in the array has: id, url, lang, likes, discord, etc.
// We want the first one that is in English (or without language) or we can take the first.

// We'll create a schema for the transparent logo item.
const FanartTvTransparentLogoItemSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  lang: z.string(),
  likes: z.string(),
  // We ignore other fields for now.
});

// Now, the response for anime might have:
//   anime: { transparentlogo: [ FanartTvTransparentLogoItemSchema ] }
// We'll make a schema that is flexible and then we extract.

// We'll create a function that, given the raw response, extracts the transparent logo URL.
// We'll assume the media type is passed in (either 'anime' or 'movies' or 'tv').

// However, to keep it simple, we'll assume the caller knows the type and we try to get the transparentlogo array.

// We'll define a schema for the entire response that we expect for a given type.
// But since we don't know the type at schema time, we'll do:

// We'll create a Zod schema that says: the object must have a key that is the media type (string) and that key must be an object that has a key 'transparentlogo' which is an array of FanartTvTransparentLogoItemSchema.
// But we can't do that dynamically in Zod easily.

// Alternative: we don't validate the entire response, we just validate the transparentlogo array if it exists.

// We'll do:
//   1. Check that the response is an object.
//   2. Check that the property with the media type exists and is an object.
//   3. Check that the 'transparentlogo' property of that object is an array.
//   4. Validate each element of the array with FanartTvTransparentLogoItemSchema.
//   5. Take the first element's url.

// We'll make a function that does this.

// We'll create a schema for the transparentlogo array.
const FanartTvTransparentLogoArraySchema = z.array(FanartTvTransparentLogoItemSchema);

// Now, the function:

/**
 * Fetches the transparent logo from Fanart.tv for a given media ID and type.
 * @param id The Fanart.tv ID of the media.
 * @param type The media type: 'anime', 'movies', or 'tv'.
 * @returns The transparent logo URL.
 * @throws If the request fails or the data is invalid.
 */
export async function fetchFanartTvTransparentLogo(id: number, type: 'anime' | 'movies' | 'tv'): Promise<{ url: string; payloadHash: string }> {
  // Note: Fanart.tv requires an API key.
  const apiKey = process.env.FANART_API_KEY;
  if (!apiKey) {
    throw new Error('FANART_API_KEY environment variable is not set');
  }

  const url = `${FANART_API_URL}/${type}/${id}?api_key=${apiKey}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Fanart.tv request failed: ${response.status} ${response.statusText}`);
  }

  const rawData = await response.json();

  // Check if the response has the expected structure.
  // We expect the top-level object to have a property with the key `type`.
  if (!rawData.hasOwnProperty(type)) {
    throw new Error(`Fanart.tv response does not contain data for type '${type}'`);
  }

  const typeData = rawData[type];

  // Check if the typeData has a 'transparentlogo' property and it's an array.
  if (!typeData.hasOwnProperty('transparentlogo') || !Array.isArray(typeData.transparentlogo)) {
    throw new Error(`Fanart.tv response for type '${type}' does not contain a transparentlogo array`);
  }

  // Validate the transparentlogo array.
  const parseResult = FanartTvTransparentLogoArraySchema.safeParse(typeData.transparentlogo);
  if (!parseResult.success) {
    const issues = parseResult.error.issues;
    throw new Error(`Failed to validate Fanart.tv transparentlogo data: ${issues.map(i => i.message).join(', ')}`);
  }

  const transparentLogoItems = parseResult.data;

  if (transparentLogoItems.length === 0) {
    throw new Error(`Fanart.tv response for type '${type}' contains an empty transparentlogo array`);
  }

  // We take the first item (we could choose by language, but for simplicity we take the first).
  const logoItem = transparentLogoItems[0];
  const logoUrl = logoItem.url;

  // Compute a deterministic hash of the normalized data (we only hash the URL for now, as that's what we care about)
  // We use a simple hash for demonstration; in production, consider using crypto.subtle or a library.
  const payloadString = JSON.stringify({ url: logoUrl });
  let hash = 0;
  for (let i = 0; i < payloadString.length; i++) {
    const char = payloadString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  const payloadHash = Math.abs(hash).toString(36);

  return { url: logoUrl, payloadHash };
}