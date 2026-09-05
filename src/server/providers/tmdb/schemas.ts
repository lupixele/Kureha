import { z } from 'zod';
import { providerIdSchema } from '../types';

const common = {
  id: providerIdSchema, status: z.string().nullish(), poster_path: z.string().nullish(), backdrop_path: z.string().nullish(),
};
export const tmdbMovieSchema = z.object({ ...common, title: z.string().min(1), original_title: z.string().nullish(), release_date: z.string().nullish() });
export const tmdbTvSchema = z.object({ ...common, name: z.string().min(1), original_name: z.string().nullish(), first_air_date: z.string().nullish(), last_air_date: z.string().nullish(), number_of_episodes: z.number().int().nonnegative().nullish() });
export const tmdbSeasonSchema = z.object({
  id: providerIdSchema, season_number: z.number().int().nonnegative(),
  episodes: z.array(z.object({ id: providerIdSchema, episode_number: z.number().int().positive(), name: z.string().nullish(), air_date: z.string().nullish(), runtime: z.number().nonnegative().nullish(), still_path: z.string().nullish() })),
});
export const tmdbSearchSchema = z.object({ results: z.array(z.unknown()) });
export type TmdbMovie = z.infer<typeof tmdbMovieSchema>;
export type TmdbTv = z.infer<typeof tmdbTvSchema>;
export type TmdbSeason = z.infer<typeof tmdbSeasonSchema>;
