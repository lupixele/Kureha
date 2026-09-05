import { z } from 'zod';
import { providerIdSchema } from '../types';

const date = z.object({ year: z.number().int().nullable(), month: z.number().int().nullable(), day: z.number().int().nullable() }).nullish();
export const aniListMediaSchema = z.object({
  id: providerIdSchema,
  title: z.object({ romaji: z.string().nullish(), english: z.string().nullish(), native: z.string().nullish() }).refine(t => Boolean(t.romaji || t.english || t.native)),
  format: z.string().nullish(), status: z.string().nullish(), episodes: z.number().int().nonnegative().nullish(),
  startDate: date, endDate: date,
  nextAiringEpisode: z.object({ episode: z.number().int().positive(), airingAt: z.number().int().nonnegative().max(8_640_000_000_000) }).nullish(),
  coverImage: z.object({ large: z.string().url().nullish() }).nullish(), bannerImage: z.string().url().nullish(),
  relations: z.object({ edges: z.array(z.object({ relationType: z.string(), node: z.object({ id: providerIdSchema, type: z.string(), format: z.string().nullish(), isAdult: z.boolean() }) })) }).nullish(),
});
export type AniListMedia = z.infer<typeof aniListMediaSchema>;
export const aniListEnvelopeSchema = z.object({ data: z.object({ Media: z.unknown().optional(), Page: z.object({ media: z.array(z.unknown()) }).optional() }).nullish(), errors: z.array(z.object({ status: z.number().int().optional() })).optional() });
