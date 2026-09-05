import { z } from 'zod';
import { providerIdSchema } from '../types';

// The configured decoder owns the upstream wire shape; this validates its DTO output.
export const anizipSchema = z.object({
  refs: z.array(z.object({ provider: z.enum(['anilist', 'tmdb', 'tvdb', 'mal', 'anidb']), providerId: providerIdSchema, target: z.enum(['anime', 'movie', 'tv', 'episode']) })),
  episodes: z.array(z.object({ providerEpisodeId: providerIdSchema.nullable(), episodeNumber: z.number().int().positive(), title: z.string().nullable(), airDate: z.string().nullable(), airTimeUtc: z.string().datetime().nullable(), runtimeMinutes: z.number().nonnegative().nullable(), imageUrl: z.string().url().nullable(), isExtra: z.boolean() })),
});
export type AnizipData = z.infer<typeof anizipSchema>;
